-- ─── Shopping list household sharing ──────────────────────────────────────────
-- Mirrors the meal_plans_cloud household sharing pattern.
-- Members of the linked household can read and co-edit shared shopping lists.

-- ─── shopping_lists_cloud: add household_id ───────────────────────────────────

alter table public.shopping_lists_cloud
  add column household_id uuid references public.households (id) on delete set null;

create index shopping_lists_cloud_household_id_idx
  on public.shopping_lists_cloud (household_id)
  where household_id is not null;

-- ─── Update shopping_lists_cloud RLS ──────────────────────────────────────────
-- Replace the broad "all" policy with fine-grained policies that let household
-- members read and co-edit shared lists.

drop policy "Users can manage their own shopping lists" on public.shopping_lists_cloud;

-- SELECT: owner always; household members when a household_id is set
create policy "shopping_lists_cloud: owner or household member can select"
  on public.shopping_lists_cloud for select
  to authenticated
  using (
    owner_id = auth.uid()
    or (
      household_id is not null
      and public.is_household_member(household_id, auth.uid())
    )
  );

-- INSERT: only owner
create policy "shopping_lists_cloud: owner can insert"
  on public.shopping_lists_cloud for insert
  to authenticated
  with check (owner_id = auth.uid());

-- UPDATE: owner always; any household member for shared lists
create policy "shopping_lists_cloud: owner or household member can update"
  on public.shopping_lists_cloud for update
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
create policy "shopping_lists_cloud: owner can delete"
  on public.shopping_lists_cloud for delete
  to authenticated
  using (owner_id = auth.uid());
