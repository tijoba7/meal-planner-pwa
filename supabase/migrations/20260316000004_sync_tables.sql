-- ─── Cloud sync tables for meal plans and shopping lists ──────────────────────
-- Enables bidirectional sync for all three data types (recipes already exist).
-- Also adds the three tables to supabase_realtime so devices receive live updates.

-- ─── meal_plans_cloud ─────────────────────────────────────────────────────────

create table public.meal_plans_cloud (
  id         uuid primary key,
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.meal_plans_cloud is
  'Cloud-synced meal plans. data column stores the full MealPlan JSON.';

create index meal_plans_cloud_owner_idx on public.meal_plans_cloud (owner_id);

create trigger set_meal_plans_cloud_updated_at
  before update on public.meal_plans_cloud
  for each row execute procedure public.set_updated_at();

-- ─── shopping_lists_cloud ─────────────────────────────────────────────────────

create table public.shopping_lists_cloud (
  id         uuid primary key,
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.shopping_lists_cloud is
  'Cloud-synced shopping lists. data column stores the full ShoppingList JSON.';

create index shopping_lists_cloud_owner_idx on public.shopping_lists_cloud (owner_id);

create trigger set_shopping_lists_cloud_updated_at
  before update on public.shopping_lists_cloud
  for each row execute procedure public.set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.meal_plans_cloud enable row level security;

create policy "Users can manage their own meal plans"
  on public.meal_plans_cloud
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

alter table public.shopping_lists_cloud enable row level security;

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
