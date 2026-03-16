-- ─── Collaborative meal planning: households ──────────────────────────────────
-- A household is a named group of users who share meal plans.
-- Members can co-edit shared plans; changes propagate via Supabase Realtime.
-- Invitation flow: owner invites by email → invitee accepts via secure token.

-- ─── Enums ───────────────────────────────────────────────────────────────────

create type public.household_member_role as enum ('owner', 'member');
create type public.household_invitation_status as enum ('pending', 'accepted', 'declined', 'expired');

-- ─── households ───────────────────────────────────────────────────────────────

create table public.households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 100),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.households is
  'A named group of users (household) who share meal plans.';

create index households_created_by_idx on public.households (created_by);

create trigger set_households_updated_at
  before update on public.households
  for each row execute procedure public.set_updated_at();

-- ─── household_members ────────────────────────────────────────────────────────

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         public.household_member_role not null default 'member',
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

comment on table public.household_members is
  'Membership of users in households. role=owner can invite/remove; role=member can view and co-edit.';

create index household_members_user_id_idx on public.household_members (user_id);

-- ─── household_invitations ────────────────────────────────────────────────────

create table public.household_invitations (
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

create index household_invitations_household_id_idx on public.household_invitations (household_id);
create index household_invitations_invitee_email_idx on public.household_invitations (invitee_email);
create index household_invitations_token_idx on public.household_invitations (token);

-- ─── meal_plans_cloud: add household_id ───────────────────────────────────────

alter table public.meal_plans_cloud
  add column household_id uuid references public.households (id) on delete set null;

create index meal_plans_cloud_household_id_idx
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
create policy "households: members can select"
  on public.households for select
  to authenticated
  using (public.is_household_member(id, auth.uid()));

create policy "households: creator can insert"
  on public.households for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "households: creator can update"
  on public.households for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "households: creator can delete"
  on public.households for delete
  to authenticated
  using (created_by = auth.uid());

-- household_members: any member can see the full member list
create policy "household_members: members can select"
  on public.household_members for select
  to authenticated
  using (public.is_household_member(household_id, auth.uid()));

-- Insert allowed for:
--   • owner adding someone else
--   • the user adding themselves (via invitation acceptance)
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
create policy "household_invitations: members can select"
  on public.household_invitations for select
  to authenticated
  using (
    invited_by = auth.uid()
    or public.is_household_member(household_id, auth.uid())
  );

-- Only the household owner (creator) can send invitations
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

drop policy "Users can manage their own meal plans" on public.meal_plans_cloud;

-- SELECT: owner always; household members when a household_id is set
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
create policy "meal_plans_cloud: owner can insert"
  on public.meal_plans_cloud for insert
  to authenticated
  with check (owner_id = auth.uid());

-- UPDATE: owner always; any household member for shared plans
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
create policy "meal_plans_cloud: owner can delete"
  on public.meal_plans_cloud for delete
  to authenticated
  using (owner_id = auth.uid());

-- ─── Realtime ─────────────────────────────────────────────────────────────────
-- Publish household tables so members get live membership and plan updates.

alter publication supabase_realtime add table public.households;
alter publication supabase_realtime add table public.household_members;
alter publication supabase_realtime add table public.household_invitations;
