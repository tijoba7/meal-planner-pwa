/**
 * Household service — CRUD for collaborative meal planning groups.
 *
 * A household is a named group of users who share meal plans.
 * The creator is automatically the owner; additional members are invited by email.
 *
 * All operations are no-ops when Supabase is not configured (local-only mode).
 */

import { supabase } from './supabase'
import type { MealPlan } from '../types'
import type { Json } from '../types/supabase'
import { toJson } from './jsonUtils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Household {
  id: string
  name: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface HouseholdMember {
  household_id: string
  user_id: string
  role: 'owner' | 'member'
  joined_at: string
  /** Joined from profiles on request */
  profile?: { display_name: string; avatar_url: string | null }
}

export interface HouseholdInvitation {
  id: string
  household_id: string
  invited_by: string
  invitee_email: string
  token: string
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  created_at: string
  expires_at: string
}

// ─── Household CRUD ───────────────────────────────────────────────────────────

/**
 * Create a new household and add the creator as owner.
 * Returns the new household, or null if Supabase is unavailable.
 */
export async function createHousehold(
  name: string,
  userId: string,
): Promise<Household | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('households')
    .insert({ name, created_by: userId })
    .select()
    .single()

  if (error || !data) return null
  // createClient<Database> types this as Tables<'households'>, which matches Household structurally
  const household = data as Household

  // Add creator as owner member
  await supabase
    .from('household_members')
    .insert({ household_id: household.id, user_id: userId, role: 'owner' })

  return household
}

/** Get all households the user belongs to. */
export async function getMyHouseholds(_userId: string): Promise<Household[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('households')
    .select('*')
    .order('created_at', { ascending: false })

  if (error || !data) return []
  // RLS already limits to households where the user is a member
  return data as Household[]
}

/** Get all members of a household, with profile info. */
export async function getHouseholdMembers(
  householdId: string,
): Promise<HouseholdMember[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('household_members')
    .select('*, profile:profiles(display_name, avatar_url)')
    .eq('household_id', householdId)
    .order('joined_at', { ascending: true })

  if (error || !data) return []
  // The join result adds `profile` from profiles; HouseholdMember has this as an optional field.
  // Supabase returns `profile: T | null`; our type declares `profile?: T` — structurally compatible.
  return data as HouseholdMember[]
}

/** Update a household's name (owner only). */
export async function updateHousehold(
  householdId: string,
  name: string,
): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('households')
    .update({ name })
    .eq('id', householdId)
  return !error
}

/** Delete a household (owner only). All members and plans lose the association. */
export async function deleteHousehold(householdId: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('households').delete().eq('id', householdId)
  return !error
}

// ─── Membership ───────────────────────────────────────────────────────────────

/** Leave a household. Owners cannot leave — they must delete the household. */
export async function leaveHousehold(
  householdId: string,
  userId: string,
): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('household_members')
    .delete()
    .eq('household_id', householdId)
    .eq('user_id', userId)
  return !error
}

/** Owner removes another member from the household. */
export async function removeHouseholdMember(
  householdId: string,
  userId: string,
): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('household_members')
    .delete()
    .eq('household_id', householdId)
    .eq('user_id', userId)
  return !error
}

// ─── Invitations ──────────────────────────────────────────────────────────────

/**
 * Send a household invitation to an email address (owner only).
 * Returns the invitation (including the token to embed in the invite link),
 * or null on error.
 */
export async function sendInvitation(
  householdId: string,
  inviteeEmail: string,
  invitedBy: string,
): Promise<HouseholdInvitation | null> {
  if (!supabase) return null

  // Expire any existing pending invitation for this email + household
  await supabase
    .from('household_invitations')
    .update({ status: 'expired' })
    .eq('household_id', householdId)
    .eq('invitee_email', inviteeEmail)
    .eq('status', 'pending')

  const { data, error } = await supabase
    .from('household_invitations')
    .insert({ household_id: householdId, invitee_email: inviteeEmail, invited_by: invitedBy })
    .select()
    .single()

  if (error || !data) return null
  // Tables<'household_invitations'> is structurally identical to HouseholdInvitation
  return data as HouseholdInvitation
}

/**
 * Accept an invitation by token.
 * Adds the user to the household and marks the invitation accepted.
 * Returns the household they joined, or null on error/not-found/expired.
 */
export async function acceptInvitation(
  token: string,
  userId: string,
): Promise<Household | null> {
  if (!supabase) return null

  // Fetch the invitation
  const { data: invData, error: invErr } = await supabase
    .from('household_invitations')
    .select('*')
    .eq('token', token)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .single()

  if (invErr || !invData) return null
  // Tables<'household_invitations'> is structurally identical to HouseholdInvitation
  const inv = invData as HouseholdInvitation

  // Add the user as a member
  const { error: memberErr } = await supabase
    .from('household_members')
    .insert({ household_id: inv.household_id, user_id: userId, role: 'member' })

  if (memberErr) return null

  // Mark invitation accepted
  await supabase
    .from('household_invitations')
    .update({ status: 'accepted' })
    .eq('id', inv.id)

  // Return the household
  const { data: householdData } = await supabase
    .from('households')
    .select('*')
    .eq('id', inv.household_id)
    .single()

  // Tables<'households'> is structurally identical to Household
  return (householdData as Household) ?? null
}

/** Decline an invitation by token. */
export async function declineInvitation(token: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('household_invitations')
    .update({ status: 'declined' })
    .eq('token', token)
    .eq('status', 'pending')
  return !error
}

/** List all pending invitations for a household (owner view). */
export async function listInvitations(
  householdId: string,
): Promise<HouseholdInvitation[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('household_invitations')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data as HouseholdInvitation[]
}

// ─── Shared meal plans ────────────────────────────────────────────────────────

/**
 * Share a meal plan with a household.
 * The plan owner sets household_id; all household members can then read/edit it.
 */
export async function shareMealPlanWithHousehold(
  planId: string,
  householdId: string,
): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('meal_plans_cloud')
    .update({ household_id: householdId })
    .eq('id', planId)
  return !error
}

/** Remove household sharing from a plan (owner only). */
export async function unshareMealPlan(planId: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('meal_plans_cloud')
    .update({ household_id: null })
    .eq('id', planId)
  return !error
}

/**
 * Fetch all shared meal plans for a household.
 * Used during initial sync and on-demand refresh.
 */
export async function fetchHouseholdMealPlans(
  householdId: string,
): Promise<Array<{ id: string; data: Json; updated_at: string }>> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('meal_plans_cloud')
    .select('id, data, updated_at')
    .eq('household_id', householdId)
  if (error || !data) return []
  return data
}

/**
 * Push an updated shared meal plan to the cloud.
 * Non-owners use UPDATE (data only); ownership is preserved.
 */
export async function pushSharedMealPlanData(plan: MealPlan): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('meal_plans_cloud')
    .update({ data: toJson(plan), updated_at: plan.updatedAt })
    .eq('id', plan.id)
  return !error
}

/**
 * Subscribe to Realtime changes for meal plans in a household.
 * Returns an unsubscribe function.
 */
export function subscribeToHouseholdMealPlans(
  householdId: string,
  onUpdate: (planId: string, data: Json, updatedAt: string) => void,
  onDelete: (planId: string) => void,
): () => void {
  if (!supabase) return () => {}

  const channel = supabase
    .channel(`household-plans:${householdId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'meal_plans_cloud',
        filter: `household_id=eq.${householdId}`,
      },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string }).id
          if (id) onDelete(id)
          return
        }
        const row = payload.new as { id: string; data: unknown; updated_at: string }
        onUpdate(row.id, row.data as Json, row.updated_at)
      },
    )
    .subscribe()

  return () => {
    void supabase!.removeChannel(channel)
  }
}
