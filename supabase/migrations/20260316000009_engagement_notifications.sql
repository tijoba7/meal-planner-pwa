-- ─── Engagement: notification triggers and comment moderation ─────────────────
-- Adds:
--   1. RLS policy allowing recipe owners to soft-delete any comment on their recipe
--   2. Trigger: insert notification on new reaction (notifies recipe author)
--   3. Trigger: insert notification on new comment (notifies recipe author + parent author)

-- ─── Comment moderation: recipe owner can soft-delete any comment ─────────────

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

create trigger on_comment_created
  after insert on public.comments
  for each row execute procedure public.notify_on_comment();
