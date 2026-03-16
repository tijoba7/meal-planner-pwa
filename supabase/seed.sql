-- ─── Supabase seed: development bootstrap ────────────────────────────────────
-- Run via: pnpm supabase db seed  (or apply manually in the SQL editor)
--
-- Promotes the first admin by matching INITIAL_ADMIN_EMAIL.
-- Set that variable in your .env.local before running.
-- Safe to run multiple times (upsert semantics via WHERE + no-op if no match).

do $$
declare
  v_email text := current_setting('app.initial_admin_email', true);
  v_user_id uuid;
begin
  if v_email is null or v_email = '' then
    raise notice 'INITIAL_ADMIN_EMAIL not set — skipping first-admin bootstrap.';
    return;
  end if;

  select id into v_user_id
  from auth.users
  where email = v_email
  limit 1;

  if v_user_id is null then
    raise notice 'No auth.users row found for email % — skipping.', v_email;
    return;
  end if;

  update public.profiles
  set role = 'admin'
  where id = v_user_id;

  raise notice 'Promoted % (%) to admin.', v_email, v_user_id;
end;
$$;
