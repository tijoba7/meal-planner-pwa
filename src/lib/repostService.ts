/**
 * Repost service — create, fetch, and delete recipe reposts.
 *
 * A repost MUST reference a recipe. Users can optionally attach their own
 * photo (e.g. "I made this!") and a short caption.
 *
 * Visibility inherits from the underlying recipe (enforced by RLS).
 */

import { supabase } from './supabase'
import type { Profile } from '../types/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RepostWithAuthor {
  id: string
  user_id: string
  recipe_id: string
  caption: string | null
  image_url: string | null
  created_at: string
  profiles: Pick<Profile, 'display_name' | 'avatar_url'> | null
  recipes_cloud: {
    id: string
    author_id: string
    data: Record<string, unknown>
    visibility: string
    published_at: string | null
    profiles: Pick<Profile, 'display_name' | 'avatar_url'> | null
  } | null
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Fetch reposts for the friends feed (non-self, visible via RLS).
 * Includes the repost author profile AND the original recipe + its author.
 */
export async function getFriendsReposts(
  currentUserId: string,
  offset = 0,
  limit = 20
): Promise<RepostWithAuthor[]> {
  const { data, error } = await supabase
    .from('reposts')
    .select(
      '*, profiles(display_name, avatar_url), recipes_cloud(id, author_id, data, visibility, published_at, profiles(display_name, avatar_url))'
    )
    .neq('user_id', currentUserId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
    .overrideTypes<RepostWithAuthor[], { merge: false }>()

  if (error || !data) return []
  return data
}

/**
 * Fetch public reposts (for discover/explore pages).
 */
export async function getPublicReposts(
  offset = 0,
  limit = 20
): Promise<RepostWithAuthor[]> {
  const { data, error } = await supabase
    .from('reposts')
    .select(
      '*, profiles(display_name, avatar_url), recipes_cloud(id, author_id, data, visibility, published_at, profiles(display_name, avatar_url))'
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
    .overrideTypes<RepostWithAuthor[], { merge: false }>()

  if (error || !data) return []
  return data
}

/**
 * Get the repost count for a recipe.
 */
export async function getRepostCount(recipeId: string): Promise<number> {
  const { count } = await supabase
    .from('reposts')
    .select('id', { count: 'exact', head: true })
    .eq('recipe_id', recipeId)
  return count ?? 0
}

/**
 * Check if the current user has already reposted a recipe.
 */
export async function hasUserReposted(
  recipeId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('reposts')
    .select('id')
    .eq('recipe_id', recipeId)
    .eq('user_id', userId)
    .maybeSingle()
  return !!data
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Upload a repost image to Supabase Storage.
 * Stored in the `recipe-images` bucket under `reposts/{userId}/`.
 */
export async function uploadRepostImage(
  userId: string,
  file: File
): Promise<{ url: string | null; error: Error | null }> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `reposts/${userId}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from('recipe-images').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })

  if (error) return { url: null, error: new Error(error.message) }

  const { data } = supabase.storage.from('recipe-images').getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

/**
 * Create a repost. Recipe ID is required.
 */
export async function createRepost(
  userId: string,
  recipeId: string,
  caption?: string,
  imageUrl?: string
): Promise<{ data: RepostWithAuthor | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('reposts')
    .insert({
      user_id: userId,
      recipe_id: recipeId,
      caption: caption ?? null,
      image_url: imageUrl ?? null,
    })
    .select(
      '*, profiles(display_name, avatar_url), recipes_cloud(id, author_id, data, visibility, published_at, profiles(display_name, avatar_url))'
    )
    .single()
    .overrideTypes<RepostWithAuthor, { merge: false }>()

  if (error) return { data: null, error: new Error(error.message) }
  return { data, error: null }
}

/**
 * Delete a repost (author only, enforced by RLS).
 */
export async function deleteRepost(repostId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('reposts').delete().eq('id', repostId)
  return { error: error ? new Error(error.message) : null }
}
