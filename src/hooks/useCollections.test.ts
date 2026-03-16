import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createTestQueryClient, createWrapper, fakeUser, TEST_USER_ID } from '../test/supabaseMocks'
import type { Collection } from '../types'

// ─── Module mocks ─────────────────────────────────────────────────────────────

// Collections are Dexie-only — no Supabase calls needed.
// Still mock AuthContext so hooks see a valid user.
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => fakeUser(),
}))

import {
  useCollections,
  useCollection,
  useCreateCollection,
  useUpdateCollection,
  useDeleteCollection,
  useAddRecipeToCollection,
  useRemoveRecipeFromCollection,
} from './useCollections'
import { db } from '../lib/db'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeCollection(overrides: Partial<Collection> = {}): Collection {
  return {
    id: 'col-001',
    name: 'Favourites',
    recipeIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(async () => {
  if (!db.isOpen()) await db.open()
  await db.collections.clear()
})

// ─── useCollections ───────────────────────────────────────────────────────────

describe('useCollections', () => {
  it('returns collections from Dexie', async () => {
    await db.collections.add(makeCollection({ id: 'col-a', name: 'Soups' }))
    await db.collections.add(makeCollection({ id: 'col-b', name: 'Pastas' }))

    const { result } = renderHook(() => useCollections(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
  })

  it('returns an empty array when no collections exist', async () => {
    const { result } = renderHook(() => useCollections(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(0)
  })

  it('scopes query key by user ID', async () => {
    const qc = createTestQueryClient()
    renderHook(() => useCollections(), { wrapper: createWrapper(qc) })

    await waitFor(() =>
      expect(qc.getQueryState(['collections', TEST_USER_ID])).toBeDefined(),
    )
  })
})

// ─── useCollection ────────────────────────────────────────────────────────────

describe('useCollection', () => {
  it('returns a single collection by ID', async () => {
    const col = makeCollection({ id: 'col-single', name: 'Desserts' })
    await db.collections.add(col)

    const { result } = renderHook(() => useCollection('col-single'), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.name).toBe('Desserts')
  })

  it('returns null when the collection does not exist', async () => {
    const { result } = renderHook(() => useCollection('nonexistent'), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it('is disabled when collectionId is empty', () => {
    const { result } = renderHook(() => useCollection(''), {
      wrapper: createWrapper(createTestQueryClient()),
    })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

// ─── useCreateCollection ─────────────────────────────────────────────────────

describe('useCreateCollection', () => {
  it('creates a collection in Dexie', async () => {
    const { result } = renderHook(() => useCreateCollection(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    result.current.mutate({ name: 'New Collection', recipeIds: [] })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const all = await db.collections.toArray()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('New Collection')
    expect(all[0].id).toBeTruthy()
  })
})

// ─── useUpdateCollection ──────────────────────────────────────────────────────

describe('useUpdateCollection', () => {
  it('updates the collection name in Dexie', async () => {
    const col = makeCollection({ id: 'col-update', name: 'Old Name' })
    await db.collections.add(col)

    const { result } = renderHook(() => useUpdateCollection(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    result.current.mutate({ collectionId: 'col-update', data: { name: 'New Name' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const updated = await db.collections.get('col-update')
    expect(updated?.name).toBe('New Name')
  })
})

// ─── useDeleteCollection ──────────────────────────────────────────────────────

describe('useDeleteCollection', () => {
  it('deletes the collection from Dexie', async () => {
    await db.collections.add(makeCollection({ id: 'col-delete' }))

    const { result } = renderHook(() => useDeleteCollection(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    result.current.mutate('col-delete')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const gone = await db.collections.get('col-delete')
    expect(gone).toBeUndefined()
  })
})

// ─── useAddRecipeToCollection ─────────────────────────────────────────────────

describe('useAddRecipeToCollection', () => {
  it('adds a recipe ID to the collection', async () => {
    const col = makeCollection({ id: 'col-add', recipeIds: [] })
    await db.collections.add(col)

    const { result } = renderHook(() => useAddRecipeToCollection(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    result.current.mutate({ collectionId: 'col-add', recipeId: 'recipe-xyz' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const updated = await db.collections.get('col-add')
    expect(updated?.recipeIds).toContain('recipe-xyz')
  })

  it('is idempotent — does not add the same recipe twice', async () => {
    const col = makeCollection({ id: 'col-idempotent', recipeIds: ['recipe-existing'] })
    await db.collections.add(col)

    const { result } = renderHook(() => useAddRecipeToCollection(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    result.current.mutate({ collectionId: 'col-idempotent', recipeId: 'recipe-existing' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const updated = await db.collections.get('col-idempotent')
    expect(updated?.recipeIds).toHaveLength(1)
  })
})

// ─── useRemoveRecipeFromCollection ────────────────────────────────────────────

describe('useRemoveRecipeFromCollection', () => {
  it('removes a recipe ID from the collection', async () => {
    const col = makeCollection({ id: 'col-remove', recipeIds: ['recipe-a', 'recipe-b'] })
    await db.collections.add(col)

    const { result } = renderHook(() => useRemoveRecipeFromCollection(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    result.current.mutate({ collectionId: 'col-remove', recipeId: 'recipe-a' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const updated = await db.collections.get('col-remove')
    expect(updated?.recipeIds).toEqual(['recipe-b'])
  })
})
