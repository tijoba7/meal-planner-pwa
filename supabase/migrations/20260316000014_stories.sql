-- ─── Stories table ───────────────────────────────────────────────────────────
-- MEA-176: 24-hour ephemeral stories (Instagram-style).
-- Stories can optionally link to a recipe but don't require one.
-- Expiration is enforced client-side via expires_at filter.

create table public.stories (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  media_url        text not null,
  caption          text check (caption is null or char_length(caption) between 1 and 300),
  linked_recipe_id uuid references public.recipes_cloud (id) on delete set null,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default (now() + interval '24 hours')
);

comment on table public.stories is
  'Ephemeral cooking stories. Expire after 24 hours (client-side filter on expires_at).';

create index stories_user_id_idx on public.stories (user_id);
create index stories_expires_at_idx on public.stories (expires_at);

-- ─── RLS ────────────────────────────────────────────────────────────────────

alter table public.stories enable row level security;

-- Friends + author can view non-expired stories.
create policy "stories: friends and author can view"
  on public.stories for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.are_friends(user_id, auth.uid())
  );

-- Owner can create their own stories.
create policy "stories: owner can insert"
  on public.stories for insert
  to authenticated
  with check (user_id = auth.uid());

-- Owner can delete their own stories.
create policy "stories: owner can delete"
  on public.stories for delete
  to authenticated
  using (user_id = auth.uid());
