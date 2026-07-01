-- Security hardening (post-launch audit)
--   C-1: Drop get_scraping_config() — leaked the AI API key to any auth user.
--   M-1: friend_invites SELECT was USING (true) — any user could harvest every
--        invite token. Restrict to the owner and add a SECURITY DEFINER RPC so
--        the invite landing page can still resolve a single token safely.
--   M-2: household_invitations UPDATE had WITH CHECK (true) — constrain it so an
--        invitee can only move their own invitation through valid states.

-- ── C-1: Remove the API-key backdoor ────────────────────────────────────────
-- This SECURITY DEFINER function returned scraping.api_key (an app_settings row
-- marked sensitive) to any authenticated caller, only checking auth.uid() is not
-- null. It bypassed the admin-only RLS on that secret. Nothing uses it anymore —
-- the extract-recipe edge function reads the key server-side via the service
-- role — so it is a live back door and is dropped outright.
drop function if exists public.get_scraping_config();

-- ── M-1: Lock down friend_invites token lookup ──────────────────────────────
-- Old policy allowed every authenticated user to SELECT all rows, exposing all
-- unguessable invite tokens (which auto-send a friend request to their owner).
-- Owners keep read access to their own invite; token resolution for everyone
-- else goes through resolve_invite_token(), which returns only the owner's
-- public profile for a single valid, non-expired token.
drop policy if exists "friend_invites: authenticated can select" on public.friend_invites;

create policy "friend_invites: owner can select"
  on public.friend_invites for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.resolve_invite_token(p_token text)
returns table (
  id           uuid,
  display_name text,
  avatar_url   text,
  bio          text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.avatar_url, p.bio
  from public.friend_invites fi
  join public.profiles p on p.id = fi.user_id
  where fi.token = p_token
    and fi.expires_at > now()
  limit 1;
$$;

comment on function public.resolve_invite_token(text) is
  'Resolves a single friend-invite token to its owner''s public profile. '
  'Replaces broad SELECT access to friend_invites so tokens cannot be enumerated.';

-- Only signed-in users resolve invites; revoke the implicit PUBLIC grant.
revoke all on function public.resolve_invite_token(text) from public;
grant execute on function public.resolve_invite_token(text) to authenticated;

-- ── M-2: Constrain household_invitations UPDATE ─────────────────────────────
-- The MEA-227 fix corrected the USING clause but left WITH CHECK (true), letting
-- an email-matched invitee rewrite the row to arbitrary values. Restrict the
-- post-update row: owners may still edit their own invites; an invitee may only
-- leave the invitation in a valid enum state (accept / decline / keep pending).
drop policy if exists "household_invitations: invited_by or invitee can update"
  on public.household_invitations;

create policy "household_invitations: invited_by or invitee can update"
  on public.household_invitations for update
  to authenticated
  using (
    invited_by = auth.uid()
    or invitee_email = (select email from auth.users where id = auth.uid())
  )
  with check (
    invited_by = auth.uid()
    or (
      invitee_email = (select email from auth.users where id = auth.uid())
      and status in ('pending', 'accepted', 'declined')
    )
  );
