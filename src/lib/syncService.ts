/**
 * Bidirectional sync service: local IndexedDB ↔ Supabase.
 *
 * Push (local → cloud)
 *   Dexie hooks registered at module load fire on every local write.
 *   When `currentUserId` is set (user signed in), the change is pushed to
 *   the matching cloud table. Writes originating from the cloud are tracked
 *   in `_cloudIds` to prevent echo-back loops.
 *
 * Pull (cloud → local)
 *   On sign-in, `pullFromCloud` fetches all cloud records and applies them
 *   locally with last-write-wins conflict resolution.
 *   After that, a Supabase Realtime channel streams INSERT / UPDATE / DELETE
 *   events from other devices.
 *
 * Offline handling
 *   Failed cloud pushes are stored in a localStorage queue. The queue is
 *   flushed when `startSync` is called and on the `window.online` event.
 */

import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { Json } from '../types/supabase'
import { db } from './db'
import { supabase } from './supabase'
import type { MealPlan, Recipe, ShoppingList } from '../types'

// ─── Module state ─────────────────────────────────────────────────────────────

let currentUserId: string | null = null
let channel: RealtimeChannel | null = null

/**
 * IDs currently being written from the cloud to local IndexedDB.
 * Format: "<table>:<id>" — prevents the Dexie hook from pushing the change
 * back to the cloud (infinite loop protection).
 */
const _cloudIds = new Set<string>()

function markCloud(table: string, id: string) {
  _cloudIds.add(`${table}:${id}`)
}
function unmarkCloud(table: string, id: string) {
  _cloudIds.delete(`${table}:${id}`)
}
function isCloud(table: string, id: string) {
  return _cloudIds.has(`${table}:${id}`)
}

// ─── Pending offline queue ────────────────────────────────────────────────────

const PENDING_KEY = 'mise:sync:pending'

interface PendingItem {
  table: 'recipes' | 'meal_plans' | 'shopping_lists'
  id: string
  op: 'upsert' | 'delete'
}

function getPending(): PendingItem[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]') as PendingItem[]
  } catch {
    return []
  }
}

function addPending(item: PendingItem): void {
  const pending = getPending()
  if (!pending.some((p) => p.table === item.table && p.id === item.id)) {
    pending.push(item)
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending))
  }
}

function removePending(table: string, id: string): void {
  const filtered = getPending().filter((p) => !(p.table === table && p.id === id))
  localStorage.setItem(PENDING_KEY, JSON.stringify(filtered))
}

// ─── Push helpers ─────────────────────────────────────────────────────────────

export async function pushRecipe(recipe: Recipe, userId: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('recipes_cloud').upsert(
    {
      id: recipe.id,
      author_id: userId,
      data: recipe as unknown as Json,
      updated_at: recipe.dateModified,
    },
    { onConflict: 'id' }
  )
  if (error) {
    addPending({ table: 'recipes', id: recipe.id, op: 'upsert' })
  } else {
    removePending('recipes', recipe.id)
  }
}

export async function deleteCloudRecipe(id: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('recipes_cloud').delete().eq('id', id)
  if (error) addPending({ table: 'recipes', id, op: 'delete' })
  else removePending('recipes', id)
}

export async function pushMealPlan(plan: MealPlan, userId: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('meal_plans_cloud').upsert(
    { id: plan.id, owner_id: userId, data: plan as unknown as Json, updated_at: plan.updatedAt },
    { onConflict: 'id' }
  )
  if (error) addPending({ table: 'meal_plans', id: plan.id, op: 'upsert' })
  else removePending('meal_plans', plan.id)
}

export async function deleteCloudMealPlan(id: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('meal_plans_cloud').delete().eq('id', id)
  if (error) addPending({ table: 'meal_plans', id, op: 'delete' })
  else removePending('meal_plans', id)
}

export async function pushShoppingList(list: ShoppingList, userId: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('shopping_lists_cloud').upsert(
    {
      id: list.id,
      owner_id: userId,
      data: list as unknown as Json,
      updated_at: list.updatedAt,
    },
    { onConflict: 'id' }
  )
  if (error) addPending({ table: 'shopping_lists', id: list.id, op: 'upsert' })
  else removePending('shopping_lists', list.id)
}

export async function deleteCloudShoppingList(id: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('shopping_lists_cloud').delete().eq('id', id)
  if (error) addPending({ table: 'shopping_lists', id, op: 'delete' })
  else removePending('shopping_lists', id)
}

// ─── Pending flush ────────────────────────────────────────────────────────────

export async function flushPending(userId: string): Promise<void> {
  if (!supabase) return
  for (const item of [...getPending()]) {
    try {
      if (item.op === 'upsert') {
        if (item.table === 'recipes') {
          const recipe = await db.recipes.get(item.id)
          if (recipe) await pushRecipe(recipe, userId)
        } else if (item.table === 'meal_plans') {
          const plan = await db.mealPlans.get(item.id)
          if (plan) await pushMealPlan(plan, userId)
        } else if (item.table === 'shopping_lists') {
          const list = await db.shoppingLists.get(item.id)
          if (list) await pushShoppingList(list, userId)
        }
      } else {
        if (item.table === 'recipes') await deleteCloudRecipe(item.id)
        else if (item.table === 'meal_plans') await deleteCloudMealPlan(item.id)
        else if (item.table === 'shopping_lists') await deleteCloudShoppingList(item.id)
      }
    } catch {
      // Item stays in queue; will retry on next flush
    }
  }
}

// ─── Initial pull ─────────────────────────────────────────────────────────────

/** Pull all cloud records for this user and apply them locally (last-write-wins). */
export async function pullFromCloud(userId: string): Promise<void> {
  if (!supabase) return
  await Promise.all([pullRecipes(userId), pullMealPlans(userId), pullShoppingLists(userId)])
}

async function pullRecipes(userId: string): Promise<void> {
  if (!supabase) return
  const { data, error } = await supabase
    .from('recipes_cloud')
    .select('id, data, updated_at')
    .eq('author_id', userId)
  if (error || !data) return

  for (const row of data) {
    const cloudRecipe = row.data as unknown as Recipe
    const local = await db.recipes.get(row.id)
    if (!local || new Date(row.updated_at).getTime() > new Date(local.dateModified).getTime()) {
      markCloud('recipes', row.id)
      try {
        await db.recipes.put({ ...cloudRecipe, id: row.id })
      } finally {
        unmarkCloud('recipes', row.id)
      }
    }
  }
}

async function pullMealPlans(userId: string): Promise<void> {
  if (!supabase) return
  const { data, error } = await supabase
    .from('meal_plans_cloud')
    .select('id, data, updated_at')
    .eq('owner_id', userId)
  if (error || !data) return

  for (const row of data) {
    const cloudPlan = row.data as unknown as MealPlan
    const local = await db.mealPlans.get(row.id)
    if (!local || new Date(row.updated_at).getTime() > new Date(local.updatedAt).getTime()) {
      markCloud('meal_plans', row.id)
      try {
        await db.mealPlans.put({ ...cloudPlan, id: row.id })
      } finally {
        unmarkCloud('meal_plans', row.id)
      }
    }
  }
}

async function pullShoppingLists(userId: string): Promise<void> {
  if (!supabase) return
  const { data, error } = await supabase
    .from('shopping_lists_cloud')
    .select('id, data, updated_at')
    .eq('owner_id', userId)
  if (error || !data) return

  for (const row of data) {
    const cloudList = row.data as unknown as ShoppingList
    const local = await db.shoppingLists.get(row.id)
    if (!local || new Date(row.updated_at).getTime() > new Date(local.updatedAt).getTime()) {
      markCloud('shopping_lists', row.id)
      try {
        await db.shoppingLists.put({ ...cloudList, id: row.id })
      } finally {
        unmarkCloud('shopping_lists', row.id)
      }
    }
  }
}

// ─── Dexie hooks — push (local → cloud) ───────────────────────────────────────
// Registered once at module load. Active only while currentUserId is set.
// The isCloud() guard prevents infinite echo-back loops when cloud → local
// writes trigger these same hooks.

db.recipes.hook('creating', function (primKey, obj) {
  if (!currentUserId || isCloud('recipes', primKey as string)) return
  void pushRecipe(obj as Recipe, currentUserId)
})

db.recipes.hook('updating', function (modifications, primKey, obj) {
  if (!currentUserId || isCloud('recipes', primKey as string)) return
  if (obj) void pushRecipe({ ...obj, ...modifications } as Recipe, currentUserId)
})

db.recipes.hook('deleting', function (primKey) {
  if (!currentUserId || isCloud('recipes', primKey as string)) return
  void deleteCloudRecipe(primKey as string)
})

db.mealPlans.hook('creating', function (primKey, obj) {
  if (!currentUserId || isCloud('meal_plans', primKey as string)) return
  void pushMealPlan(obj as MealPlan, currentUserId)
})

db.mealPlans.hook('updating', function (modifications, primKey, obj) {
  if (!currentUserId || isCloud('meal_plans', primKey as string)) return
  if (obj) void pushMealPlan({ ...obj, ...modifications } as MealPlan, currentUserId)
})

db.mealPlans.hook('deleting', function (primKey) {
  if (!currentUserId || isCloud('meal_plans', primKey as string)) return
  void deleteCloudMealPlan(primKey as string)
})

db.shoppingLists.hook('creating', function (primKey, obj) {
  if (!currentUserId || isCloud('shopping_lists', primKey as string)) return
  void pushShoppingList(obj as ShoppingList, currentUserId)
})

db.shoppingLists.hook('updating', function (modifications, primKey, obj) {
  if (!currentUserId || isCloud('shopping_lists', primKey as string)) return
  if (obj) void pushShoppingList({ ...obj, ...modifications } as ShoppingList, currentUserId)
})

db.shoppingLists.hook('deleting', function (primKey) {
  if (!currentUserId || isCloud('shopping_lists', primKey as string)) return
  void deleteCloudShoppingList(primKey as string)
})

// ─── Realtime handlers ────────────────────────────────────────────────────────

type AnyPayload = RealtimePostgresChangesPayload<Record<string, unknown>>

function handleRealtimeRecipe(payload: AnyPayload): void {
  if (payload.eventType === 'DELETE') {
    const id = (payload.old as { id?: string }).id
    if (!id) return
    markCloud('recipes', id)
    void db.recipes.delete(id).finally(() => unmarkCloud('recipes', id))
    return
  }
  const row = payload.new as { id: string; data: unknown; updated_at: string }
  const cloudRecipe = row.data as Recipe
  markCloud('recipes', row.id)
  void db.recipes
    .get(row.id)
    .then((local) => {
      if (!local || new Date(row.updated_at).getTime() > new Date(local.dateModified).getTime()) {
        return db.recipes.put({ ...cloudRecipe, id: row.id })
      }
    })
    .finally(() => unmarkCloud('recipes', row.id))
}

function handleRealtimeMealPlan(payload: AnyPayload): void {
  if (payload.eventType === 'DELETE') {
    const id = (payload.old as { id?: string }).id
    if (!id) return
    markCloud('meal_plans', id)
    void db.mealPlans.delete(id).finally(() => unmarkCloud('meal_plans', id))
    return
  }
  const row = payload.new as { id: string; data: unknown; updated_at: string }
  const cloudPlan = row.data as MealPlan
  markCloud('meal_plans', row.id)
  void db.mealPlans
    .get(row.id)
    .then((local) => {
      if (!local || new Date(row.updated_at).getTime() > new Date(local.updatedAt).getTime()) {
        return db.mealPlans.put({ ...cloudPlan, id: row.id })
      }
    })
    .finally(() => unmarkCloud('meal_plans', row.id))
}

function handleRealtimeShoppingList(payload: AnyPayload): void {
  if (payload.eventType === 'DELETE') {
    const id = (payload.old as { id?: string }).id
    if (!id) return
    markCloud('shopping_lists', id)
    void db.shoppingLists.delete(id).finally(() => unmarkCloud('shopping_lists', id))
    return
  }
  const row = payload.new as { id: string; data: unknown; updated_at: string }
  const cloudList = row.data as ShoppingList
  markCloud('shopping_lists', row.id)
  void db.shoppingLists
    .get(row.id)
    .then((local) => {
      if (!local || new Date(row.updated_at).getTime() > new Date(local.updatedAt).getTime()) {
        return db.shoppingLists.put({ ...cloudList, id: row.id })
      }
    })
    .finally(() => unmarkCloud('shopping_lists', row.id))
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

let _onlineHandler: (() => void) | null = null

/**
 * Start bidirectional sync for a signed-in user.
 * - Flushes any pending offline writes from a previous session
 * - Subscribes to Realtime for live updates from other devices
 * Resolves when setup is complete (does NOT wait for pullFromCloud —
 * callers should invoke pullFromCloud separately to show loading state).
 */
export async function startSync(userId: string): Promise<void> {
  if (!supabase) return
  if (channel) stopSync()

  currentUserId = userId

  // Flush pending writes from previous offline session
  await flushPending(userId)

  // Register online handler to flush on reconnect
  _onlineHandler = () => void flushPending(userId)
  window.addEventListener('online', _onlineHandler)

  // Subscribe to Realtime
  channel = supabase
    .channel(`sync:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'recipes_cloud', filter: `author_id=eq.${userId}` },
      handleRealtimeRecipe
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'meal_plans_cloud',
        filter: `owner_id=eq.${userId}`,
      },
      handleRealtimeMealPlan
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'shopping_lists_cloud',
        filter: `owner_id=eq.${userId}`,
      },
      handleRealtimeShoppingList
    )
    .subscribe()
}

/** Stop sync and clean up subscriptions. Called on sign-out. */
export function stopSync(): void {
  currentUserId = null

  if (_onlineHandler) {
    window.removeEventListener('online', _onlineHandler)
    _onlineHandler = null
  }

  if (supabase && channel) {
    void supabase.removeChannel(channel)
    channel = null
  }
}
