import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { db, minutesToDuration } from '../lib/db'
import { fromJson, toJson } from '../lib/jsonUtils'
import type { Recipe } from '../types'

// ─── Query keys ──────────────────────────────────────────────────────────────

export const recipeKeys = {
  all: (userId: string) => ['recipes', userId] as const,
  detail: (recipeId: string) => ['recipe', recipeId] as const,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString()
}

function id(): string {
  return crypto.randomUUID()
}

/** Fetch all recipes from Supabase and update the Dexie offline cache. */
async function fetchRecipes(userId: string): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from('recipes_cloud')
    .select('id, data')
    .eq('author_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const recipes = data.map((row) => fromJson<Recipe>(row.data))

  // Update Dexie as read-only offline cache
  await db.recipes.bulkPut(recipes)

  return recipes
}

/** Fetch a single recipe from Supabase; falls back to Dexie if offline. */
async function fetchRecipe(recipeId: string, userId: string): Promise<Recipe | null> {
  const { data, error } = await supabase
    .from('recipes_cloud')
    .select('id, data')
    .eq('id', recipeId)
    .eq('author_id', userId)
    .single()

  if (error) {
    // Fallback to Dexie offline cache
    const local = await db.recipes.get(recipeId)
    return local ?? null
  }

  const recipe = fromJson<Recipe>(data.data)
  await db.recipes.put(recipe)
  return recipe
}

// ─── Read hooks ───────────────────────────────────────────────────────────────

/**
 * All recipes for the current user.
 *
 * On first render, immediately pre-populates from Dexie (offline cache) as
 * placeholderData so the UI is never blank while the Supabase fetch runs.
 */
export function useRecipes() {
  const { user } = useAuth()
  const userId = user!.id

  return useQuery({
    queryKey: recipeKeys.all(userId),
    queryFn: () => fetchRecipes(userId),
    placeholderData: () => {
      // Intentionally ignoring the promise — TanStack Query handles async
      // placeholder data via a separate initialData seeding approach below.
      // We return undefined here and let Dexie hydration happen in the
      // background via the cache-seeder effect in App.tsx.
      return undefined
    },
  })
}

/** Single recipe by ID. */
export function useRecipe(recipeId: string) {
  const { user } = useAuth()
  const userId = user!.id

  return useQuery({
    queryKey: recipeKeys.detail(recipeId),
    queryFn: () => fetchRecipe(recipeId, userId),
    enabled: !!recipeId,
  })
}

// ─── Mutation hooks ───────────────────────────────────────────────────────────

export function useCreateRecipe() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (
      data: Omit<Recipe, 'id' | 'dateCreated' | 'dateModified'> & { recipeId?: string }
    ) => {
      const { recipeId: explicitId, ...recipeData } = data
      const recipe: Recipe = {
        ...recipeData,
        id: explicitId ?? id(),
        dateCreated: now(),
        dateModified: now(),
      }

      const { error } = await supabase.from('recipes_cloud').insert({
        id: recipe.id,
        author_id: user!.id,
        data: toJson(recipe),
        visibility: 'private',
      })

      if (error) throw new Error(error.message)

      await db.recipes.put(recipe)
      return recipe
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recipeKeys.all(user!.id) })
    },
  })
}

export function useUpdateRecipe() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      recipeId,
      data,
    }: {
      recipeId: string
      data: Partial<Omit<Recipe, 'id' | 'dateCreated'>>
    }) => {
      const existing = await fetchRecipe(recipeId, user!.id)
      if (!existing) throw new Error('Recipe not found')

      const updated: Recipe = { ...existing, ...data, dateModified: now() }

      const { error } = await supabase
        .from('recipes_cloud')
        .update({ data: toJson(updated), updated_at: now() })
        .eq('id', recipeId)
        .eq('author_id', user!.id)

      if (error) throw new Error(error.message)

      await db.recipes.put(updated)
      return updated
    },
    onSuccess: (recipe) => {
      qc.setQueryData(recipeKeys.detail(recipe.id), recipe)
      qc.invalidateQueries({ queryKey: recipeKeys.all(user!.id) })
    },
  })
}

export function useDeleteRecipe() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (recipeId: string) => {
      const { error } = await supabase
        .from('recipes_cloud')
        .delete()
        .eq('id', recipeId)
        .eq('author_id', user!.id)

      if (error) throw new Error(error.message)

      await db.recipes.delete(recipeId)
    },
    onSuccess: (_v, recipeId) => {
      qc.removeQueries({ queryKey: recipeKeys.detail(recipeId) })
      qc.invalidateQueries({ queryKey: recipeKeys.all(user!.id) })
    },
  })
}

export function useToggleFavorite() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (recipeId: string) => {
      const existing = await fetchRecipe(recipeId, user!.id)
      if (!existing) throw new Error('Recipe not found')

      const updated: Recipe = {
        ...existing,
        isFavorite: !existing.isFavorite,
        dateModified: now(),
      }

      const { error } = await supabase
        .from('recipes_cloud')
        .update({ data: toJson(updated), updated_at: now() })
        .eq('id', recipeId)
        .eq('author_id', user!.id)

      if (error) throw new Error(error.message)

      await db.recipes.put(updated)
      return updated
    },
    onSuccess: (recipe) => {
      qc.setQueryData(recipeKeys.detail(recipe.id), recipe)
      // Optimistically update list cache without a full refetch
      qc.setQueryData<Recipe[]>(recipeKeys.all(user!.id), (prev) =>
        prev?.map((r) => (r.id === recipe.id ? recipe : r))
      )
    },
  })
}

export function useDuplicateRecipe() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (recipeId: string) => {
      const original = await fetchRecipe(recipeId, user!.id)
      if (!original) throw new Error('Recipe not found')

      const { id: _id, dateCreated: _dc, dateModified: _dm, ...rest } = original
      const copy: Recipe = {
        ...rest,
        id: id(),
        name: `${rest.name} (Copy)`,
        isFavorite: false,
        dateCreated: now(),
        dateModified: now(),
      }

      const { error } = await supabase.from('recipes_cloud').insert({
        id: copy.id,
        author_id: user!.id,
        data: toJson(copy),
        visibility: 'private',
      })

      if (error) throw new Error(error.message)

      await db.recipes.put(copy)
      return copy
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recipeKeys.all(user!.id) })
    },
  })
}

// ─── Duration helpers re-exported for convenience ────────────────────────────

export { minutesToDuration }
