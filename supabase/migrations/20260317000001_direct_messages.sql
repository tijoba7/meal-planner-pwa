-- ─── Direct Messages ─────────────────────────────────────────────────────────
-- MEA-189: 1:1 direct messaging between friends.
-- Messages are only visible to sender and recipient (strict RLS).
-- Conversation list is derived by grouping on (sender_id, recipient_id).

create table public.direct_messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 2000),
  read_at      timestamptz,
  created_at   timestamptz not null default now(),
  constraint direct_messages_no_self_message check (sender_id <> recipient_id)
);

comment on table public.direct_messages is
  '1:1 direct messages between users. Visible only to sender and recipient.';

create index dm_sender_idx      on public.direct_messages (sender_id,    created_at desc);
create index dm_recipient_idx   on public.direct_messages (recipient_id, created_at desc);
create index dm_conversation_idx on public.direct_messages (
  least(sender_id, recipient_id),
  greatest(sender_id, recipient_id),
  created_at desc
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.direct_messages enable row level security;

-- Both participants can read their messages.
create policy "dm: participants can select"
  on public.direct_messages for select
  to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

-- Only the sender can insert (and must be the auth user).
create policy "dm: sender can insert"
  on public.direct_messages for insert
  to authenticated
  with check (sender_id = auth.uid());

-- Only the recipient can mark a message as read.
create policy "dm: recipient can mark read"
  on public.direct_messages for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- Either participant can delete their own messages.
create policy "dm: participants can delete"
  on public.direct_messages for delete
  to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

-- ─── Notification trigger ─────────────────────────────────────────────────────
-- Notify recipient when a new direct message arrives.

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

create trigger on_direct_message_created
  after insert on public.direct_messages
  for each row execute procedure public.on_direct_message_created();
