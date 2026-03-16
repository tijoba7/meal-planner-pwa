-- ─── Groups / Circles ──────────────────────────────────────────────────────
-- Tables: groups, group_members, group_recipes
-- Groups let users create named circles (e.g. "Family", "Keto Friends"),
-- invite friends, and share cloud recipes within those circles.

-- ─── groups ──────────────────────────────────────────────────────────────────

create table public.groups (
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

create index groups_created_by_idx on public.groups (created_by);

create trigger set_groups_updated_at
  before update on public.groups
  for each row execute procedure public.set_updated_at();

-- ─── group_members ────────────────────────────────────────────────────────────

create table public.group_members (
  group_id  uuid not null references public.groups (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  role      text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

comment on table public.group_members is
  'Membership roster for groups. role = admin | member.';

create index group_members_user_id_idx on public.group_members (user_id);

-- ─── group_recipes ────────────────────────────────────────────────────────────

create table public.group_recipes (
  id        uuid primary key default gen_random_uuid(),
  group_id  uuid not null references public.groups (id) on delete cascade,
  recipe_id uuid not null references public.recipes_cloud (id) on delete cascade,
  added_by  uuid not null references public.profiles (id) on delete cascade,
  added_at  timestamptz not null default now(),
  constraint group_recipes_unique unique (group_id, recipe_id)
);

comment on table public.group_recipes is
  'Recipes shared into a group. One row per (group, recipe) pair.';

create index group_recipes_group_id_idx on public.group_recipes (group_id);

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
create policy "groups: members can select"
  on public.groups for select
  to authenticated
  using (public.is_group_member(id, auth.uid()));

-- Any authenticated user can create a group.
create policy "groups: authenticated can insert"
  on public.groups for insert
  to authenticated
  with check (created_by = auth.uid());

-- Only admins can update group details.
create policy "groups: admins can update"
  on public.groups for update
  to authenticated
  using (public.is_group_admin(id, auth.uid()))
  with check (public.is_group_admin(id, auth.uid()));

-- Only admins can delete the group.
create policy "groups: admins can delete"
  on public.groups for delete
  to authenticated
  using (public.is_group_admin(id, auth.uid()));

-- ─── RLS: group_members ───────────────────────────────────────────────────────

alter table public.group_members enable row level security;

-- Members can see who else is in the group.
create policy "group_members: members can select"
  on public.group_members for select
  to authenticated
  using (public.is_group_member(group_id, auth.uid()));

-- Only group admins can add new members.
-- (The creator auto-join trigger runs security definer and bypasses this.)
create policy "group_members: admins can insert"
  on public.group_members for insert
  to authenticated
  with check (public.is_group_admin(group_id, auth.uid()));

-- Only admins can change member roles.
create policy "group_members: admins can update"
  on public.group_members for update
  to authenticated
  using (public.is_group_admin(group_id, auth.uid()))
  with check (public.is_group_admin(group_id, auth.uid()));

-- Members can remove themselves (leave); admins can remove anyone.
create policy "group_members: self can delete (leave)"
  on public.group_members for delete
  to authenticated
  using (user_id = auth.uid());

create policy "group_members: admins can delete (remove)"
  on public.group_members for delete
  to authenticated
  using (public.is_group_admin(group_id, auth.uid()));

-- ─── RLS: group_recipes ───────────────────────────────────────────────────────

alter table public.group_recipes enable row level security;

-- Only group members can see group recipes.
create policy "group_recipes: members can select"
  on public.group_recipes for select
  to authenticated
  using (public.is_group_member(group_id, auth.uid()));

-- Any group member can share a recipe into the group.
create policy "group_recipes: members can insert"
  on public.group_recipes for insert
  to authenticated
  with check (
    public.is_group_member(group_id, auth.uid())
    and added_by = auth.uid()
  );

-- The adder or a group admin can remove a recipe from the group.
create policy "group_recipes: adder can delete"
  on public.group_recipes for delete
  to authenticated
  using (added_by = auth.uid());

create policy "group_recipes: admins can delete"
  on public.group_recipes for delete
  to authenticated
  using (public.is_group_admin(group_id, auth.uid()));
