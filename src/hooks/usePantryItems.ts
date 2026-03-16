import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { db } from '../lib/db'
import type { PantryItem } from '../types'

// ─── Query keys ──────────────────────────────────────────────────────────────

export const pantryKeys = {
  all: (userId: string) => ['pantry-items', userId] as const,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString()
}

function id(): string {
  return crypto.randomUUID()
}

// ─── Read hook ────────────────────────────────────────────────────────────────

export function usePantryItems() {
  const { user } = useAuth()

  return useQuery({
    queryKey: pantryKeys.all(user!.id),
    queryFn: () => db.pantryItems.orderBy('name').toArray(),
  })
}

// ─── Mutation hooks ───────────────────────────────────────────────────────────

export function useCreatePantryItem() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (data: Omit<PantryItem, 'id' | 'createdAt' | 'updatedAt'>) => {
      const item: PantryItem = { ...data, id: id(), createdAt: now(), updatedAt: now() }
      await db.pantryItems.add(item)
      return item
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pantryKeys.all(user!.id) })
    },
  })
}

export function useUpdatePantryItem() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      itemId,
      data,
    }: {
      itemId: string
      data: Partial<Omit<PantryItem, 'id' | 'createdAt'>>
    }) => {
      await db.pantryItems.update(itemId, { ...data, updatedAt: now() })
      return (await db.pantryItems.get(itemId))!
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pantryKeys.all(user!.id) })
    },
  })
}

export function useDeletePantryItem() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (itemId: string) => db.pantryItems.delete(itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pantryKeys.all(user!.id) })
    },
  })
}
