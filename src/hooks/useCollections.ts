import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { db } from '../lib/db'
import type { Collection } from '../types'

// ─── Query keys ──────────────────────────────────────────────────────────────

export const collectionKeys = {
  all: (userId: string) => ['collections', userId] as const,
  detail: (collectionId: string) => ['collection', collectionId] as const,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString()
}

function id(): string {
  return crypto.randomUUID()
}

// ─── Read hooks ───────────────────────────────────────────────────────────────

export function useCollections() {
  const { user } = useAuth()

  return useQuery({
    queryKey: collectionKeys.all(user!.id),
    queryFn: () => db.collections.orderBy('createdAt').reverse().toArray(),
  })
}

export function useCollection(collectionId: string) {
  return useQuery({
    queryKey: collectionKeys.detail(collectionId),
    queryFn: () => db.collections.get(collectionId).then((c) => c ?? null),
    enabled: !!collectionId,
  })
}

// ─── Mutation hooks ───────────────────────────────────────────────────────────

export function useCreateCollection() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (data: Omit<Collection, 'id' | 'createdAt' | 'updatedAt'>) => {
      const collection: Collection = { ...data, id: id(), createdAt: now(), updatedAt: now() }
      await db.collections.add(collection)
      return collection
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: collectionKeys.all(user!.id) })
    },
  })
}

export function useUpdateCollection() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      collectionId,
      data,
    }: {
      collectionId: string
      data: Partial<Omit<Collection, 'id' | 'createdAt'>>
    }) => {
      await db.collections.update(collectionId, { ...data, updatedAt: now() })
      const updated = await db.collections.get(collectionId)
      return updated!
    },
    onSuccess: (collection) => {
      qc.setQueryData(collectionKeys.detail(collection.id), collection)
      qc.invalidateQueries({ queryKey: collectionKeys.all(user!.id) })
    },
  })
}

export function useDeleteCollection() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (collectionId: string) => db.collections.delete(collectionId),
    onSuccess: (_v, collectionId) => {
      qc.removeQueries({ queryKey: collectionKeys.detail(collectionId) })
      qc.invalidateQueries({ queryKey: collectionKeys.all(user!.id) })
    },
  })
}

export function useAddRecipeToCollection() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ collectionId, recipeId }: { collectionId: string; recipeId: string }) => {
      const collection = await db.collections.get(collectionId)
      if (!collection) throw new Error('Collection not found')
      if (collection.recipeIds.includes(recipeId)) return collection
      await db.collections.update(collectionId, {
        recipeIds: [...collection.recipeIds, recipeId],
        updatedAt: now(),
      })
      return (await db.collections.get(collectionId))!
    },
    onSuccess: (collection) => {
      qc.setQueryData(collectionKeys.detail(collection.id), collection)
      qc.invalidateQueries({ queryKey: collectionKeys.all(user!.id) })
    },
  })
}

export function useRemoveRecipeFromCollection() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ collectionId, recipeId }: { collectionId: string; recipeId: string }) => {
      const collection = await db.collections.get(collectionId)
      if (!collection) throw new Error('Collection not found')
      await db.collections.update(collectionId, {
        recipeIds: collection.recipeIds.filter((id) => id !== recipeId),
        updatedAt: now(),
      })
      return (await db.collections.get(collectionId))!
    },
    onSuccess: (collection) => {
      qc.setQueryData(collectionKeys.detail(collection.id), collection)
      qc.invalidateQueries({ queryKey: collectionKeys.all(user!.id) })
    },
  })
}
