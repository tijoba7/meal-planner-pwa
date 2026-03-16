/**
 * Group service — create groups, manage members, share recipes within groups.
 *
 * All reads/writes go through Supabase RLS:
 *   - Only group members can see a group, its members, and its recipes.
 *   - Only group admins can update group details, invite members, change roles,
 *     or remove other members.
 *   - Any group member can share a recipe into the group.
 *   - The adder or a group admin can remove a recipe from the group.
 *   - The creator is automatically added as admin (database trigger).
 *
 * All functions are graceful no-ops when Supabase is not configured.
 */

import { supabase } from './supabase'
import type { Group, GroupMember, Profile } from '../types/supabase'
import type { CloudRecipeWithAuthor } from './recipeShareService'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GroupWithMeta extends Group {
  memberCount: number
  userRole: 'admin' | 'member' | null
}

export interface GroupMemberWithProfile extends GroupMember {
  profile: Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'bio'>
}

export interface GroupRecipeWithAuthor {
  id: string
  group_id: string
  recipe_id: string
  added_by: string
  added_at: string
  recipe: CloudRecipeWithAuthor
}

// ─── Group CRUD ───────────────────────────────────────────────────────────────

/**
 * Create a new group. The database trigger auto-adds the creator as admin.
 */
export async function createGroup(
  name: string,
  description: string | null,
  userId: string,
): Promise<{ data: Group | null; error: Error | null }> {
  if (!supabase) return { data: null, error: new Error('Supabase not configured') }

  const { data, error } = await supabase
    .from('groups')
    .insert({
      name: name.trim(),
      description: description?.trim() ?? null,
      created_by: userId,
    })
    .select()
    .single()

  return { data: (data as Group | null) ?? null, error: error ? new Error(error.message) : null }
}

/**
 * Fetch all groups the current user belongs to, with member count and their role.
 */
export async function getMyGroups(userId: string): Promise<GroupWithMeta[]> {
  if (!supabase) return []

  type MembershipRow = { role: 'admin' | 'member'; group_id: string; groups: Group | null }
  const { data: memberships } = await supabase
    .from('group_members')
    .select('role, group_id, groups(id, name, description, avatar_url, created_by, created_at, updated_at)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true })
    // Supabase SDK cannot infer the renamed join shape — override required
    .overrideTypes<MembershipRow[], { merge: false }>()

  if (!memberships || memberships.length === 0) return []

  const rows = memberships
  const groupIds = rows.map((r) => r.group_id)

  const { data: allMembers } = await supabase
    .from('group_members')
    .select('group_id')
    .in('group_id', groupIds)

  const countByGroup: Record<string, number> = {}
  for (const m of (allMembers ?? []) as { group_id: string }[]) {
    countByGroup[m.group_id] = (countByGroup[m.group_id] ?? 0) + 1
  }

  return rows
    .filter((r) => r.groups != null)
    .map((r) => ({
      ...(r.groups as Group),
      memberCount: countByGroup[r.group_id] ?? 1,
      userRole: r.role,
    }))
}

/**
 * Fetch a single group by ID (accessible to members only via RLS).
 */
export async function getGroup(groupId: string): Promise<Group | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .maybeSingle()
  return (data as Group | null) ?? null
}

/**
 * Update a group's name or description (admin only, enforced by RLS).
 */
export async function updateGroup(
  groupId: string,
  updates: { name?: string; description?: string | null },
): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error('Supabase not configured') }
  const patch: Record<string, unknown> = {}
  if (updates.name !== undefined) patch.name = updates.name.trim()
  if (updates.description !== undefined) patch.description = updates.description?.trim() ?? null

  const { error } = await supabase.from('groups').update(patch).eq('id', groupId)
  return { error: error ? new Error(error.message) : null }
}

/**
 * Delete a group and all its data (admin only, enforced by RLS).
 */
export async function deleteGroup(groupId: string): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error('Supabase not configured') }
  const { error } = await supabase.from('groups').delete().eq('id', groupId)
  return { error: error ? new Error(error.message) : null }
}

// ─── Member management ────────────────────────────────────────────────────────

/**
 * Get all members of a group with their profiles.
 */
export async function getGroupMembers(groupId: string): Promise<GroupMemberWithProfile[]> {
  if (!supabase) return []
  type MemberRow = GroupMember & { profiles: GroupMemberWithProfile['profile'] }
  const { data } = await supabase
    .from('group_members')
    .select('group_id, user_id, role, joined_at, profiles(id, display_name, avatar_url, bio)')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true })
    // Supabase SDK infers a complex join type that doesn't match MemberRow — override required
    .overrideTypes<MemberRow[], { merge: false }>()

  if (!data) return []
  return data.map((row) => ({
    group_id: row.group_id,
    user_id: row.user_id,
    role: row.role,
    joined_at: row.joined_at,
    profile: row.profiles,
  }))
}

/**
 * Get the current user's role in a group. Returns null if not a member.
 */
export async function getMyGroupRole(
  groupId: string,
  userId: string,
): Promise<'admin' | 'member' | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) return null
  return (data as { role: 'admin' | 'member' }).role
}

/**
 * Add a member to a group (admin only, enforced by RLS).
 */
export async function inviteMember(
  groupId: string,
  userId: string,
): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error('Supabase not configured') }
  const { error } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, user_id: userId, role: 'member' })
  return { error: error ? new Error(error.message) : null }
}

/**
 * Leave a group (removes the current user from the group).
 */
export async function leaveGroup(
  groupId: string,
  userId: string,
): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error('Supabase not configured') }
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId)
  return { error: error ? new Error(error.message) : null }
}

/**
 * Remove a member from a group (admin only, enforced by RLS).
 */
export async function removeMember(
  groupId: string,
  userId: string,
): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error('Supabase not configured') }
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId)
  return { error: error ? new Error(error.message) : null }
}

/**
 * Change a member's role (admin only, enforced by RLS).
 */
export async function updateMemberRole(
  groupId: string,
  userId: string,
  role: 'admin' | 'member',
): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error('Supabase not configured') }
  const { error } = await supabase
    .from('group_members')
    .update({ role })
    .eq('group_id', groupId)
    .eq('user_id', userId)
  return { error: error ? new Error(error.message) : null }
}

// ─── Group recipes ────────────────────────────────────────────────────────────

/**
 * Share a cloud recipe into a group (member only, enforced by RLS).
 * The recipe should have non-private visibility so all group members can see it.
 */
export async function shareRecipeToGroup(
  groupId: string,
  recipeId: string,
  userId: string,
): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error('Supabase not configured') }
  const { error } = await supabase
    .from('group_recipes')
    .insert({ group_id: groupId, recipe_id: recipeId, added_by: userId })
  return { error: error ? new Error(error.message) : null }
}

/**
 * Get all recipes shared into a group, with author profiles.
 * RLS on recipes_cloud applies: private recipes are hidden even if shared.
 */
export async function getGroupFeed(groupId: string): Promise<CloudRecipeWithAuthor[]> {
  if (!supabase) return []
  type GroupRecipeRow = { recipe_id: string; added_at: string; recipes_cloud: CloudRecipeWithAuthor }
  const { data } = await supabase
    .from('group_recipes')
    .select('recipe_id, added_at, recipes_cloud(*, profiles(display_name, avatar_url))')
    .eq('group_id', groupId)
    .order('added_at', { ascending: false })
    .limit(60)
    // Supabase SDK cannot infer nested join shape — override required
    .overrideTypes<GroupRecipeRow[], { merge: false }>()

  if (!data) return []
  return data.map((row) => row.recipes_cloud).filter(Boolean)
}

/**
 * Remove a recipe from the group feed.
 * The adder or a group admin can do this (enforced by RLS).
 */
export async function removeRecipeFromGroup(
  groupId: string,
  recipeId: string,
): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error('Supabase not configured') }
  const { error } = await supabase
    .from('group_recipes')
    .delete()
    .eq('group_id', groupId)
    .eq('recipe_id', recipeId)
  return { error: error ? new Error(error.message) : null }
}

/**
 * Get the IDs of cloud recipes already shared into a group.
 * Used to mark recipes as "already shared" in the share picker.
 */
export async function getGroupRecipeIds(groupId: string): Promise<Set<string>> {
  if (!supabase) return new Set()
  const { data } = await supabase
    .from('group_recipes')
    .select('recipe_id')
    .eq('group_id', groupId)
  // data is typed as Pick<GroupRecipe, 'recipe_id'>[] | null by the SDK
  return new Set(data?.map((r) => r.recipe_id) ?? [])
}
