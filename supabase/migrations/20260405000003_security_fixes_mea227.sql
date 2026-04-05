-- Security fixes from MEA-227 audit (MEA-209)
-- M-1: is_household_member() SECURITY DEFINER missing SET search_path = public
-- M-3: household_invitations UPDATE policy compares UUID to email
-- M-5: Stories expires_at not enforced server-side in SELECT policy

-- ── M-1: Lock search_path on is_household_member() ──────────────────────────
-- Without SET search_path, a SECURITY DEFINER function can be exploited via
-- search_path hijacking (same class of bug fixed for are_friends() in migration 18).

create or replace function public.is_household_member(p_household_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household_id
      and user_id = p_user_id
  );
$$;

-- ── M-3: Fix household_invitations UPDATE policy ─────────────────────────────
-- Bug: policy compared invitee_email to auth.uid()::text (UUID), not to the
-- user's actual email address, so invitees could never accept/decline.
-- Fix: compare to auth.users.email via a subselect.

drop policy if exists "household_invitations: invited_by or invitee can update"
  on public.household_invitations;

create policy "household_invitations: invited_by or invitee can update"
  on public.household_invitations for update
  to authenticated
  using (
    invited_by = auth.uid()
    or invitee_email = (select email from auth.users where id = auth.uid())
  )
  with check (true);

-- ── M-5: Enforce stories expires_at server-side ──────────────────────────────
-- The original SELECT policy relied on clients to filter expired stories.
-- A malicious client could omit the filter and read stories past their TTL.
-- Fix: add AND expires_at > now() to the server-side RLS policy.

drop policy if exists "stories: friends and author can view"
  on public.stories;

create policy "stories: friends and author can view"
  on public.stories for select
  to authenticated
  using (
    expires_at > now()
    and (
      user_id = auth.uid()
      or public.are_friends(user_id, auth.uid())
    )
  );
