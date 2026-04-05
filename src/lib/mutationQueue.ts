import { db } from './db'
import { supabase } from './supabase'
import { toJson } from './jsonUtils'
import type { ShoppingList, MealPlan } from '../types'
import type { MutationEntityType, MutationOperation, PendingMutation } from './db'

export type { MutationEntityType, MutationOperation, PendingMutation }

// ─── Enqueue ──────────────────────────────────────────────────────────────────

export async function enqueueMutation(mutation: Omit<PendingMutation, 'id' | 'createdAt' | 'retries'>): Promise<void> {
  await db.pendingMutations.add({
    ...mutation,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    retries: 0,
  })

  // Register a background sync tag so the service worker can trigger replay
  // when connectivity is restored (progressive enhancement — fails silently).
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready
      .then((reg) => (reg as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } }).sync.register('sync-mutations'))
      .catch(() => { /* ignore — not all browsers support Background Sync */ })
  }
}

// ─── Network error detection ──────────────────────────────────────────────────

export function isNetworkError(error: Error): boolean {
  if (!navigator.onLine) return true
  const msg = error.message.toLowerCase()
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('the internet connection appears to be offline')
  )
}

// ─── Flush ────────────────────────────────────────────────────────────────────

export interface FlushResult {
  synced: PendingMutation[]
  failed: PendingMutation[]
}

/**
 * Replay all queued mutations for a user against Supabase.
 * Returns the list of synced and failed mutations so the caller can
 * invalidate queries and notify the user.
 */
export async function flushMutationQueue(userId: string): Promise<FlushResult> {
  const pending = await db.pendingMutations
    .where('userId')
    .equals(userId)
    .sortBy('createdAt')

  const synced: PendingMutation[] = []
  const failed: PendingMutation[] = []

  for (const mutation of pending) {
    // Skip mutations that have failed too many times
    if (mutation.retries >= 3) {
      failed.push(mutation)
      continue
    }

    try {
      await replayMutation(mutation, userId)
      await db.pendingMutations.delete(mutation.id)
      synced.push(mutation)
    } catch (err) {
      const retries = mutation.retries + 1
      const lastError = err instanceof Error ? err.message : String(err)
      await db.pendingMutations.update(mutation.id, { retries, lastError })
      failed.push({ ...mutation, retries, lastError })
    }
  }

  return { synced, failed }
}

export async function getPendingCount(userId: string): Promise<number> {
  return db.pendingMutations.where('userId').equals(userId).count()
}

// ─── Replay individual mutations ──────────────────────────────────────────────

async function replayMutation(mutation: PendingMutation, userId: string): Promise<void> {
  const { entityType, operation, entityId, payload } = mutation

  if (entityType === 'shoppingList') {
    await replayShoppingListMutation(operation, entityId, payload, userId)
  } else if (entityType === 'mealPlan') {
    await replayMealPlanMutation(operation, entityId, payload, userId)
  }
}

async function replayShoppingListMutation(
  operation: MutationOperation,
  entityId: string,
  payload: unknown,
  userId: string
): Promise<void> {
  if (operation === 'create') {
    const list = payload as ShoppingList
    const { error } = await supabase.from('shopping_lists_cloud').insert({
      id: list.id,
      owner_id: userId,
      data: toJson(list),
    })
    if (error) throw new Error(error.message)
  } else if (operation === 'update') {
    const list = payload as ShoppingList
    const { error } = await supabase
      .from('shopping_lists_cloud')
      .update({ data: toJson(list), updated_at: list.updatedAt })
      .eq('id', entityId)
    if (error) throw new Error(error.message)
  } else if (operation === 'delete') {
    const { error } = await supabase
      .from('shopping_lists_cloud')
      .delete()
      .eq('id', entityId)
      .eq('owner_id', userId)
    if (error) throw new Error(error.message)
  }
}

async function replayMealPlanMutation(
  operation: MutationOperation,
  entityId: string,
  payload: unknown,
  userId: string
): Promise<void> {
  if (operation === 'create') {
    const plan = payload as MealPlan
    const { error } = await supabase.from('meal_plans_cloud').insert({
      id: plan.id,
      owner_id: userId,
      data: toJson(plan),
    })
    if (error) throw new Error(error.message)
  } else if (operation === 'update') {
    const plan = payload as MealPlan
    const { error } = await supabase
      .from('meal_plans_cloud')
      .update({ data: toJson(plan), updated_at: plan.updatedAt })
      .eq('id', entityId)
      .eq('owner_id', userId)
    if (error) throw new Error(error.message)
  } else if (operation === 'delete') {
    const { error } = await supabase
      .from('meal_plans_cloud')
      .delete()
      .eq('id', entityId)
      .eq('owner_id', userId)
    if (error) throw new Error(error.message)
  }
}
