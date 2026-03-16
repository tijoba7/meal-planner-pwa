-- ─── Friend invite links ──────────────────────────────────────────────────────
-- Shareable tokens that auto-send a friend request when a signed-in user visits
-- /invite/:token, or queue a request on sign-up if not yet authenticated.

create table public.friend_invites (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  token      text not null unique default encode(gen_random_bytes(24), 'base64url'),
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);

comment on table public.friend_invites is
  'Shareable invite tokens. Visiting /invite/:token auto-sends a friend request.';

create index friend_invites_user_id_idx on public.friend_invites (user_id);

alter table public.friend_invites enable row level security;

-- Any authenticated user can look up a token (required to process incoming invites).
create policy "friend_invites: authenticated can select"
  on public.friend_invites for select
  to authenticated
  using (true);

-- Users can only create invites for themselves.
create policy "friend_invites: owner can insert"
  on public.friend_invites for insert
  to authenticated
  with check (user_id = auth.uid());

-- Users can revoke their own invite links.
create policy "friend_invites: owner can delete"
  on public.friend_invites for delete
  to authenticated
  using (user_id = auth.uid());

-- ─── Extend friendships RLS: addressee can also delete (reject) ───────────────
-- The initial schema only allowed the requester to delete (cancel).
-- The addressee also needs to be able to delete to decline/reject a request.

create policy "friendships: addressee can delete (reject)"
  on public.friendships for delete
  to authenticated
  using (addressee_id = auth.uid());
