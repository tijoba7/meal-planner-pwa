/**
 * Notification service — fetch, mark-read, and realtime subscription for
 * the in-app notification center.
 *
 * Notification types created by DB triggers:
 *   friend_request   payload: { requester_id }
 *   friend_accepted  payload: { acceptor_id }
 *   recipe_reaction  payload: { reactor_id, recipe_id, reaction_type, emoji_code }
 *   recipe_comment   payload: { commenter_id, recipe_id, comment_id }
 *   comment_reply    payload: { commenter_id, recipe_id, comment_id, parent_comment_id }
 *   group_invite     payload: { inviter_id, group_id, group_name }
 *
 * All functions are graceful no-ops when Supabase is not configured.
 */

import { supabase } from './supabase'
import type { Notification } from '../types/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'recipe_reaction'
  | 'recipe_comment'
  | 'comment_reply'
  | 'group_invite'

export interface AppNotification extends Notification {
  type: NotificationType
  payload: Record<string, string>
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

/**
 * Fetch the most recent notifications for the current user (max 50).
 */
export async function getNotifications(userId: string): Promise<AppNotification[]> {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  // The DB stores notifications with our NotificationType values and Record<string,string> payload.
  // AppNotification narrows the base Notification type to these concrete shapes.
  return (data as AppNotification[]) ?? []
}

/**
 * Returns the count of unread notifications for a user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)
  return count ?? 0
}

// ─── Mark read ────────────────────────────────────────────────────────────────

/**
 * Mark a single notification as read.
 */
export async function markRead(notificationId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
  return { error: error ? new Error(error.message) : null }
}

/**
 * Mark all notifications for a user as read.
 */
export async function markAllRead(userId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
  return { error: error ? new Error(error.message) : null }
}

// ─── Preferences ──────────────────────────────────────────────────────────────

/**
 * Fetch the muted notification types for a user.
 * Returns an array of type strings the user has opted out of.
 */
export async function getMutedTypes(userId: string): Promise<NotificationType[]> {
  const { data } = await supabase
    .from('profiles')
    .select('notification_muted_types')
    .eq('id', userId)
    .single()
  return ((data as { notification_muted_types?: string[] } | null)?.notification_muted_types ??
    []) as NotificationType[]
}

/**
 * Save the full list of muted notification types for a user.
 */
export async function setMutedTypes(
  userId: string,
  mutedTypes: NotificationType[]
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('profiles')
    // NotificationType[] is a subtype of string[]; cast is safe and matches the DB column type.
    .update({ notification_muted_types: mutedTypes as string[] })
    .eq('id', userId)
  return { error: error ? new Error(error.message) : null }
}

// ─── Realtime ─────────────────────────────────────────────────────────────────

/**
 * Subscribe to new notifications for a user via Supabase Realtime.
 * Returns an unsubscribe function.
 *
 * @param userId   The user whose notifications to watch.
 * @param onNew    Callback called whenever a new notification arrives.
 */
export function subscribeToNotifications(
  userId: string,
  onNew: (notification: AppNotification) => void
): () => void {

  const channel: RealtimeChannel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        // Realtime payload.new is typed as Record<string, unknown>; shape is guaranteed
        // by the DB trigger that creates notifications with our NotificationType values.
        onNew(payload.new as unknown as AppNotification)
      }
    )
    .subscribe()

  return () => {
    supabase?.removeChannel(channel)
  }
}
