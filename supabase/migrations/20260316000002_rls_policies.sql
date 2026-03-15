-- ─── Row-Level Security policies ─────────────────────────────────────────────
-- Enable RLS on every table, then define per-table policies.
-- All social data is auth-gated; unauthenticated users get nothing.

-- ─── Enable RLS ──────────────────────────────────────────────────────────────

alter table public.profiles       enable row level security;
alter table public.recipes_cloud  enable row level security;
alter table public.friendships    enable row level security;
alter table public.reactions      enable row level security;
alter table public.comments       enable row level security;
alter table public.ratings        enable row level security;
alter table public.notifications  enable row level security;

-- ─── Helper: are two users friends? ─────────────────────────────────────────

create or replace function public.are_friends(user_a uuid, user_b uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and (
        (requester_id = user_a and addressee_id = user_b) or
        (requester_id = user_b and addressee_id = user_a)
      )
  );
$$;

-- ─── profiles ────────────────────────────────────────────────────────────────

-- Any signed-in user can read any profile (needed for friend search).
create policy "profiles: authenticated users can read"
  on public.profiles for select
  to authenticated
  using (true);

-- Users can only write their own profile.
create policy "profiles: owner can insert"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "profiles: owner can update"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ─── recipes_cloud ────────────────────────────────────────────────────────────

-- Public recipes visible to everyone authenticated.
-- Friends-only recipes visible to the author + their accepted friends.
-- Private recipes visible to the author only.
create policy "recipes_cloud: visibility select"
  on public.recipes_cloud for select
  to authenticated
  using (
    visibility = 'public'
    or author_id = auth.uid()
    or (visibility = 'friends' and public.are_friends(author_id, auth.uid()))
  );

create policy "recipes_cloud: owner can insert"
  on public.recipes_cloud for insert
  to authenticated
  with check (author_id = auth.uid());

create policy "recipes_cloud: owner can update"
  on public.recipes_cloud for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "recipes_cloud: owner can delete"
  on public.recipes_cloud for delete
  to authenticated
  using (author_id = auth.uid());

-- ─── friendships ─────────────────────────────────────────────────────────────

-- Users can see requests they sent or received.
create policy "friendships: parties can select"
  on public.friendships for select
  to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- Only the requester initiates.
create policy "friendships: requester can insert"
  on public.friendships for insert
  to authenticated
  with check (requester_id = auth.uid());

-- Only the addressee can accept/block; the requester can cancel (delete).
create policy "friendships: addressee can update"
  on public.friendships for update
  to authenticated
  using (addressee_id = auth.uid())
  with check (addressee_id = auth.uid());

create policy "friendships: requester can delete"
  on public.friendships for delete
  to authenticated
  using (requester_id = auth.uid());

-- ─── reactions ───────────────────────────────────────────────────────────────

-- Reactions on a recipe are visible if the underlying recipe is visible.
-- We re-use the visibility logic via a join.
create policy "reactions: visible with recipe"
  on public.reactions for select
  to authenticated
  using (
    exists (
      select 1 from public.recipes_cloud r
      where r.id = recipe_id
        and (
          r.visibility = 'public'
          or r.author_id = auth.uid()
          or (r.visibility = 'friends' and public.are_friends(r.author_id, auth.uid()))
        )
    )
  );

create policy "reactions: user can insert own"
  on public.reactions for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "reactions: user can delete own"
  on public.reactions for delete
  to authenticated
  using (user_id = auth.uid());

-- ─── comments ────────────────────────────────────────────────────────────────

create policy "comments: visible with recipe"
  on public.comments for select
  to authenticated
  using (
    exists (
      select 1 from public.recipes_cloud r
      where r.id = recipe_id
        and (
          r.visibility = 'public'
          or r.author_id = auth.uid()
          or (r.visibility = 'friends' and public.are_friends(r.author_id, auth.uid()))
        )
    )
  );

create policy "comments: user can insert own"
  on public.comments for insert
  to authenticated
  with check (user_id = auth.uid());

-- Authors can soft-delete their own comments (set deleted_at).
-- Recipe owners can also soft-delete comments on their recipes.
create policy "comments: user can update own"
  on public.comments for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── ratings ─────────────────────────────────────────────────────────────────

create policy "ratings: visible with recipe"
  on public.ratings for select
  to authenticated
  using (
    exists (
      select 1 from public.recipes_cloud r
      where r.id = recipe_id
        and (
          r.visibility = 'public'
          or r.author_id = auth.uid()
          or (r.visibility = 'friends' and public.are_friends(r.author_id, auth.uid()))
        )
    )
  );

create policy "ratings: user can insert own"
  on public.ratings for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "ratings: user can update own"
  on public.ratings for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "ratings: user can delete own"
  on public.ratings for delete
  to authenticated
  using (user_id = auth.uid());

-- ─── notifications ────────────────────────────────────────────────────────────

-- Users can only see their own notifications.
create policy "notifications: owner can select"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

-- Only the backend (service role) inserts notifications.
-- No insert policy for the anon/authenticated role.

create policy "notifications: owner can update (mark read)"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
