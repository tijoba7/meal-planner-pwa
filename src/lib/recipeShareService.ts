/**
 * Recipe sharing service — publish, visibility, feed, explore, fork.
 *
 * All reads go through Supabase RLS automatically:
 *   public    → any authenticated user
 *   friends   → author's accepted friends only
 *   private   → author only
 *
 * Never call these functions without a signed-in session.
 */

import type { RecipeVisibility } from '../types/supabase'
import type { Recipe } from '../types'
import { supabase } from './supabase'
import { db } from './db'
import { toJson } from './jsonUtils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CloudRecipeWithAuthor {
  id: string
  author_id: string
  data: Recipe
  visibility: RecipeVisibility
  published_at: string | null
  created_at: string
  updated_at: string
  profiles: {
    display_name: string
    avatar_url: string | null
  } | null
}

export interface RecipeCloudMeta {
  visibility: RecipeVisibility
  published: boolean
}

// ─── Publish / visibility ─────────────────────────────────────────────────────

/**
 * Publish or re-publish a local recipe to the cloud with the chosen visibility.
 * If the recipe already exists in `recipes_cloud` (same `id`), it is updated.
 */
export async function publishRecipe(
  recipe: Recipe,
  userId: string,
  visibility: RecipeVisibility
): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error('Supabase not configured') }

  const now = new Date().toISOString()
  const { error } = await supabase.from('recipes_cloud').upsert(
    {
      id: recipe.id,
      author_id: userId,
      data: toJson(recipe),
      visibility,
      published_at: visibility !== 'private' ? now : null,
      updated_at: now,
    },
    { onConflict: 'id' }
  )
  return { error: error ? new Error(error.message) : null }
}

/**
 * Change the visibility of an already-published cloud recipe.
 * Only the author can do this (enforced by RLS).
 */
export async function updateVisibility(
  cloudRecipeId: string,
  visibility: RecipeVisibility
): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error('Supabase not configured') }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('recipes_cloud')
    .update({
      visibility,
      published_at: visibility !== 'private' ? now : null,
    })
    .eq('id', cloudRecipeId)
  return { error: error ? new Error(error.message) : null }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Returns the current cloud state (visibility + published flag) for a local recipe,
 * or null if it has never been published.
 */
export async function getCloudRecipeMeta(recipeId: string): Promise<RecipeCloudMeta | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('recipes_cloud')
    .select('visibility, published_at')
    .eq('id', recipeId)
    .maybeSingle()
  if (!data) return null
  return { visibility: data.visibility, published: data.published_at !== null }
}

/**
 * Fetch a single shared cloud recipe by its ID (with author profile).
 * Returns null if not found or not visible to the current user (RLS).
 */
export async function getSharedRecipe(cloudRecipeId: string): Promise<CloudRecipeWithAuthor | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('recipes_cloud')
    .select('*, profiles(display_name, avatar_url)')
    .eq('id', cloudRecipeId)
    .maybeSingle()
    // Supabase SDK cannot infer the joined profiles shape — override required
    .overrideTypes<CloudRecipeWithAuthor | null, { merge: false }>()
  return data ?? null
}

/**
 * Fetch the friends recipe feed — all non-private recipes visible to the current user
 * from other authors, ordered by published_at descending.
 *
 * RLS ensures friends-only recipes are gated to accepted friends.
 */
export async function getFriendsFeed(
  currentUserId: string,
  offset = 0,
  limit = 20
): Promise<CloudRecipeWithAuthor[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('recipes_cloud')
    .select('*, profiles(display_name, avatar_url)')
    .neq('author_id', currentUserId)
    .neq('visibility', 'private')
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1)
    // Supabase SDK cannot infer the joined profiles shape — override required
    .overrideTypes<CloudRecipeWithAuthor[], { merge: false }>()
  return data ?? []
}

/**
 * Fetch the public explore feed. Only returns `public` recipes from all users.
 */
export async function getPublicFeed(offset = 0, limit = 20): Promise<CloudRecipeWithAuthor[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('recipes_cloud')
    .select('*, profiles(display_name, avatar_url)')
    .eq('visibility', 'public')
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1)
    // Supabase SDK cannot infer the joined profiles shape — override required
    .overrideTypes<CloudRecipeWithAuthor[], { merge: false }>()
  return data ?? []
}

// ─── Fork ─────────────────────────────────────────────────────────────────────

/**
 * Save a cloud recipe into the local IndexedDB collection with attribution.
 * Creates a new local ID; keeps `author` and `url` pointing back to the original.
 */
export async function forkRecipe(cloudRecipe: CloudRecipeWithAuthor): Promise<Recipe> {
  const now = new Date().toISOString()
  const forked: Recipe = {
    ...cloudRecipe.data,
    id: crypto.randomUUID(),
    author: cloudRecipe.profiles?.display_name ?? cloudRecipe.data.author ?? 'Unknown',
    url: `/shared/${cloudRecipe.id}`,
    dateCreated: now,
    dateModified: now,
  }
  await db.recipes.put(forked)
  return forked
}
