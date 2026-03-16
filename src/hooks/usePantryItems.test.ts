import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createTestQueryClient, createWrapper, fakeUser, TEST_USER_ID } from '../test/supabaseMocks'
import type { PantryItem } from '../types'

// ─── Module mocks ─────────────────────────────────────────────────────────────

// Pantry items are Dexie-only — no Supabase calls needed.
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => fakeUser(),
}))

import {
  usePantryItems,
  useCreatePantryItem,
  useUpdatePantryItem,
  useDeletePantryItem,
} from './usePantryItems'
import { db } from '../lib/db'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<PantryItem> = {}): PantryItem {
  return {
    id: 'pantry-001',
    name: 'Flour',
    quantity: 500,
    unit: 'g',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(async () => {
  if (!db.isOpen()) await db.open()
  await db.pantryItems.clear()
})

// ─── usePantryItems ───────────────────────────────────────────────────────────

describe('usePantryItems', () => {
  it('returns pantry items from Dexie ordered by name', async () => {
    await db.pantryItems.add(makeItem({ id: 'p-2', name: 'Zucchini' }))
    await db.pantryItems.add(makeItem({ id: 'p-1', name: 'Apples' }))

    const { result } = renderHook(() => usePantryItems(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data![0].name).toBe('Apples')
    expect(result.current.data![1].name).toBe('Zucchini')
  })

  it('returns an empty array when the pantry is empty', async () => {
    const { result } = renderHook(() => usePantryItems(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(0)
  })

  it('scopes query key by user ID', async () => {
    const qc = createTestQueryClient()
    renderHook(() => usePantryItems(), { wrapper: createWrapper(qc) })

    await waitFor(() =>
      expect(qc.getQueryState(['pantry-items', TEST_USER_ID])).toBeDefined(),
    )
  })
})

// ─── useCreatePantryItem ──────────────────────────────────────────────────────

describe('useCreatePantryItem', () => {
  it('creates a pantry item in Dexie', async () => {
    const { result } = renderHook(() => useCreatePantryItem(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    result.current.mutate({ name: 'Rice', quantity: 1000, unit: 'g' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const all = await db.pantryItems.toArray()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('Rice')
    expect(all[0].id).toBeTruthy()
  })

  it('sets createdAt and updatedAt timestamps', async () => {
    const { result } = renderHook(() => useCreatePantryItem(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    result.current.mutate({ name: 'Oil', quantity: 500, unit: 'ml' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const item = result.current.data!
    expect(item.createdAt).toBeTruthy()
    expect(item.updatedAt).toBeTruthy()
  })

  it('preserves optional expiryDate and category', async () => {
    const { result } = renderHook(() => useCreatePantryItem(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    result.current.mutate({
      name: 'Milk',
      quantity: 2,
      unit: 'L',
      expiryDate: '2026-04-01',
      category: 'Dairy & Eggs',
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const item = result.current.data!
    expect(item.expiryDate).toBe('2026-04-01')
    expect(item.category).toBe('Dairy & Eggs')
  })
})

// ─── useUpdatePantryItem ──────────────────────────────────────────────────────

describe('useUpdatePantryItem', () => {
  it('updates quantity and unit', async () => {
    await db.pantryItems.add(makeItem({ id: 'p-update', name: 'Flour', quantity: 500 }))

    const { result } = renderHook(() => useUpdatePantryItem(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    result.current.mutate({ itemId: 'p-update', data: { quantity: 1000 } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const updated = await db.pantryItems.get('p-update')
    expect(updated?.quantity).toBe(1000)
  })

  it('updates updatedAt timestamp on update', async () => {
    await db.pantryItems.add(makeItem({ id: 'p-ts', updatedAt: '2026-01-01T00:00:00.000Z' }))

    const { result } = renderHook(() => useUpdatePantryItem(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    result.current.mutate({ itemId: 'p-ts', data: { quantity: 99 } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const updated = await db.pantryItems.get('p-ts')
    expect(updated?.updatedAt).not.toBe('2026-01-01T00:00:00.000Z')
  })
})

// ─── useDeletePantryItem ──────────────────────────────────────────────────────

describe('useDeletePantryItem', () => {
  it('removes the item from Dexie', async () => {
    await db.pantryItems.add(makeItem({ id: 'p-delete' }))

    const { result } = renderHook(() => useDeletePantryItem(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    result.current.mutate('p-delete')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const gone = await db.pantryItems.get('p-delete')
    expect(gone).toBeUndefined()
  })
})
