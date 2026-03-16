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

create trigger on_group_member_added
  after insert on public.group_members
  for each row execute procedure public.notify_on_group_invite();
