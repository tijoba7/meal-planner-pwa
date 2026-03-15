-- ─── Initial schema: Mise social platform ───────────────────────────────────
-- Run this migration in the Supabase SQL editor or via the Supabase CLI.
-- Order matters: referenced tables must exist before foreign keys are added.

-- ─── Enums ───────────────────────────────────────────────────────────────────

create type public.recipe_visibility as enum ('private', 'friends', 'public');
create type public.friendship_status as enum ('pending', 'accepted', 'blocked');
create type public.reaction_type as enum ('like', 'bookmark', 'emoji');

-- ─── profiles ────────────────────────────────────────────────────────────────
-- Extends auth.users. One row per authenticated user.

create table public.profiles (
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── recipes_cloud ────────────────────────────────────────────────────────────
-- Cloud copy of a user's recipe (Schema.org format stored as jsonb).

create table public.recipes_cloud (
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

create index recipes_cloud_author_id_idx on public.recipes_cloud (author_id);
create index recipes_cloud_visibility_idx on public.recipes_cloud (visibility);

-- ─── friendships ─────────────────────────────────────────────────────────────

create table public.friendships (
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

create index friendships_requester_idx on public.friendships (requester_id);
create index friendships_addressee_idx on public.friendships (addressee_id);

-- ─── reactions ───────────────────────────────────────────────────────────────

create table public.reactions (
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

create index reactions_recipe_id_idx on public.reactions (recipe_id);

-- ─── comments ────────────────────────────────────────────────────────────────

create table public.comments (
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

create index comments_recipe_id_idx on public.comments (recipe_id);
create index comments_parent_id_idx on public.comments (parent_comment_id);

-- ─── ratings ─────────────────────────────────────────────────────────────────

create table public.ratings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  recipe_id  uuid not null references public.recipes_cloud (id) on delete cascade,
  score      smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  constraint ratings_unique_per_user unique (user_id, recipe_id)
);

comment on table public.ratings is
  'Star ratings (1-5) on cloud recipes, one per user per recipe.';

create index ratings_recipe_id_idx on public.ratings (recipe_id);

-- ─── notifications ────────────────────────────────────────────────────────────

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null,
  payload    jsonb not null default '{}',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.notifications is
  'In-app notifications. type examples: friend_request, recipe_reaction, comment.';

create index notifications_user_id_unread_idx
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

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger set_recipes_cloud_updated_at
  before update on public.recipes_cloud
  for each row execute procedure public.set_updated_at();

create trigger set_comments_updated_at
  before update on public.comments
  for each row execute procedure public.set_updated_at();
