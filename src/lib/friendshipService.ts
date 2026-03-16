/**
 * Friendship service — send/accept/reject/block/unfriend, user search, invite links.
 *
 * All writes are guarded by Supabase RLS:
 *   - Only the requester can send or cancel a request.
 *   - Only the addressee can accept, reject, or block.
 *   - Either party can unfriend (delete an accepted friendship).
 *   - Blocked users cannot see each other's content.
 *
 * All functions are no-ops (returning null / empty arrays) when Supabase is
 * not configured — the app works fully offline / local-only.
 */

import { supabase } from './supabase'
import type { Friendship, Profile } from '../types/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FriendshipWithProfile extends Friendship {
  /** The other user in the friendship (populated from profiles join). */
  profile: Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'bio'>
}

export type FriendRelation =
  | 'none'
  | 'friends'
  | 'pending_sent'      // current user sent a request, awaiting response
  | 'pending_received'  // current user received a request, can accept/reject
  | 'blocked'           // current user blocked the other
  | 'blocked_by'        // other user blocked the current user

export interface FriendRelationResult {
  relation: FriendRelation
  friendshipId: string | null
}

// ─── Typed query row shapes ───────────────────────────────────────────────────
// These match the Supabase SDK's inferred join result shapes, providing a
// typed intermediate representation instead of casting via `unknown`.

type ProfilePick = Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'bio'>

interface FriendshipJoinRow {
  id: string
  requester_id: string
  addressee_id: string
  status: Friendship['status']
  created_at: string
  responded_at: string | null
  requester: ProfilePick | null
  addressee: ProfilePick | null
}

interface PendingRequestRow {
  id: string
  requester_id: string
  addressee_id: string
  status: Friendship['status']
  created_at: string
  responded_at: string | null
  requester: ProfilePick | null
}

interface SentRequestRow {
  id: string
  requester_id: string
  addressee_id: string
  status: Friendship['status']
  created_at: string
  responded_at: string | null
  addressee: ProfilePick | null
}

// ─── Friend requests ──────────────────────────────────────────────────────────

/**
 * Send a friend request to addresseeId.
 * Returns the new friendship row on success, null on error or unavailability.
 * Rate-limited: max 20 pending outgoing requests at a time.
 */
export async function sendFriendRequest(
  addresseeId: string,
): Promise<{ data: Friendship | null; error: Error | null }> {
  if (!supabase) return { data: null, error: new Error('Supabase not configured') }

  // Soft rate-limit: count pending outgoing requests.
  const { count } = await supabase
    .from('friendships')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  if ((count ?? 0) >= 20) {
    return {
      data: null,
      error: new Error('Too many pending friend requests. Cancel some first.'),
    }
  }

  const { data, error } = await supabase
    .from('friendships')
    // requester_id is set to auth.uid() by the Supabase RLS default/trigger
    .insert({ addressee_id: addresseeId, status: 'pending' } as { requester_id: string; addressee_id: string; status: 'pending' })
    .select()
    .single()

  // Supabase SDK infers a narrow type that doesn't overlap with Friendship — cast via unknown
  return { data: (data as unknown as Friendship) ?? null, error: error ? new Error(error.message) : null }
}

/**
 * Cancel a friend request that the current user sent (requester action).
 */
export async function cancelFriendRequest(
  friendshipId: string,
): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error('Supabase not configured') }
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
  return { error: error ? new Error(error.message) : null }
}

/**
 * Accept an incoming friend request (addressee action).
 */
export async function acceptFriendRequest(
  friendshipId: string,
): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error('Supabase not configured') }
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', friendshipId)
  return { error: error ? new Error(error.message) : null }
}

/**
 * Reject / decline an incoming friend request (addressee action — deletes the row).
 */
export async function rejectFriendRequest(
  friendshipId: string,
): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error('Supabase not configured') }
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
  return { error: error ? new Error(error.message) : null }
}

/**
 * Unfriend (remove an accepted friendship).
 * Either party can call this.
 */
export async function unfriend(friendshipId: string): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error('Supabase not configured') }
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
  return { error: error ? new Error(error.message) : null }
}

/**
 * Block a user.
 * - If a pending friendship exists (either direction), updates it to 'blocked'.
 * - Otherwise, inserts a new blocked row.
 * A blocked user cannot send requests or see friends-only content.
 */
export async function blockUser(
  targetUserId: string,
  currentUserId: string,
): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error('Supabase not configured') }

  // Check for existing friendship in either direction.
  const { data: existing } = await supabase
    .from('friendships')
    .select('id, requester_id, addressee_id')
    .or(
      `and(requester_id.eq.${currentUserId},addressee_id.eq.${targetUserId}),` +
      `and(requester_id.eq.${targetUserId},addressee_id.eq.${currentUserId})`
    )
    .maybeSingle()

  if (existing) {
    // If we're the requester, we can't use the addressee-update policy.
    // In that case delete and re-insert as the blocker.
    if (existing.requester_id === currentUserId) {
      await supabase.from('friendships').delete().eq('id', existing.id)
      const { error } = await supabase
        .from('friendships')
        .insert({ requester_id: currentUserId, addressee_id: targetUserId, status: 'blocked' })
      return { error: error ? new Error(error.message) : null }
    }
    // We are the addressee — update is allowed by RLS.
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'blocked', responded_at: new Date().toISOString() })
      .eq('id', existing.id)
    return { error: error ? new Error(error.message) : null }
  }

  // No existing row — insert a new blocked record (current user is requester).
  const { error } = await supabase
    .from('friendships')
    .insert({ requester_id: currentUserId, addressee_id: targetUserId, status: 'blocked' })
  return { error: error ? new Error(error.message) : null }
}

/**
 * Unblock a user (deletes the blocked friendship row).
 * Only the blocker (requester) can do this.
 */
export async function unblockUser(friendshipId: string): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error('Supabase not configured') }
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
  return { error: error ? new Error(error.message) : null }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Get all accepted friends of the current user (with their profiles).
 */
export async function getFriends(currentUserId: string): Promise<FriendshipWithProfile[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('friendships')
    .select(
      'id, requester_id, addressee_id, status, created_at, responded_at, ' +
      'requester:profiles!friendships_requester_id_fkey(id, display_name, avatar_url, bio), ' +
      'addressee:profiles!friendships_addressee_id_fkey(id, display_name, avatar_url, bio)'
    )
    .eq('status', 'accepted')
    .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`)

  if (!data) return []

  // Supabase SDK infers a complex join type that doesn't overlap with FriendshipJoinRow — cast via unknown
  return (data as unknown as FriendshipJoinRow[]).map((row) => {
    const isRequester = row.requester_id === currentUserId
    const profile = isRequester
      ? row.addressee as ProfilePick
      : row.requester as ProfilePick
    return {
      id: row.id,
      requester_id: row.requester_id,
      addressee_id: row.addressee_id,
      status: row.status,
      created_at: row.created_at,
      responded_at: row.responded_at,
      profile,
    }
  })
}

/**
 * Get incoming pending friend requests for the current user.
 */
export async function getPendingRequests(currentUserId: string): Promise<FriendshipWithProfile[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('friendships')
    .select(
      'id, requester_id, addressee_id, status, created_at, responded_at, ' +
      'requester:profiles!friendships_requester_id_fkey(id, display_name, avatar_url, bio)'
    )
    .eq('status', 'pending')
    .eq('addressee_id', currentUserId)
    .order('created_at', { ascending: false })

  if (!data) return []

  // Supabase SDK infers a complex join type that doesn't overlap with PendingRequestRow — cast via unknown
  return (data as unknown as PendingRequestRow[]).map((row) => ({
    id: row.id,
    requester_id: row.requester_id,
    addressee_id: row.addressee_id,
    status: row.status,
    created_at: row.created_at,
    responded_at: row.responded_at,
    profile: row.requester as ProfilePick,
  }))
}

/**
 * Get outgoing pending friend requests sent by the current user.
 */
export async function getSentRequests(currentUserId: string): Promise<FriendshipWithProfile[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('friendships')
    .select(
      'id, requester_id, addressee_id, status, created_at, responded_at, ' +
      'addressee:profiles!friendships_addressee_id_fkey(id, display_name, avatar_url, bio)'
    )
    .eq('status', 'pending')
    .eq('requester_id', currentUserId)
    .order('created_at', { ascending: false })

  if (!data) return []

  // Supabase SDK infers a complex join type that doesn't overlap with SentRequestRow — cast via unknown
  return (data as unknown as SentRequestRow[]).map((row) => ({
    id: row.id,
    requester_id: row.requester_id,
    addressee_id: row.addressee_id,
    status: row.status,
    created_at: row.created_at,
    responded_at: row.responded_at,
    profile: row.addressee as ProfilePick,
  }))
}

/**
 * Get the friendship relation between the current user and a target user.
 */
export async function getFriendRelation(
  currentUserId: string,
  targetUserId: string,
): Promise<FriendRelationResult> {
  if (!supabase) return { relation: 'none', friendshipId: null }

  const { data } = await supabase
    .from('friendships')
    .select('id, requester_id, addressee_id, status')
    .or(
      `and(requester_id.eq.${currentUserId},addressee_id.eq.${targetUserId}),` +
      `and(requester_id.eq.${targetUserId},addressee_id.eq.${currentUserId})`
    )
    .maybeSingle()

  if (!data) return { relation: 'none', friendshipId: null }

  const { id, requester_id, status } = data as {
    id: string
    requester_id: string
    status: Friendship['status']
  }

  if (status === 'accepted') return { relation: 'friends', friendshipId: id }

  if (status === 'blocked') {
    if (requester_id === currentUserId) return { relation: 'blocked', friendshipId: id }
    return { relation: 'blocked_by', friendshipId: id }
  }

  // pending
  if (requester_id === currentUserId) return { relation: 'pending_sent', friendshipId: id }
  return { relation: 'pending_received', friendshipId: id }
}

/**
 * Get the total number of accepted friends for a given user.
 */
export async function getFriendCount(userId: string): Promise<number> {
  if (!supabase) return 0
  const { count } = await supabase
    .from('friendships')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
  return count ?? 0
}

// ─── User search ──────────────────────────────────────────────────────────────

/**
 * Search for users by display name (case-insensitive partial match).
 * Excludes the current user from results.
 */
export async function searchUsers(
  query: string,
  currentUserId: string,
  limit = 20,
): Promise<Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'bio'>[]> {
  if (!supabase || query.trim().length < 2) return []
  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, bio')
    .ilike('display_name', `%${query.trim()}%`)
    .neq('id', currentUserId)
    .limit(limit)
  return data ?? []
}

// ─── Invite links ─────────────────────────────────────────────────────────────

/**
 * Create (or return existing) an invite link token for the current user.
 * Each user has at most one active invite link; calling this again revokes the old one.
 */
export async function getOrCreateInviteLink(
  userId: string,
): Promise<{ token: string | null; error: Error | null }> {
  if (!supabase) return { token: null, error: new Error('Supabase not configured') }

  // Return existing non-expired invite if present.
  const { data: existing } = await supabase
    .from('friend_invites')
    .select('token, expires_at')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) return { token: existing.token, error: null }

  // Delete any stale expired invites before creating new one.
  await supabase.from('friend_invites').delete().eq('user_id', userId)

  const { data, error } = await supabase
    .from('friend_invites')
    .insert({ user_id: userId })
    .select('token')
    .single()

  return { token: data?.token ?? null, error: error ? new Error(error.message) : null }
}

/**
 * Look up the owner of an invite token.
 * Returns null if the token is not found or has expired.
 */
export async function resolveInviteToken(
  token: string,
): Promise<Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'bio'> | null> {
  if (!supabase) return null

  const { data } = await supabase
    .from('friend_invites')
    .select(
      'user_id, expires_at, ' +
      'profiles!friend_invites_user_id_fkey(id, display_name, avatar_url, bio)'
    )
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (!data) return null
  // Access the joined profile; the Supabase SDK types the join result with the profile shape
  return (data as unknown as { profiles: ProfilePick | null }).profiles
}

/**
 * Revoke the current user's invite link (deletes all their invite rows).
 */
export async function revokeInviteLink(userId: string): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error('Supabase not configured') }
  const { error } = await supabase.from('friend_invites').delete().eq('user_id', userId)
  return { error: error ? new Error(error.message) : null }
}
