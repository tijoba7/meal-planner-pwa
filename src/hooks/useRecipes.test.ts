import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import {
  buildBuilder,
  createTestQueryClient,
  createWrapper,
  fakeUser,
  TEST_USER_ID,
} from '../test/supabaseMocks'
import type { Recipe } from '../types'

// ─── Module mocks (must be at top level) ─────────────────────────────────────

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

// Import after mocks are declared so Vitest hoists correctly
import { supabase } from '../lib/supabase'
import { useRecipes, useRecipe, useCreateRecipe, useDeleteRecipe, useToggleFavorite } from './useRecipes'
import { db } from '../lib/db'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'recipe-001',
    name: 'Test Pasta',
    description: 'A test recipe',
    recipeYield: '2',
    prepTime: 'PT10M',
    cookTime: 'PT20M',
    recipeIngredient: [{ name: 'pasta', amount: 200, unit: 'g' }],
    recipeInstructions: [{ '@type': 'HowToStep', text: 'Boil water.' }],
    keywords: ['pasta'],
    dateCreated: '2026-01-01T00:00:00.000Z',
    dateModified: '2026-01-01T00:00:00.000Z',
    isFavorite: false,
    ...overrides,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Clears Dexie tables between tests. */
beforeEach(async () => {
  vi.mocked(supabase.from).mockReset()
  if (!db.isOpen()) await db.open()
  await db.recipes.clear()
})

// ─── useRecipes ───────────────────────────────────────────────────────────────

describe('useRecipes', () => {
  it('returns recipes fetched from Supabase', async () => {
    const recipe = makeRecipe()
    vi.mocked(supabase.from).mockReturnValue(
      buildBuilder({ data: [{ id: recipe.id, data: recipe }], error: null }) as never,
    )

    const { result } = renderHook(() => useRecipes(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].name).toBe('Test Pasta')
  })

  it('populates the Dexie cache after a successful fetch', async () => {
    const recipe = makeRecipe()
    vi.mocked(supabase.from).mockReturnValue(
      buildBuilder({ data: [{ id: recipe.id, data: recipe }], error: null }) as never,
    )

    const { result } = renderHook(() => useRecipes(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const cached = await db.recipes.get(recipe.id)
    expect(cached?.name).toBe('Test Pasta')
  })

  it('enters error state when Supabase returns an error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      buildBuilder({ data: null, error: { message: 'connection refused' } }) as never,
    )

    const { result } = renderHook(() => useRecipes(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('connection refused')
  })

  it('returns an empty array when no recipes exist', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      buildBuilder({ data: [], error: null }) as never,
    )

    const { result } = renderHook(() => useRecipes(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(0)
  })
})

// ─── useRecipe ────────────────────────────────────────────────────────────────

describe('useRecipe', () => {
  it('fetches a single recipe by ID', async () => {
    const recipe = makeRecipe({ id: 'recipe-single' })
    // single() is the terminal call for single-row queries
    const builder = buildBuilder({ data: { id: recipe.id, data: recipe }, error: null })
    builder.single.mockResolvedValue({ data: { id: recipe.id, data: recipe }, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const { result } = renderHook(() => useRecipe('recipe-single'), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.name).toBe('Test Pasta')
  })

  it('falls back to Dexie when Supabase returns an error', async () => {
    const recipe = makeRecipe({ id: 'recipe-offline' })
    await db.recipes.put(recipe)

    const builder = buildBuilder({ data: null, error: { message: 'network error' } })
    builder.single.mockResolvedValue({ data: null, error: { message: 'network error' } })
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const { result } = renderHook(() => useRecipe('recipe-offline'), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.name).toBe('Test Pasta')
  })

  it('returns null when the recipe is not in Supabase or Dexie', async () => {
    const builder = buildBuilder({ data: null, error: { message: 'not found' } })
    builder.single.mockResolvedValue({ data: null, error: { message: 'not found' } })
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const { result } = renderHook(() => useRecipe('nonexistent'), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it('is disabled when recipeId is empty', () => {
    const { result } = renderHook(() => useRecipe(''), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })
})

// ─── useCreateRecipe ──────────────────────────────────────────────────────────

describe('useCreateRecipe', () => {
  it('inserts a recipe into Supabase and writes to Dexie', async () => {
    const builder = buildBuilder({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const qc = createTestQueryClient()
    const { result } = renderHook(() => useCreateRecipe(), {
      wrapper: createWrapper(qc),
    })

    const input = {
      name: 'New Soup',
      description: 'Tasty soup',
      recipeYield: '4',
      prepTime: 'PT5M',
      cookTime: 'PT30M',
      recipeIngredient: [{ name: 'water', amount: 500, unit: 'ml' }],
      recipeInstructions: [{ '@type': 'HowToStep' as const, text: 'Boil water.' }],
      keywords: ['soup'],
    }

    let created: Recipe | undefined
    await waitFor(async () => {
      result.current.mutate(input)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    created = result.current.data

    expect(created?.name).toBe('New Soup')
    expect(created?.id).toBeTruthy()

    // Check Dexie was updated
    const dexieRecord = await db.recipes.get(created!.id)
    expect(dexieRecord?.name).toBe('New Soup')
  })

  it('surfaces the Supabase error when insert fails', async () => {
    const builder = buildBuilder({ data: null, error: { message: 'insert failed' } })
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const { result } = renderHook(() => useCreateRecipe(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    result.current.mutate({
      name: 'Bad Recipe',
      description: '',
      recipeYield: '1',
      prepTime: 'PT0M',
      cookTime: 'PT0M',
      recipeIngredient: [],
      recipeInstructions: [],
      keywords: [],
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('insert failed')
  })
})

// ─── useDeleteRecipe ──────────────────────────────────────────────────────────

describe('useDeleteRecipe', () => {
  it('deletes from Supabase and removes from Dexie', async () => {
    const recipe = makeRecipe({ id: 'recipe-to-delete' })
    await db.recipes.put(recipe)

    const builder = buildBuilder({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const { result } = renderHook(() => useDeleteRecipe(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    result.current.mutate('recipe-to-delete')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const gone = await db.recipes.get('recipe-to-delete')
    expect(gone).toBeUndefined()
  })

  it('surfaces Supabase error when delete fails', async () => {
    const builder = buildBuilder({ data: null, error: { message: 'delete failed' } })
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const { result } = renderHook(() => useDeleteRecipe(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    result.current.mutate('any-id')
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('delete failed')
  })
})

// ─── useToggleFavorite ────────────────────────────────────────────────────────

describe('useToggleFavorite', () => {
  it('flips isFavorite from false to true', async () => {
    const recipe = makeRecipe({ id: 'fav-recipe', isFavorite: false })

    // First call: fetchRecipe (single) → returns the recipe
    const fetchBuilder = buildBuilder({ data: { id: recipe.id, data: recipe }, error: null })
    fetchBuilder.single.mockResolvedValue({ data: { id: recipe.id, data: recipe }, error: null })
    // Second call: update → success
    const updateBuilder = buildBuilder({ data: null, error: null })

    vi.mocked(supabase.from)
      .mockReturnValueOnce(fetchBuilder as never)
      .mockReturnValueOnce(updateBuilder as never)

    const { result } = renderHook(() => useToggleFavorite(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    result.current.mutate('fav-recipe')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const updated = result.current.data
    expect(updated?.isFavorite).toBe(true)
  })

  it('flips isFavorite from true to false', async () => {
    const recipe = makeRecipe({ id: 'unfav-recipe', isFavorite: true })

    const fetchBuilder = buildBuilder({ data: { id: recipe.id, data: recipe }, error: null })
    fetchBuilder.single.mockResolvedValue({ data: { id: recipe.id, data: recipe }, error: null })
    const updateBuilder = buildBuilder({ data: null, error: null })

    vi.mocked(supabase.from)
      .mockReturnValueOnce(fetchBuilder as never)
      .mockReturnValueOnce(updateBuilder as never)

    const { result } = renderHook(() => useToggleFavorite(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    result.current.mutate('unfav-recipe')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.isFavorite).toBe(false)
  })
})

// ─── Query key scoping ────────────────────────────────────────────────────────

describe('query key scoping', () => {
  it('scopes recipes by user ID', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      buildBuilder({ data: [], error: null }) as never,
    )

    const qc = createTestQueryClient()
    renderHook(() => useRecipes(), { wrapper: createWrapper(qc) })

    await waitFor(() =>
      expect(qc.getQueryState(['recipes', TEST_USER_ID])).toBeDefined(),
    )
  })
})
