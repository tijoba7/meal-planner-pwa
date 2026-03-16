-- ─── Admin role: profiles.role column + RLS policies ─────────────────────────
-- MEA-168: Admin Foundation Phase 1
-- Adds a `role` column to profiles, a security-definer helper function
-- `is_admin()` usable in RLS policies, and admin-bypass policies on profiles.

-- ─── Enum ────────────────────────────────────────────────────────────────────

create type public.user_role as enum ('user', 'admin');

-- ─── profiles.role column ─────────────────────────────────────────────────────

alter table public.profiles
  add column role public.user_role not null default 'user';

comment on column public.profiles.role is
  'Authorization role. ''admin'' grants access to the admin panel and gated RLS operations. Promote via SQL (see bootstrap note below).';

-- ─── is_admin() helper ────────────────────────────────────────────────────────
-- Security definer so RLS policies can call it without hitting recursive RLS
-- on the profiles table. search_path locked to prevent search-path injection.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

comment on function public.is_admin() is
  'Returns true when the currently authenticated user has role = ''admin''.';

-- ─── Admin RLS policies on profiles ──────────────────────────────────────────
-- Existing owner-only policies remain. These add permissive admin overrides
-- (Postgres ORs permissive policies within the same command).

-- Admins can update any profile (e.g. to promote/demote roles).
-- Deliberately scoped to UPDATE so admins cannot delete other users' profiles.
create policy "profiles: admin can update any"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ─── Bootstrap: first admin ───────────────────────────────────────────────────
-- There is no admin yet after this migration runs. Promote the first admin
-- using the Supabase SQL editor (or a one-time seed script) with service role:
--
--   update public.profiles
--   set role = 'admin'
--   where id = (
--     select id from auth.users where email = 'your-admin@example.com'
--   );
--
-- In local dev you can also set INITIAL_ADMIN_EMAIL and run:
--   pnpm supabase:seed
-- (see supabase/seed.sql for the seed logic)
