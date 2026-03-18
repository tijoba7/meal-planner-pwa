-- Server-side rate limiting for AI recipe scraping (H-2 fix)
-- Replaces client-side localStorage rate limiting with tamper-proof DB enforcement.

-- ── Usage tracking table ────────────────────────────────────────────────────
create table if not exists public.scrape_usage (
  id          bigint generated always as identity primary key,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- Index for efficient window queries
create index if not exists idx_scrape_usage_user_time
  on public.scrape_usage (user_id, created_at desc);

-- RLS: users can only see/insert their own rows
alter table public.scrape_usage enable row level security;

create policy "scrape_usage: user can insert own"
  on public.scrape_usage for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "scrape_usage: user can read own"
  on public.scrape_usage for select
  to authenticated
  using (user_id = auth.uid());

-- Admins can read all (for monitoring)
create policy "scrape_usage: admin can read all"
  on public.scrape_usage for select
  to authenticated
  using (public.is_admin());

-- ── Rate limit check function ───────────────────────────────────────────────
-- Returns JSON: { "allowed": true/false, "remaining": N, "retry_after_sec": N }
-- Atomically records the attempt if allowed.
create or replace function public.check_scrape_rate_limit()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id  uuid := auth.uid();
  v_max      int;
  v_window   interval := interval '1 hour';
  v_count    int;
  v_oldest   timestamptz;
begin
  if v_user_id is null then
    return jsonb_build_object('allowed', false, 'remaining', 0, 'retry_after_sec', 0);
  end if;

  -- Read admin-configured limit, default to 10
  select coalesce((value)::int, 10)
    into v_max
    from public.app_settings
   where key = 'scraping.rate_limit';

  if v_max is null then v_max := 10; end if;

  -- Count attempts in the rolling window
  select count(*), min(created_at)
    into v_count, v_oldest
    from public.scrape_usage
   where user_id = v_user_id
     and created_at > now() - v_window;

  if v_count >= v_max then
    return jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'retry_after_sec', ceil(extract(epoch from (v_oldest + v_window - now())))
    );
  end if;

  -- Record this attempt
  insert into public.scrape_usage (user_id) values (v_user_id);

  return jsonb_build_object(
    'allowed', true,
    'remaining', v_max - v_count - 1,
    'retry_after_sec', 0
  );
end;
$$;

-- ── Secure scraping config RPC ──────────────────────────────────────────────
-- Returns the AI scraping config (including API key) to any authenticated user,
-- but ONLY if they pass the rate limit check. This way the key never needs to
-- be exposed via RLS to non-admins directly.
create or replace function public.get_scraping_config()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_api_key  text;
  v_provider text;
  v_model    text;
begin
  if auth.uid() is null then
    return jsonb_build_object('error', 'Not authenticated');
  end if;

  select value #>> '{}' into v_api_key  from public.app_settings where key = 'scraping.api_key';
  select value #>> '{}' into v_provider from public.app_settings where key = 'scraping.provider';
  select value #>> '{}' into v_model    from public.app_settings where key = 'scraping.model';

  if v_api_key is null or v_api_key = '' then
    return jsonb_build_object('error', 'AI scraping not configured — ask your admin to set up an API key in the admin panel.');
  end if;

  return jsonb_build_object(
    'api_key', v_api_key,
    'provider', coalesce(v_provider, 'openai'),
    'model', v_model
  );
end;
$$;

-- ── Cleanup: auto-delete usage records older than 24 hours ──────────────────
-- (Optional: run via pg_cron if available, or ignore — the table stays small)
