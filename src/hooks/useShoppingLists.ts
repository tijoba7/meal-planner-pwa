import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { fromJson, toJson } from '../lib/jsonUtils'
import { shareShoppingListWithHousehold, unshareShoppingList } from '../lib/householdService'
import type { ShoppingList, ShoppingItem } from '../types'

// ─── Query keys ──────────────────────────────────────────────────────────────

export const shoppingListKeys = {
  all: (userId: string) => ['shopping-lists', userId] as const,
  detail: (listId: string) => ['shopping-list', listId] as const,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString()
}

function id(): string {
  return crypto.randomUUID()
}

async function fetchShoppingLists(userId: string): Promise<ShoppingList[]> {
  const { data, error } = await supabase
    .from('shopping_lists_cloud')
    .select('id, data, household_id')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  const lists = data.map((row) => {
    const list = fromJson<ShoppingList>(row.data)
    // Merge DB-level household_id into the list object (source of truth for sharing state)
    if (row.household_id) list.householdId = row.household_id as string
    else delete list.householdId
    return list
  })
  await db.shoppingLists.bulkPut(lists)
  return lists
}

async function fetchShoppingList(listId: string, userId: string): Promise<ShoppingList | null> {
  const { data, error } = await supabase
    .from('shopping_lists_cloud')
    .select('id, data, household_id')
    .eq('id', listId)
    .eq('owner_id', userId)
    .single()

  if (error) {
    const local = await db.shoppingLists.get(listId)
    return local ?? null
  }

  const list = fromJson<ShoppingList>(data.data)
  if (data.household_id) list.householdId = data.household_id as string
  else delete list.householdId
  await db.shoppingLists.put(list)
  return list
}

// ─── Read hooks ───────────────────────────────────────────────────────────────

export function useShoppingLists() {
  const { user } = useAuth()
  const userId = user!.id

  return useQuery({
    queryKey: shoppingListKeys.all(userId),
    queryFn: () => fetchShoppingLists(userId),
  })
}

export function useShoppingList(listId: string) {
  const { user } = useAuth()
  const userId = user!.id

  return useQuery({
    queryKey: shoppingListKeys.detail(listId),
    queryFn: () => fetchShoppingList(listId, userId),
    enabled: !!listId,
  })
}

// ─── Mutation hooks ───────────────────────────────────────────────────────────

export function useCreateShoppingList() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (data: Omit<ShoppingList, 'id' | 'createdAt' | 'updatedAt'>) => {
      const list: ShoppingList = { ...data, id: id(), createdAt: now(), updatedAt: now() }

      const { error } = await supabase.from('shopping_lists_cloud').insert({
        id: list.id,
        owner_id: user!.id,
        data: toJson(list),
      })

      if (error) throw new Error(error.message)

      await db.shoppingLists.put(list)
      return list
    },
    onSuccess: (list) => {
      qc.setQueryData(shoppingListKeys.detail(list.id), list)
      qc.invalidateQueries({ queryKey: shoppingListKeys.all(user!.id) })
    },
  })
}

export function useUpdateShoppingList() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      listId,
      data,
    }: {
      listId: string
      data: Partial<Omit<ShoppingList, 'id' | 'createdAt'>>
    }) => {
      const existing = await fetchShoppingList(listId, user!.id)
      if (!existing) throw new Error('Shopping list not found')

      const updated: ShoppingList = { ...existing, ...data, updatedAt: now() }

      const { error } = await supabase
        .from('shopping_lists_cloud')
        .update({ data: toJson(updated), updated_at: now() })
        .eq('id', listId)
        .eq('owner_id', user!.id)

      if (error) throw new Error(error.message)

      await db.shoppingLists.put(updated)
      return updated
    },
    onSuccess: (list) => {
      qc.setQueryData(shoppingListKeys.detail(list.id), list)
      qc.invalidateQueries({ queryKey: shoppingListKeys.all(user!.id) })
    },
  })
}

export function useDeleteShoppingList() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (listId: string) => {
      const { error } = await supabase
        .from('shopping_lists_cloud')
        .delete()
        .eq('id', listId)
        .eq('owner_id', user!.id)

      if (error) throw new Error(error.message)

      await db.shoppingLists.delete(listId)
    },
    onSuccess: (_v, listId) => {
      qc.removeQueries({ queryKey: shoppingListKeys.detail(listId) })
      qc.invalidateQueries({ queryKey: shoppingListKeys.all(user!.id) })
    },
  })
}

export function useToggleShoppingItem() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ listId, itemId }: { listId: string; itemId: string }) => {
      const existing = await fetchShoppingList(listId, user!.id)
      if (!existing) throw new Error('Shopping list not found')

      const items = existing.items.map((item: ShoppingItem) =>
        item.id === itemId ? { ...item, checked: !item.checked } : item
      )
      const updated: ShoppingList = { ...existing, items, updatedAt: now() }

      const { error } = await supabase
        .from('shopping_lists_cloud')
        .update({ data: toJson(updated), updated_at: now() })
        .eq('id', listId)
        .eq('owner_id', user!.id)

      if (error) throw new Error(error.message)

      await db.shoppingLists.put(updated)
      return updated
    },
    onSuccess: (list) => {
      qc.setQueryData(shoppingListKeys.detail(list.id), list)
      qc.invalidateQueries({ queryKey: shoppingListKeys.all(user!.id) })
    },
  })
}

export function useShareShoppingList() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ listId, householdId }: { listId: string; householdId: string }) => {
      const ok = await shareShoppingListWithHousehold(listId, householdId)
      if (!ok) throw new Error('Failed to share shopping list')
      return { listId, householdId }
    },
    onSuccess: ({ listId, householdId }) => {
      // Optimistically update the cached list
      const detail = qc.getQueryData<ShoppingList | null>(shoppingListKeys.detail(listId))
      if (detail) {
        qc.setQueryData(shoppingListKeys.detail(listId), { ...detail, householdId })
      }
      qc.invalidateQueries({ queryKey: shoppingListKeys.all(user!.id) })
      qc.invalidateQueries({ queryKey: shoppingListKeys.detail(listId) })
    },
  })
}

export function useUnshareShoppingList() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (listId: string) => {
      const ok = await unshareShoppingList(listId)
      if (!ok) throw new Error('Failed to unshare shopping list')
      return listId
    },
    onSuccess: (listId) => {
      const detail = qc.getQueryData<ShoppingList | null>(shoppingListKeys.detail(listId))
      if (detail) {
        const updated = { ...detail }
        delete updated.householdId
        qc.setQueryData(shoppingListKeys.detail(listId), updated)
      }
      qc.invalidateQueries({ queryKey: shoppingListKeys.all(user!.id) })
      qc.invalidateQueries({ queryKey: shoppingListKeys.detail(listId) })
    },
  })
}
