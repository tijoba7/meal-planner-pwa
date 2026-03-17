/**
 * Direct Messages service — send, fetch, and subscribe to 1:1 DMs.
 *
 * Conversation list is derived by finding the latest message per partner.
 * RLS on direct_messages ensures only sender/recipient can access rows.
 *
 * All functions are graceful no-ops when Supabase is not configured.
 */

import { supabase } from './supabase'
import type { DirectMessage, Profile } from '../types/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DmMessage = DirectMessage

export interface Conversation {
  partnerId: string
  partner: Pick<Profile, 'id' | 'display_name' | 'avatar_url'>
  lastMessage: DmMessage
  unreadCount: number
}

// ─── Send ─────────────────────────────────────────────────────────────────────

export async function sendMessage(
  senderId: string,
  recipientId: string,
  body: string
): Promise<DmMessage | null> {
  const { data, error } = await supabase
    .from('direct_messages')
    .insert({ sender_id: senderId, recipient_id: recipientId, body })
    .select()
    .single()
  if (error) {
    console.error('sendMessage:', error.message)
    return null
  }
  return data
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

/**
 * Get all messages in the conversation between currentUser and otherUser,
 * ordered oldest-first.
 */
export async function getMessages(
  currentUserId: string,
  otherUserId: string
): Promise<DmMessage[]> {
  const { data } = await supabase
    .from('direct_messages')
    .select('*')
    .or(
      `and(sender_id.eq.${currentUserId},recipient_id.eq.${otherUserId}),` +
        `and(sender_id.eq.${otherUserId},recipient_id.eq.${currentUserId})`
    )
    .order('created_at', { ascending: true })
  return data ?? []
}

/**
 * Get the list of conversations for a user.
 * Returns one entry per unique partner, with the latest message and unread count.
 */
export async function getConversations(userId: string): Promise<Conversation[]> {
  // Fetch all messages for this user (sent or received), newest first.
  const { data: messages } = await supabase
    .from('direct_messages')
    .select('*')
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('created_at', { ascending: false })

  if (!messages || messages.length === 0) return []

  // Deduplicate by partner — keep the first (most recent) message per partner.
  const seenPartners = new Set<string>()
  const latestByPartner = new Map<string, DmMessage>()
  const unreadByPartner = new Map<string, number>()

  for (const msg of messages) {
    const partnerId = msg.sender_id === userId ? msg.recipient_id : msg.sender_id
    if (!seenPartners.has(partnerId)) {
      seenPartners.add(partnerId)
      latestByPartner.set(partnerId, msg)
      unreadByPartner.set(partnerId, 0)
    }
    // Count unread messages FROM the partner (recipient = currentUser, not yet read).
    if (msg.recipient_id === userId && msg.read_at === null) {
      unreadByPartner.set(partnerId, (unreadByPartner.get(partnerId) ?? 0) + 1)
    }
  }

  const partnerIds = [...seenPartners]

  // Batch-fetch partner profiles.
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', partnerIds)

  const profileMap = new Map<string, Pick<Profile, 'id' | 'display_name' | 'avatar_url'>>()
  for (const p of profiles ?? []) {
    profileMap.set(p.id, p)
  }

  const conversations: Conversation[] = []
  for (const partnerId of partnerIds) {
    const partner = profileMap.get(partnerId)
    const lastMessage = latestByPartner.get(partnerId)
    if (!partner || !lastMessage) continue
    conversations.push({
      partnerId,
      partner,
      lastMessage,
      unreadCount: unreadByPartner.get(partnerId) ?? 0,
    })
  }

  // Sort by latest message descending.
  conversations.sort(
    (a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
  )

  return conversations
}

/**
 * Count total unread DMs for a user (messages sent TO this user, not yet read).
 */
export async function getUnreadDmCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('direct_messages')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .is('read_at', null)
  return count ?? 0
}

// ─── Mark read ────────────────────────────────────────────────────────────────

/**
 * Mark all messages from otherUser to currentUser as read.
 */
export async function markConversationRead(
  currentUserId: string,
  otherUserId: string
): Promise<void> {
  await supabase
    .from('direct_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', currentUserId)
    .eq('sender_id', otherUserId)
    .is('read_at', null)
}

// ─── Realtime ─────────────────────────────────────────────────────────────────

/**
 * Subscribe to new direct messages where the current user is the recipient.
 * Returns an unsubscribe function.
 */
export function subscribeToDirectMessages(
  userId: string,
  onNew: (msg: DmMessage) => void
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`dm:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `recipient_id=eq.${userId}`,
      },
      (payload) => {
        onNew(payload.new as DmMessage)
      }
    )
    .subscribe()

  return () => {
    supabase?.removeChannel(channel)
  }
}
