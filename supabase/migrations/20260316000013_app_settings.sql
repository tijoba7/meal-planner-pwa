-- ─── App settings table + RLS ─────────────────────────────────────────────────
-- MEA-169: App settings table + CRUD service (Phase 2 of Admin Panel MEA-167)
-- Stores admin-managed key/value pairs for app-wide configuration.
-- Keys: scraping.api_key, scraping.provider, scraping.model, scraping.rate_limit, etc.

-- ─── Table ────────────────────────────────────────────────────────────────────

create table public.app_settings (
  key          text        primary key,
  value        jsonb       not null default 'null'::jsonb,
  sensitive    boolean     not null default false,
  updated_at   timestamptz not null default now(),
  updated_by   uuid        references public.profiles(id) on delete set null
);

comment on table public.app_settings is
  'Admin-managed app-wide configuration. Sensitive keys (e.g. API keys) are hidden from regular users via RLS.';

comment on column public.app_settings.key is
  'Dot-namespaced setting key, e.g. scraping.api_key or feature.social_enabled.';
comment on column public.app_settings.value is
  'JSONB value — use a JSON string for text, number for numeric settings, boolean for flags.';
comment on column public.app_settings.sensitive is
  'When true, only admins can read this key. Regular authenticated users cannot see it.';
comment on column public.app_settings.updated_by is
  'Profile id of the admin who last changed this setting. NULL when set by a migration/seed.';

-- ─── updated_at trigger ───────────────────────────────────────────────────────

create or replace function public.app_settings_set_updated_at()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.app_settings_set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.app_settings enable row level security;

-- Admins can read every key (sensitive or not).
create policy "app_settings: admin read all"
  on public.app_settings for select
  to authenticated
  using (public.is_admin());

-- Regular authenticated users can read non-sensitive keys only.
create policy "app_settings: user read non-sensitive"
  on public.app_settings for select
  to authenticated
  using (not sensitive);

-- Only admins can insert new settings.
create policy "app_settings: admin insert"
  on public.app_settings for insert
  to authenticated
  with check (public.is_admin());

-- Only admins can update settings.
create policy "app_settings: admin update"
  on public.app_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Only admins can delete settings.
create policy "app_settings: admin delete"
  on public.app_settings for delete
  to authenticated
  using (public.is_admin());

-- ─── Seed: known scraping keys ────────────────────────────────────────────────
-- Insert default empty rows so the admin UI always finds them.
-- Values remain null until an admin sets them.

insert into public.app_settings (key, value, sensitive) values
  ('scraping.api_key',    'null'::jsonb, true),
  ('scraping.provider',   '"anthropic"'::jsonb, false),
  ('scraping.model',      '"claude-haiku-4-5-20251001"'::jsonb, false),
  ('scraping.rate_limit', '10'::jsonb, false)
on conflict (key) do nothing;
