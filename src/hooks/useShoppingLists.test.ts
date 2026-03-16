import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import {
  buildBuilder,
  createTestQueryClient,
  createWrapper,
  fakeUser,
} from '../test/supabaseMocks'
import type { ShoppingList, ShoppingItem } from '../types'

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => fakeUser(),
}))

import { supabase } from '../lib/supabase'
import {
  useShoppingLists,
  useShoppingList,
  useCreateShoppingList,
  useDeleteShoppingList,
  useToggleShoppingItem,
} from './useShoppingLists'
import { db } from '../lib/db'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeList(overrides: Partial<ShoppingList> = {}): ShoppingList {
  return {
    id: 'list-001',
    name: 'Weekly Shopping',
    items: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeItem(overrides: Partial<ShoppingItem> = {}): ShoppingItem {
  return {
    id: 'item-001',
    name: 'Milk',
    amount: 1,
    unit: 'L',
    checked: false,
    ...overrides,
  }
}

beforeEach(async () => {
  vi.mocked(supabase.from).mockReset()
  if (!db.isOpen()) await db.open()
  await db.shoppingLists.clear()
})

// ─── useShoppingLists ─────────────────────────────────────────────────────────

describe('useShoppingLists', () => {
  it('returns lists fetched from Supabase', async () => {
    const list = makeList()
    vi.mocked(supabase.from).mockReturnValue(
      buildBuilder({ data: [{ id: list.id, data: list }], error: null }) as never,
    )

    const { result } = renderHook(() => useShoppingLists(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].name).toBe('Weekly Shopping')
  })

  it('writes fetched lists to Dexie cache', async () => {
    const list = makeList({ id: 'list-cache' })
    vi.mocked(supabase.from).mockReturnValue(
      buildBuilder({ data: [{ id: list.id, data: list }], error: null }) as never,
    )

    const { result } = renderHook(() => useShoppingLists(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const cached = await db.shoppingLists.get('list-cache')
    expect(cached?.name).toBe('Weekly Shopping')
  })

  it('enters error state when Supabase fails', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      buildBuilder({ data: null, error: { message: 'fetch failed' } }) as never,
    )

    const { result } = renderHook(() => useShoppingLists(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

// ─── useShoppingList ──────────────────────────────────────────────────────────

describe('useShoppingList', () => {
  it('fetches a single list by ID', async () => {
    const list = makeList({ id: 'list-single', name: 'Single List' })
    const builder = buildBuilder({ data: { id: list.id, data: list }, error: null })
    builder.single.mockResolvedValue({ data: { id: list.id, data: list }, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const { result } = renderHook(() => useShoppingList('list-single'), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.name).toBe('Single List')
  })

  it('falls back to Dexie when Supabase errors', async () => {
    const list = makeList({ id: 'list-offline', name: 'Offline List' })
    await db.shoppingLists.put(list)

    const builder = buildBuilder({ data: null, error: { message: 'offline' } })
    builder.single.mockResolvedValue({ data: null, error: { message: 'offline' } })
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const { result } = renderHook(() => useShoppingList('list-offline'), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.name).toBe('Offline List')
  })

  it('is disabled when listId is empty', () => {
    const { result } = renderHook(() => useShoppingList(''), {
      wrapper: createWrapper(createTestQueryClient()),
    })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

// ─── useCreateShoppingList ────────────────────────────────────────────────────

describe('useCreateShoppingList', () => {
  it('creates a list in Supabase and writes to Dexie', async () => {
    const builder = buildBuilder({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const { result } = renderHook(() => useCreateShoppingList(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    result.current.mutate({ name: 'New List', items: [] })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const list = result.current.data!
    expect(list.name).toBe('New List')
    expect(list.id).toBeTruthy()

    const cached = await db.shoppingLists.get(list.id)
    expect(cached?.name).toBe('New List')
  })

  it('surfaces Supabase error when insert fails', async () => {
    const builder = buildBuilder({ data: null, error: { message: 'insert failed' } })
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const { result } = renderHook(() => useCreateShoppingList(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    result.current.mutate({ name: 'Bad List', items: [] })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('insert failed')
  })
})

// ─── useDeleteShoppingList ────────────────────────────────────────────────────

describe('useDeleteShoppingList', () => {
  it('deletes from Supabase and Dexie', async () => {
    const list = makeList({ id: 'list-delete' })
    await db.shoppingLists.put(list)

    const builder = buildBuilder({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const { result } = renderHook(() => useDeleteShoppingList(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    result.current.mutate('list-delete')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const gone = await db.shoppingLists.get('list-delete')
    expect(gone).toBeUndefined()
  })
})

// ─── useToggleShoppingItem ────────────────────────────────────────────────────

describe('useToggleShoppingItem', () => {
  it('toggles an item from unchecked to checked', async () => {
    const item = makeItem({ id: 'item-toggle', checked: false })
    const list = makeList({ id: 'list-toggle', items: [item] })

    // First call: fetchShoppingList (single) → returns the list
    const fetchBuilder = buildBuilder({ data: { id: list.id, data: list }, error: null })
    fetchBuilder.single.mockResolvedValue({ data: { id: list.id, data: list }, error: null })
    // Second call: update → success
    const updateBuilder = buildBuilder({ data: null, error: null })

    vi.mocked(supabase.from)
      .mockReturnValueOnce(fetchBuilder as never)
      .mockReturnValueOnce(updateBuilder as never)

    const { result } = renderHook(() => useToggleShoppingItem(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    result.current.mutate({ listId: 'list-toggle', itemId: 'item-toggle' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const updated = result.current.data!
    const toggledItem = updated.items.find((i) => i.id === 'item-toggle')
    expect(toggledItem?.checked).toBe(true)
  })

  it('toggles an item from checked to unchecked', async () => {
    const item = makeItem({ id: 'item-uncheck', checked: true })
    const list = makeList({ id: 'list-uncheck', items: [item] })

    const fetchBuilder = buildBuilder({ data: { id: list.id, data: list }, error: null })
    fetchBuilder.single.mockResolvedValue({ data: { id: list.id, data: list }, error: null })
    const updateBuilder = buildBuilder({ data: null, error: null })

    vi.mocked(supabase.from)
      .mockReturnValueOnce(fetchBuilder as never)
      .mockReturnValueOnce(updateBuilder as never)

    const { result } = renderHook(() => useToggleShoppingItem(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    result.current.mutate({ listId: 'list-uncheck', itemId: 'item-uncheck' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const toggledItem = result.current.data!.items.find((i) => i.id === 'item-uncheck')
    expect(toggledItem?.checked).toBe(false)
  })
})
