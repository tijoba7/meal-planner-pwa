-- ─── Initial schema: Mise social platform ───────────────────────────────────
-- Run this migration in the Supabase SQL editor or via the Supabase CLI.
-- Order matters: referenced tables must exist before foreign keys are added.

-- ─── Enums ───────────────────────────────────────────────────────────────────

do $$ begin
  create type public.recipe_visibility as enum ('private', 'friends', 'public');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.friendship_status as enum ('pending', 'accepted', 'blocked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.reaction_type as enum ('like', 'bookmark', 'emoji');
exception when duplicate_object then null; end $$;

-- ─── profiles ────────────────────────────────────────────────────────────────
-- Extends auth.users. One row per authenticated user.

create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  display_name   text not null,
  avatar_url     text,
  bio            text,
  dietary_preferences text[] not null default '{}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.profiles is
  'Public user profile. Extends auth.users; created automatically on sign-up.';

-- Auto-create a profile row when a new user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── recipes_cloud ────────────────────────────────────────────────────────────
-- Cloud copy of a user's recipe (Schema.org format stored as jsonb).

create table if not exists public.recipes_cloud (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references public.profiles (id) on delete cascade,
  data         jsonb not null,
  visibility   public.recipe_visibility not null default 'private',
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.recipes_cloud is
  'Cloud-synced recipes. data column stores Schema.org Recipe JSON.';

create index if not exists recipes_cloud_author_id_idx on public.recipes_cloud (author_id);
create index if not exists recipes_cloud_visibility_idx on public.recipes_cloud (visibility);

-- ─── friendships ─────────────────────────────────────────────────────────────

create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status       public.friendship_status not null default 'pending',
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  constraint friendships_no_self_friend check (requester_id <> addressee_id),
  constraint friendships_unique_pair unique (requester_id, addressee_id)
);

comment on table public.friendships is
  'Directed friendship/follow requests. Mutual acceptance = friends.';

create index if not exists friendships_requester_idx on public.friendships (requester_id);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);

-- ─── reactions ───────────────────────────────────────────────────────────────

create table if not exists public.reactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  recipe_id  uuid not null references public.recipes_cloud (id) on delete cascade,
  type       public.reaction_type not null,
  emoji_code text,
  created_at timestamptz not null default now(),
  constraint reactions_emoji_required check (type <> 'emoji' or emoji_code is not null),
  constraint reactions_unique_per_type unique (user_id, recipe_id, type)
);

comment on table public.reactions is
  'User reactions on cloud recipes: like, bookmark, or named emoji.';

create index if not exists reactions_recipe_id_idx on public.reactions (recipe_id);

-- ─── comments ────────────────────────────────────────────────────────────────

create table if not exists public.comments (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  recipe_id         uuid not null references public.recipes_cloud (id) on delete cascade,
  parent_comment_id uuid references public.comments (id) on delete set null,
  body              text not null check (char_length(body) between 1 and 4000),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

comment on table public.comments is
  'Threaded comments on cloud recipes. Soft-delete via deleted_at.';

create index if not exists comments_recipe_id_idx on public.comments (recipe_id);
create index if not exists comments_parent_id_idx on public.comments (parent_comment_id);

-- ─── ratings ─────────────────────────────────────────────────────────────────

create table if not exists public.ratings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  recipe_id  uuid not null references public.recipes_cloud (id) on delete cascade,
  score      smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  constraint ratings_unique_per_user unique (user_id, recipe_id)
);

comment on table public.ratings is
  'Star ratings (1-5) on cloud recipes, one per user per recipe.';

create index if not exists ratings_recipe_id_idx on public.ratings (recipe_id);

-- ─── notifications ────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null,
  payload    jsonb not null default '{}',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.notifications is
  'In-app notifications. type examples: friend_request, recipe_reaction, comment.';

create index if not exists notifications_user_id_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

-- ─── updated_at trigger helper ────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_recipes_cloud_updated_at on public.recipes_cloud;
create trigger set_recipes_cloud_updated_at
  before update on public.recipes_cloud
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_comments_updated_at on public.comments;
create trigger set_comments_updated_at
  before update on public.comments
  for each row execute procedure public.set_updated_at();
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
drop policy if exists "profiles: authenticated users can read" on public.profiles;
create policy "profiles: authenticated users can read"
  on public.profiles for select
  to authenticated
  using (true);

-- Users can only write their own profile.
drop policy if exists "profiles: owner can insert" on public.profiles;
create policy "profiles: owner can insert"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles: owner can update" on public.profiles;
create policy "profiles: owner can update"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ─── recipes_cloud ────────────────────────────────────────────────────────────

-- Public recipes visible to everyone authenticated.
-- Friends-only recipes visible to the author + their accepted friends.
-- Private recipes visible to the author only.
drop policy if exists "recipes_cloud: visibility select" on public.recipes_cloud;
create policy "recipes_cloud: visibility select"
  on public.recipes_cloud for select
  to authenticated
  using (
    visibility = 'public'
    or author_id = auth.uid()
    or (visibility = 'friends' and public.are_friends(author_id, auth.uid()))
  );

drop policy if exists "recipes_cloud: owner can insert" on public.recipes_cloud;
create policy "recipes_cloud: owner can insert"
  on public.recipes_cloud for insert
  to authenticated
  with check (author_id = auth.uid());

drop policy if exists "recipes_cloud: owner can update" on public.recipes_cloud;
create policy "recipes_cloud: owner can update"
  on public.recipes_cloud for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists "recipes_cloud: owner can delete" on public.recipes_cloud;
create policy "recipes_cloud: owner can delete"
  on public.recipes_cloud for delete
  to authenticated
  using (author_id = auth.uid());

-- ─── friendships ─────────────────────────────────────────────────────────────

-- Users can see requests they sent or received.
drop policy if exists "friendships: parties can select" on public.friendships;
create policy "friendships: parties can select"
  on public.friendships for select
  to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- Only the requester initiates.
drop policy if exists "friendships: requester can insert" on public.friendships;
create policy "friendships: requester can insert"
  on public.friendships for insert
  to authenticated
  with check (requester_id = auth.uid());

-- Only the addressee can accept/block; the requester can cancel (delete).
drop policy if exists "friendships: addressee can update" on public.friendships;
create policy "friendships: addressee can update"
  on public.friendships for update
  to authenticated
  using (addressee_id = auth.uid())
  with check (addressee_id = auth.uid());

drop policy if exists "friendships: requester can delete" on public.friendships;
create policy "friendships: requester can delete"
  on public.friendships for delete
  to authenticated
  using (requester_id = auth.uid());

-- ─── reactions ───────────────────────────────────────────────────────────────

-- Reactions on a recipe are visible if the underlying recipe is visible.
-- We re-use the visibility logic via a join.
drop policy if exists "reactions: visible with recipe" on public.reactions;
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

drop policy if exists "reactions: user can insert own" on public.reactions;
create policy "reactions: user can insert own"
  on public.reactions for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "reactions: user can delete own" on public.reactions;
create policy "reactions: user can delete own"
  on public.reactions for delete
  to authenticated
  using (user_id = auth.uid());

-- ─── comments ────────────────────────────────────────────────────────────────

drop policy if exists "comments: visible with recipe" on public.comments;
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

drop policy if exists "comments: user can insert own" on public.comments;
create policy "comments: user can insert own"
  on public.comments for insert
  to authenticated
  with check (user_id = auth.uid());

-- Authors can soft-delete their own comments (set deleted_at).
-- Recipe owners can also soft-delete comments on their recipes.
drop policy if exists "comments: user can update own" on public.comments;
create policy "comments: user can update own"
  on public.comments for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── ratings ─────────────────────────────────────────────────────────────────

drop policy if exists "ratings: visible with recipe" on public.ratings;
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

drop policy if exists "ratings: user can insert own" on public.ratings;
create policy "ratings: user can insert own"
  on public.ratings for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "ratings: user can update own" on public.ratings;
create policy "ratings: user can update own"
  on public.ratings for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "ratings: user can delete own" on public.ratings;
create policy "ratings: user can delete own"
  on public.ratings for delete
  to authenticated
  using (user_id = auth.uid());

-- ─── notifications ────────────────────────────────────────────────────────────

-- Users can only see their own notifications.
drop policy if exists "notifications: owner can select" on public.notifications;
create policy "notifications: owner can select"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

-- Only the backend (service role) inserts notifications.
-- No insert policy for the anon/authenticated role.

drop policy if exists "notifications: owner can update (mark read)" on public.notifications;
create policy "notifications: owner can update (mark read)"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
-- ─── Cloud sync tables for meal plans and shopping lists ──────────────────────
-- Enables bidirectional sync for all three data types (recipes already exist).
-- Also adds the three tables to supabase_realtime so devices receive live updates.

-- ─── meal_plans_cloud ─────────────────────────────────────────────────────────

create table if not exists public.meal_plans_cloud (
  id         uuid primary key,
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.meal_plans_cloud is
  'Cloud-synced meal plans. data column stores the full MealPlan JSON.';

create index if not exists meal_plans_cloud_owner_idx on public.meal_plans_cloud (owner_id);

drop trigger if exists set_meal_plans_cloud_updated_at on public.meal_plans_cloud;
create trigger set_meal_plans_cloud_updated_at
  before update on public.meal_plans_cloud
  for each row execute procedure public.set_updated_at();

-- ─── shopping_lists_cloud ─────────────────────────────────────────────────────

create table if not exists public.shopping_lists_cloud (
  id         uuid primary key,
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.shopping_lists_cloud is
  'Cloud-synced shopping lists. data column stores the full ShoppingList JSON.';

create index if not exists shopping_lists_cloud_owner_idx on public.shopping_lists_cloud (owner_id);

drop trigger if exists set_shopping_lists_cloud_updated_at on public.shopping_lists_cloud;
create trigger set_shopping_lists_cloud_updated_at
  before update on public.shopping_lists_cloud
  for each row execute procedure public.set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.meal_plans_cloud enable row level security;

drop policy if exists "Users can manage their own meal plans" on public.meal_plans_cloud;
create policy "Users can manage their own meal plans"
  on public.meal_plans_cloud
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

alter table public.shopping_lists_cloud enable row level security;

drop policy if exists "Users can manage their own shopping lists" on public.shopping_lists_cloud;
create policy "Users can manage their own shopping lists"
  on public.shopping_lists_cloud
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ─── Realtime ─────────────────────────────────────────────────────────────────
-- Add all three sync tables to the Realtime publication so that connected
-- clients receive INSERT / UPDATE / DELETE events.

alter publication supabase_realtime add table public.recipes_cloud;
alter publication supabase_realtime add table public.meal_plans_cloud;
alter publication supabase_realtime add table public.shopping_lists_cloud;
-- ─── Storage: recipe-images bucket and RLS policies ──────────────────────────
-- Public bucket: any authenticated user can read; users write only their own folder.
-- Path convention: {user_id}/{recipe_id}/original.webp  (full image)
--                  {user_id}/{recipe_id}/thumb.webp      (thumbnail)

-- ─── Create bucket ────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-images',
  'recipe-images',
  true,
  5242880,  -- 5 MB max per file
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do nothing;

-- ─── Storage policies ─────────────────────────────────────────────────────────

-- Public read (the bucket is public, but be explicit).
drop policy if exists "recipe-images: public read" on storage.objects;
create policy "recipe-images: public read"
  on storage.objects for select
  to public
  using (bucket_id = 'recipe-images');

-- Authenticated users can upload to their own folder only.
-- Path must start with the caller's user ID.
drop policy if exists "recipe-images: owner can upload" on storage.objects;
create policy "recipe-images: owner can upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can replace (upsert) their own images.
drop policy if exists "recipe-images: owner can update" on storage.objects;
create policy "recipe-images: owner can update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can delete their own images.
drop policy if exists "recipe-images: owner can delete" on storage.objects;
create policy "recipe-images: owner can delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
-- ─── Collaborative meal planning: households ──────────────────────────────────
-- A household is a named group of users who share meal plans.
-- Members can co-edit shared plans; changes propagate via Supabase Realtime.
-- Invitation flow: owner invites by email → invitee accepts via secure token.

-- ─── Enums ───────────────────────────────────────────────────────────────────

do $$ begin
  create type public.household_member_role as enum ('owner', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.household_invitation_status as enum ('pending', 'accepted', 'declined', 'expired');
exception when duplicate_object then null; end $$;

-- ─── households ───────────────────────────────────────────────────────────────

create table if not exists public.households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 100),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.households is
  'A named group of users (household) who share meal plans.';

create index if not exists households_created_by_idx on public.households (created_by);

drop trigger if exists set_households_updated_at on public.households;
create trigger set_households_updated_at
  before update on public.households
  for each row execute procedure public.set_updated_at();

-- ─── household_members ────────────────────────────────────────────────────────

create table if not exists public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         public.household_member_role not null default 'member',
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

comment on table public.household_members is
  'Membership of users in households. role=owner can invite/remove; role=member can view and co-edit.';

create index if not exists household_members_user_id_idx on public.household_members (user_id);

-- ─── household_invitations ────────────────────────────────────────────────────

create table if not exists public.household_invitations (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  invited_by   uuid not null references public.profiles (id) on delete cascade,
  invitee_email text not null,
  token        text not null unique default encode(gen_random_bytes(32), 'hex'),
  status       public.household_invitation_status not null default 'pending',
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '7 days')
);

comment on table public.household_invitations is
  'Pending household invitations. Token is sent to invitee; expires after 7 days.';

create index if not exists household_invitations_household_id_idx on public.household_invitations (household_id);
create index if not exists household_invitations_invitee_email_idx on public.household_invitations (invitee_email);
create index if not exists household_invitations_token_idx on public.household_invitations (token);

-- ─── meal_plans_cloud: add household_id ───────────────────────────────────────

alter table public.meal_plans_cloud
  add column if not exists household_id uuid references public.households (id) on delete set null;

create index if not exists meal_plans_cloud_household_id_idx
  on public.meal_plans_cloud (household_id)
  where household_id is not null;

-- ─── Helper: is a user a member of a household? ───────────────────────────────

create or replace function public.is_household_member(p_household_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household_id
      and user_id = p_user_id
  );
$$;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invitations enable row level security;

-- households: any member can read; only creator can write/delete
drop policy if exists "households: members can select" on public.households;
create policy "households: members can select"
  on public.households for select
  to authenticated
  using (public.is_household_member(id, auth.uid()));

drop policy if exists "households: creator can insert" on public.households;
create policy "households: creator can insert"
  on public.households for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "households: creator can update" on public.households;
create policy "households: creator can update"
  on public.households for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "households: creator can delete" on public.households;
create policy "households: creator can delete"
  on public.households for delete
  to authenticated
  using (created_by = auth.uid());

-- household_members: any member can see the full member list
drop policy if exists "household_members: members can select" on public.household_members;
create policy "household_members: members can select"
  on public.household_members for select
  to authenticated
  using (public.is_household_member(household_id, auth.uid()));

-- Insert allowed for:
--   • owner adding someone else
--   • the user adding themselves (via invitation acceptance)
drop policy if exists "household_members: owner or self can insert" on public.household_members;
create policy "household_members: owner or self can insert"
  on public.household_members for insert
  to authenticated
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.households h
      where h.id = household_id
        and h.created_by = auth.uid()
    )
  );

-- Delete allowed for:
--   • a member leaving themselves
--   • the household owner removing someone
drop policy if exists "household_members: owner or self can delete" on public.household_members;
create policy "household_members: owner or self can delete"
  on public.household_members for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.households h
      where h.id = household_id
        and h.created_by = auth.uid()
    )
  );

-- household_invitations: household members and the invited (by email) can read
drop policy if exists "household_invitations: members can select" on public.household_invitations;
create policy "household_invitations: members can select"
  on public.household_invitations for select
  to authenticated
  using (
    invited_by = auth.uid()
    or public.is_household_member(household_id, auth.uid())
  );

-- Only the household owner (creator) can send invitations
drop policy if exists "household_invitations: owner can insert" on public.household_invitations;
create policy "household_invitations: owner can insert"
  on public.household_invitations for insert
  to authenticated
  with check (
    invited_by = auth.uid()
    and exists (
      select 1 from public.households h
      where h.id = household_id
        and h.created_by = auth.uid()
    )
  );

-- Inviter can cancel (update); acceptee/decliner updates happen via service role
-- Allow the invitee (matched by email from their profile) to update status
drop policy if exists "household_invitations: invited_by or invitee can update" on public.household_invitations;
create policy "household_invitations: invited_by or invitee can update"
  on public.household_invitations for update
  to authenticated
  using (
    invited_by = auth.uid()
    or invitee_email = (select p.id::text from public.profiles p where p.id = auth.uid() limit 1)
  )
  with check (true);

-- ─── Update meal_plans_cloud RLS ──────────────────────────────────────────────
-- Replace the broad "all" policy with fine-grained policies that let household
-- members read and co-edit shared plans.

drop policy if exists "Users can manage their own meal plans" on public.meal_plans_cloud;

-- SELECT: owner always; household members when a household_id is set
drop policy if exists "meal_plans_cloud: owner or household member can select" on public.meal_plans_cloud;
create policy "meal_plans_cloud: owner or household member can select"
  on public.meal_plans_cloud for select
  to authenticated
  using (
    owner_id = auth.uid()
    or (
      household_id is not null
      and public.is_household_member(household_id, auth.uid())
    )
  );

-- INSERT: only owner
drop policy if exists "meal_plans_cloud: owner can insert" on public.meal_plans_cloud;
create policy "meal_plans_cloud: owner can insert"
  on public.meal_plans_cloud for insert
  to authenticated
  with check (owner_id = auth.uid());

-- UPDATE: owner always; any household member for shared plans
drop policy if exists "meal_plans_cloud: owner or household member can update" on public.meal_plans_cloud;
create policy "meal_plans_cloud: owner or household member can update"
  on public.meal_plans_cloud for update
  to authenticated
  using (
    owner_id = auth.uid()
    or (
      household_id is not null
      and public.is_household_member(household_id, auth.uid())
    )
  )
  with check (
    owner_id = auth.uid()
    or (
      household_id is not null
      and public.is_household_member(household_id, auth.uid())
    )
  );

-- DELETE: only owner
drop policy if exists "meal_plans_cloud: owner can delete" on public.meal_plans_cloud;
create policy "meal_plans_cloud: owner can delete"
  on public.meal_plans_cloud for delete
  to authenticated
  using (owner_id = auth.uid());

-- ─── Realtime ─────────────────────────────────────────────────────────────────
-- Publish household tables so members get live membership and plan updates.

alter publication supabase_realtime add table public.households;
alter publication supabase_realtime add table public.household_members;
alter publication supabase_realtime add table public.household_invitations;
-- ─── Friend invite links ──────────────────────────────────────────────────────
-- Shareable tokens that auto-send a friend request when a signed-in user visits
-- /invite/:token, or queue a request on sign-up if not yet authenticated.

create table if not exists public.friend_invites (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  token      text not null unique default encode(gen_random_bytes(24), 'base64url'),
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);

comment on table public.friend_invites is
  'Shareable invite tokens. Visiting /invite/:token auto-sends a friend request.';

create index if not exists friend_invites_user_id_idx on public.friend_invites (user_id);

alter table public.friend_invites enable row level security;

-- Any authenticated user can look up a token (required to process incoming invites).
drop policy if exists "friend_invites: authenticated can select" on public.friend_invites;
create policy "friend_invites: authenticated can select"
  on public.friend_invites for select
  to authenticated
  using (true);

-- Users can only create invites for themselves.
drop policy if exists "friend_invites: owner can insert" on public.friend_invites;
create policy "friend_invites: owner can insert"
  on public.friend_invites for insert
  to authenticated
  with check (user_id = auth.uid());

-- Users can revoke their own invite links.
drop policy if exists "friend_invites: owner can delete" on public.friend_invites;
create policy "friend_invites: owner can delete"
  on public.friend_invites for delete
  to authenticated
  using (user_id = auth.uid());

-- ─── Extend friendships RLS: addressee can also delete (reject) ───────────────
-- The initial schema only allowed the requester to delete (cancel).
-- The addressee also needs to be able to delete to decline/reject a request.

drop policy if exists "friendships: addressee can delete (reject)" on public.friendships;
create policy "friendships: addressee can delete (reject)"
  on public.friendships for delete
  to authenticated
  using (addressee_id = auth.uid());
-- ─── Input validation constraints ────────────────────────────────────────────
-- Enforce field length limits and content rules at the database layer.
-- These mirror RECIPE_FIELD_LIMITS in src/lib/validation.ts — keep in sync.

-- ─── profiles ────────────────────────────────────────────────────────────────

do $$ begin
  alter table public.profiles add constraint profiles_display_name_length
    check (char_length(display_name) between 1 and 100);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_bio_length
    check (bio is null or char_length(bio) <= 500);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_avatar_url_length
    check (avatar_url is null or char_length(avatar_url) <= 2048);
exception when duplicate_object then null; end $$;

-- ─── recipes_cloud ────────────────────────────────────────────────────────────
-- The `data` column is jsonb. Enforce a reasonable size cap to prevent
-- oversized payloads from being stored (protects storage and query perf).

do $$ begin
  alter table public.recipes_cloud add constraint recipes_cloud_data_size
    check (octet_length(data::text) <= 524288); -- 512 KiB per recipe
exception when duplicate_object then null; end $$;

-- ─── friendships ─────────────────────────────────────────────────────────────
-- No additional field length constraints needed; PKs and enums already enforce integrity.

-- ─── reactions ───────────────────────────────────────────────────────────────

do $$ begin
  alter table public.reactions add constraint reactions_emoji_code_length
    check (emoji_code is null or char_length(emoji_code) <= 20);
exception when duplicate_object then null; end $$;

-- ─── comments ────────────────────────────────────────────────────────────────
-- Already has: check (char_length(body) between 1 and 4000) from initial schema.

-- ─── notifications ───────────────────────────────────────────────────────────

do $$ begin
  alter table public.notifications add constraint notifications_type_length
    check (char_length(type) between 1 and 100);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.notifications add constraint notifications_payload_size
    check (octet_length(payload::text) <= 65536); -- 64 KiB per notification
exception when duplicate_object then null; end $$;

-- ─── households (from migration 20260316000006) ───────────────────────────────
-- The household name constraint (1-100 chars) was added in migration 6.
-- No additional constraints needed here.
-- ─── Engagement: notification triggers and comment moderation ─────────────────
-- Adds:
--   1. RLS policy allowing recipe owners to soft-delete any comment on their recipe
--   2. Trigger: insert notification on new reaction (notifies recipe author)
--   3. Trigger: insert notification on new comment (notifies recipe author + parent author)

-- ─── Comment moderation: recipe owner can soft-delete any comment ─────────────

drop policy if exists "comments: recipe owner can moderate" on public.comments;
create policy "comments: recipe owner can moderate"
  on public.comments for update
  to authenticated
  using (
    exists (
      select 1 from public.recipes_cloud r
      where r.id = recipe_id and r.author_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.recipes_cloud r
      where r.id = recipe_id and r.author_id = auth.uid()
    )
  );

-- ─── Notification trigger: new reaction ──────────────────────────────────────
-- Fires after INSERT on reactions. Notifies the recipe author (not the reactor).

create or replace function public.notify_on_reaction()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_author_id uuid;
begin
  select author_id into v_author_id
  from public.recipes_cloud
  where id = NEW.recipe_id;

  -- Skip if recipe not found or reactor is the author
  if v_author_id is null or v_author_id = NEW.user_id then
    return NEW;
  end if;

  insert into public.notifications (user_id, type, payload)
  values (
    v_author_id,
    'recipe_reaction',
    jsonb_build_object(
      'reactor_id',    NEW.user_id,
      'recipe_id',     NEW.recipe_id,
      'reaction_type', NEW.type,
      'emoji_code',    NEW.emoji_code
    )
  );

  return NEW;
end;
$$;

drop trigger if exists on_reaction_created on public.reactions;
create trigger on_reaction_created
  after insert on public.reactions
  for each row execute procedure public.notify_on_reaction();

-- ─── Notification trigger: new comment ───────────────────────────────────────
-- Fires after INSERT on comments.
-- Notifies:
--   a) the recipe author (unless they are the commenter)
--   b) the parent comment author on replies (unless already notified as author above)

create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_author_id        uuid;
  v_parent_author_id uuid;
begin
  select author_id into v_author_id
  from public.recipes_cloud
  where id = NEW.recipe_id;

  -- Notify recipe author (unless they are the commenter)
  if v_author_id is not null and v_author_id <> NEW.user_id then
    insert into public.notifications (user_id, type, payload)
    values (
      v_author_id,
      'recipe_comment',
      jsonb_build_object(
        'commenter_id',      NEW.user_id,
        'recipe_id',         NEW.recipe_id,
        'comment_id',        NEW.id,
        'parent_comment_id', NEW.parent_comment_id
      )
    );
  end if;

  -- On replies, also notify the parent comment's author
  if NEW.parent_comment_id is not null then
    select user_id into v_parent_author_id
    from public.comments
    where id = NEW.parent_comment_id;

    -- Skip if parent author = commenter, or already notified as recipe author
    if v_parent_author_id is not null
       and v_parent_author_id <> NEW.user_id
       and v_parent_author_id is distinct from v_author_id
    then
      insert into public.notifications (user_id, type, payload)
      values (
        v_parent_author_id,
        'comment_reply',
        jsonb_build_object(
          'commenter_id',      NEW.user_id,
          'recipe_id',         NEW.recipe_id,
          'comment_id',        NEW.id,
          'parent_comment_id', NEW.parent_comment_id
        )
      );
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists on_comment_created on public.comments;
create trigger on_comment_created
  after insert on public.comments
  for each row execute procedure public.notify_on_comment();
-- ─── Groups / Circles ──────────────────────────────────────────────────────
-- Tables: groups, group_members, group_recipes
-- Groups let users create named circles (e.g. "Family", "Keto Friends"),
-- invite friends, and share cloud recipes within those circles.

-- ─── groups ──────────────────────────────────────────────────────────────────

create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 100),
  description text check (char_length(description) <= 500),
  avatar_url  text,
  created_by  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.groups is
  'Named recipe-sharing circles. Members are tracked in group_members.';

create index if not exists groups_created_by_idx on public.groups (created_by);

drop trigger if exists set_groups_updated_at on public.groups;
create trigger set_groups_updated_at
  before update on public.groups
  for each row execute procedure public.set_updated_at();

-- ─── group_members ────────────────────────────────────────────────────────────

create table if not exists public.group_members (
  group_id  uuid not null references public.groups (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  role      text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

comment on table public.group_members is
  'Membership roster for groups. role = admin | member.';

create index if not exists group_members_user_id_idx on public.group_members (user_id);

-- ─── group_recipes ────────────────────────────────────────────────────────────

create table if not exists public.group_recipes (
  id        uuid primary key default gen_random_uuid(),
  group_id  uuid not null references public.groups (id) on delete cascade,
  recipe_id uuid not null references public.recipes_cloud (id) on delete cascade,
  added_by  uuid not null references public.profiles (id) on delete cascade,
  added_at  timestamptz not null default now(),
  constraint group_recipes_unique unique (group_id, recipe_id)
);

comment on table public.group_recipes is
  'Recipes shared into a group. One row per (group, recipe) pair.';

create index if not exists group_recipes_group_id_idx on public.group_recipes (group_id);

-- ─── Auto-add creator as admin ───────────────────────────────────────────────
-- Fires after a group is inserted; adds the creator as the first admin.
-- Runs security definer so it bypasses group_members RLS.

create or replace function public.handle_group_created()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'admin');
  return new;
end;
$$;

drop trigger if exists on_group_created on public.groups;
create trigger on_group_created
  after insert on public.groups
  for each row execute procedure public.handle_group_created();

-- ─── Helper functions ─────────────────────────────────────────────────────────

create or replace function public.is_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_user_id
  );
$$;

create or replace function public.is_group_admin(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_user_id and role = 'admin'
  );
$$;

-- ─── RLS: groups ─────────────────────────────────────────────────────────────

alter table public.groups enable row level security;

-- Only members can see a group.
drop policy if exists "groups: members can select" on public.groups;
create policy "groups: members can select"
  on public.groups for select
  to authenticated
  using (public.is_group_member(id, auth.uid()));

-- Any authenticated user can create a group.
drop policy if exists "groups: authenticated can insert" on public.groups;
create policy "groups: authenticated can insert"
  on public.groups for insert
  to authenticated
  with check (created_by = auth.uid());

-- Only admins can update group details.
drop policy if exists "groups: admins can update" on public.groups;
create policy "groups: admins can update"
  on public.groups for update
  to authenticated
  using (public.is_group_admin(id, auth.uid()))
  with check (public.is_group_admin(id, auth.uid()));

-- Only admins can delete the group.
drop policy if exists "groups: admins can delete" on public.groups;
create policy "groups: admins can delete"
  on public.groups for delete
  to authenticated
  using (public.is_group_admin(id, auth.uid()));

-- ─── RLS: group_members ───────────────────────────────────────────────────────

alter table public.group_members enable row level security;

-- Members can see who else is in the group.
drop policy if exists "group_members: members can select" on public.group_members;
create policy "group_members: members can select"
  on public.group_members for select
  to authenticated
  using (public.is_group_member(group_id, auth.uid()));

-- Only group admins can add new members.
-- (The creator auto-join trigger runs security definer and bypasses this.)
drop policy if exists "group_members: admins can insert" on public.group_members;
create policy "group_members: admins can insert"
  on public.group_members for insert
  to authenticated
  with check (public.is_group_admin(group_id, auth.uid()));

-- Only admins can change member roles.
drop policy if exists "group_members: admins can update" on public.group_members;
create policy "group_members: admins can update"
  on public.group_members for update
  to authenticated
  using (public.is_group_admin(group_id, auth.uid()))
  with check (public.is_group_admin(group_id, auth.uid()));

-- Members can remove themselves (leave); admins can remove anyone.
drop policy if exists "group_members: self can delete (leave)" on public.group_members;
create policy "group_members: self can delete (leave)"
  on public.group_members for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "group_members: admins can delete (remove)" on public.group_members;
create policy "group_members: admins can delete (remove)"
  on public.group_members for delete
  to authenticated
  using (public.is_group_admin(group_id, auth.uid()));

-- ─── RLS: group_recipes ───────────────────────────────────────────────────────

alter table public.group_recipes enable row level security;

-- Only group members can see group recipes.
drop policy if exists "group_recipes: members can select" on public.group_recipes;
create policy "group_recipes: members can select"
  on public.group_recipes for select
  to authenticated
  using (public.is_group_member(group_id, auth.uid()));

-- Any group member can share a recipe into the group.
drop policy if exists "group_recipes: members can insert" on public.group_recipes;
create policy "group_recipes: members can insert"
  on public.group_recipes for insert
  to authenticated
  with check (
    public.is_group_member(group_id, auth.uid())
    and added_by = auth.uid()
  );

-- The adder or a group admin can remove a recipe from the group.
drop policy if exists "group_recipes: adder can delete" on public.group_recipes;
create policy "group_recipes: adder can delete"
  on public.group_recipes for delete
  to authenticated
  using (added_by = auth.uid());

drop policy if exists "group_recipes: admins can delete" on public.group_recipes;
create policy "group_recipes: admins can delete"
  on public.group_recipes for delete
  to authenticated
  using (public.is_group_admin(group_id, auth.uid()));
-- ─── Notification triggers: friends + group invites ──────────────────────────
-- Adds:
--   1. notification_muted_types column on profiles (opt-out preferences)
--   2. Trigger: notify on friend request (INSERT on friendships, status pending)
--   3. Trigger: notify on friend accepted (UPDATE on friendships, status accepted)
--   4. Trigger: notify on group invite (INSERT on group_members by another user)
--   5. Helper: check whether a user has muted a notification type

-- ─── Notification preferences ────────────────────────────────────────────────
-- Stores a list of type strings the user has muted (e.g. '{"recipe_reaction"}').

alter table public.profiles
  add column if not exists notification_muted_types text[] not null default '{}';

-- Helper: returns true if the given user has muted this notification type.
create or replace function public.is_notification_muted(
  p_user_id uuid,
  p_type    text
)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select p_type = any(notification_muted_types)
  from public.profiles
  where id = p_user_id;
$$;

-- ─── Trigger: friend request ──────────────────────────────────────────────────
-- Fires after INSERT on friendships (initial pending request).
-- Notifies the addressee that someone sent them a friend request.

create or replace function public.notify_on_friend_request()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Skip if addressee has muted this type
  if public.is_notification_muted(NEW.addressee_id, 'friend_request') then
    return NEW;
  end if;

  insert into public.notifications (user_id, type, payload)
  values (
    NEW.addressee_id,
    'friend_request',
    jsonb_build_object('requester_id', NEW.requester_id)
  );

  return NEW;
end;
$$;

drop trigger if exists on_friend_request_sent on public.friendships;
create trigger on_friend_request_sent
  after insert on public.friendships
  for each row
  when (NEW.status = 'pending')
  execute procedure public.notify_on_friend_request();

-- ─── Trigger: friend request accepted ────────────────────────────────────────
-- Fires after UPDATE on friendships when status changes to 'accepted'.
-- Notifies the original requester that their request was accepted.

create or replace function public.notify_on_friend_accepted()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Only act when status transitions to accepted
  if OLD.status = NEW.status then
    return NEW;
  end if;

  -- Skip if requester has muted this type
  if public.is_notification_muted(NEW.requester_id, 'friend_accepted') then
    return NEW;
  end if;

  insert into public.notifications (user_id, type, payload)
  values (
    NEW.requester_id,
    'friend_accepted',
    jsonb_build_object('acceptor_id', NEW.addressee_id)
  );

  return NEW;
end;
$$;

drop trigger if exists on_friend_request_accepted on public.friendships;
create trigger on_friend_request_accepted
  after update on public.friendships
  for each row
  when (NEW.status = 'accepted' AND OLD.status <> 'accepted')
  execute procedure public.notify_on_friend_accepted();

-- ─── Trigger: group invite ────────────────────────────────────────────────────
-- Fires after INSERT on group_members when someone else adds a user to a group.
-- Notifies the newly added member.

create or replace function public.notify_on_group_invite()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_group_name text;
  v_created_by uuid;
begin
  select name, created_by into v_group_name, v_created_by
  from public.groups
  where id = NEW.group_id;

  -- Skip if user added themselves (e.g. creator trigger)
  if v_created_by is not null and v_created_by = NEW.user_id then
    return NEW;
  end if;

  -- Skip if invitee has muted this type
  if public.is_notification_muted(NEW.user_id, 'group_invite') then
    return NEW;
  end if;

  insert into public.notifications (user_id, type, payload)
  values (
    NEW.user_id,
    'group_invite',
    jsonb_build_object(
      'inviter_id',  v_created_by,
      'group_id',    NEW.group_id,
      'group_name',  v_group_name
    )
  );

  return NEW;
end;
$$;

drop trigger if exists on_group_member_added on public.group_members;
create trigger on_group_member_added
  after insert on public.group_members
  for each row execute procedure public.notify_on_group_invite();
-- ─── Admin role: profiles.role column + RLS policies ─────────────────────────
-- MEA-168: Admin Foundation Phase 1
-- Adds a `role` column to profiles, a security-definer helper function
-- `is_admin()` usable in RLS policies, and admin-bypass policies on profiles.

-- ─── Enum ────────────────────────────────────────────────────────────────────

do $$ begin
  create type public.user_role as enum ('user', 'admin');
exception when duplicate_object then null; end $$;

-- ─── profiles.role column ─────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists role public.user_role not null default 'user';

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
drop policy if exists "profiles: admin can update any" on public.profiles;
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
-- ─── App settings table + RLS ─────────────────────────────────────────────────
-- MEA-169: App settings table + CRUD service (Phase 2 of Admin Panel MEA-167)
-- Stores admin-managed key/value pairs for app-wide configuration.
-- Keys: scraping.api_key, scraping.provider, scraping.model, scraping.rate_limit, etc.

-- ─── Table ────────────────────────────────────────────────────────────────────

create table if not exists public.app_settings (
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

drop trigger if exists app_settings_updated_at on public.app_settings;
create trigger app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.app_settings_set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.app_settings enable row level security;

-- Admins can read every key (sensitive or not).
drop policy if exists "app_settings: admin read all" on public.app_settings;
create policy "app_settings: admin read all"
  on public.app_settings for select
  to authenticated
  using (public.is_admin());

-- Regular authenticated users can read non-sensitive keys only.
drop policy if exists "app_settings: user read non-sensitive" on public.app_settings;
create policy "app_settings: user read non-sensitive"
  on public.app_settings for select
  to authenticated
  using (not sensitive);

-- Only admins can insert new settings.
drop policy if exists "app_settings: admin insert" on public.app_settings;
create policy "app_settings: admin insert"
  on public.app_settings for insert
  to authenticated
  with check (public.is_admin());

-- Only admins can update settings.
drop policy if exists "app_settings: admin update" on public.app_settings;
create policy "app_settings: admin update"
  on public.app_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Only admins can delete settings.
drop policy if exists "app_settings: admin delete" on public.app_settings;
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
-- ─── Auth configuration notes ────────────────────────────────────────────────
-- These settings are managed via the Supabase Dashboard:
--   Authentication > Providers > Email
--   Authentication > Providers > (OAuth providers)
--
-- Enable in the dashboard:
--   ✓ Email + password sign-up
--   ✓ Magic link (passwordless email)
--   ✓ Confirm email (recommended for production)
--
-- Optionally enable OAuth:
--   ✓ Google (requires Google Cloud credentials)
--   ✓ Apple  (requires Apple Developer credentials)
--
-- Site URL (set in Authentication > URL Configuration):
--   Development : http://localhost:5173
--   Production  : https://your-domain.com
--
-- Redirect URLs (also in URL Configuration — add both):
--   http://localhost:5173/**
--   https://your-domain.com/**

-- Rate limits on sensitive operations (adjust in Dashboard > Auth > Rate Limits):
--   Sign-ups             : 3 per hour per IP
--   Magic link emails    : 3 per hour per email
--   Password resets      : 3 per hour per email

-- ─── Storage bucket for recipe images ────────────────────────────────────────
-- Bucket and storage policies are defined above in the storage section.
-- The insert below is kept for compatibility; on conflict is a no-op.

insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;

-- ─── Direct Messages (MEA-189) ────────────────────────────────────────────────

create table if not exists public.direct_messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 2000),
  read_at      timestamptz,
  created_at   timestamptz not null default now(),
  constraint direct_messages_no_self_message check (sender_id <> recipient_id)
);

create index if not exists dm_sender_idx       on public.direct_messages (sender_id,    created_at desc);
create index if not exists dm_recipient_idx    on public.direct_messages (recipient_id, created_at desc);
create index if not exists dm_conversation_idx on public.direct_messages (
  least(sender_id, recipient_id),
  greatest(sender_id, recipient_id),
  created_at desc
);

alter table public.direct_messages enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'direct_messages' and policyname = 'dm: participants can select'
  ) then
    create policy "dm: participants can select"
      on public.direct_messages for select
      to authenticated
      using (sender_id = auth.uid() or recipient_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'direct_messages' and policyname = 'dm: sender can insert'
  ) then
    create policy "dm: sender can insert"
      on public.direct_messages for insert
      to authenticated
      with check (sender_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'direct_messages' and policyname = 'dm: recipient can mark read'
  ) then
    create policy "dm: recipient can mark read"
      on public.direct_messages for update
      to authenticated
      using (recipient_id = auth.uid())
      with check (recipient_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'direct_messages' and policyname = 'dm: participants can delete'
  ) then
    create policy "dm: participants can delete"
      on public.direct_messages for delete
      to authenticated
      using (sender_id = auth.uid() or recipient_id = auth.uid());
  end if;
end $$;

create or replace function public.on_direct_message_created()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_notification_muted(new.recipient_id, 'direct_message') then
    insert into public.notifications (user_id, type, payload)
    values (
      new.recipient_id,
      'direct_message',
      jsonb_build_object(
        'sender_id',   new.sender_id,
        'message_id',  new.id
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_direct_message_created on public.direct_messages;
create trigger on_direct_message_created
  after insert on public.direct_messages
  for each row execute procedure public.on_direct_message_created();
