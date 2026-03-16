-- ─── Reposts table ──────────────────────────────────────────────────────────
-- MEA-176: Recipe reposts with optional image and caption.
-- A repost MUST reference a recipe — no standalone text posts.
-- Users can add their own photo (e.g. "I made this!") and a short caption.

create table public.reposts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  recipe_id  uuid not null references public.recipes_cloud (id) on delete cascade,
  caption    text check (caption is null or char_length(caption) between 1 and 500),
  image_url  text,
  created_at timestamptz not null default now()
);

comment on table public.reposts is
  'Recipe reposts. Always tied to a recipe; optionally includes user photo and caption.';

create index reposts_user_id_idx on public.reposts (user_id);
create index reposts_recipe_id_idx on public.reposts (recipe_id);
create index reposts_created_at_idx on public.reposts (created_at desc);

-- One repost per user per recipe (can delete and re-repost).
alter table public.reposts
  add constraint reposts_unique_per_user unique (user_id, recipe_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────

alter table public.reposts enable row level security;

-- Reposts inherit visibility from the underlying recipe.
create policy "reposts: visible with recipe"
  on public.reposts for select
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

-- Users can create their own reposts.
create policy "reposts: user can insert own"
  on public.reposts for insert
  to authenticated
  with check (user_id = auth.uid());

-- Users can delete their own reposts.
create policy "reposts: user can delete own"
  on public.reposts for delete
  to authenticated
  using (user_id = auth.uid());

-- ─── Notification trigger ───────────────────────────────────────────────────
-- Notify the recipe author when someone reposts their recipe.

create or replace function public.on_repost_created()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  recipe_author_id uuid;
begin
  -- Look up the recipe author
  select author_id into recipe_author_id
  from public.recipes_cloud
  where id = new.recipe_id;

  -- Don't notify if you repost your own recipe
  if recipe_author_id is not null
     and recipe_author_id <> new.user_id
     and not public.is_notification_muted(recipe_author_id, 'recipe_repost')
  then
    insert into public.notifications (user_id, type, payload)
    values (
      recipe_author_id,
      'recipe_repost',
      jsonb_build_object(
        'reposter_id', new.user_id,
        'recipe_id', new.recipe_id,
        'repost_id', new.id
      )
    );
  end if;

  return new;
end;
$$;

create trigger on_repost_created
  after insert on public.reposts
  for each row execute procedure public.on_repost_created();
