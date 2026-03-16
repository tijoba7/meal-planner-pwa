/**
 * Engagement service — reactions, comments, ratings on shared recipes.
 *
 * All reads/writes go through Supabase RLS:
 *   - reactions/comments/ratings are only visible when the underlying recipe
 *     is visible (public, friends-only to accepted friends, or own recipe).
 *   - Users can only mutate their own reactions, comments, and ratings.
 *   - Recipe owners can soft-delete any comment on their recipe (moderation).
 *
 * All functions are graceful no-ops when Supabase is not configured.
 */

import { supabase } from './supabase'
import type { Comment, Reaction, Rating, Profile } from '../types/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CommentWithAuthor extends Comment {
  profiles: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null
  replies: CommentWithAuthor[]
}

export interface RecipeReactions {
  userLiked: boolean
  userBookmarked: boolean
  userEmojiCode: string | null
  likeCount: number
  bookmarkCount: number
  emojiCount: number
}

export interface RecipeRating {
  userScore: number | null
  avgScore: number | null
  ratingCount: number
}

export interface EngagementStats {
  likeCount: number
  bookmarkCount: number
  commentCount: number
  avgRating: number | null
  ratingCount: number
}

// ─── Reactions ────────────────────────────────────────────────────────────────

/**
 * Get all reactions for a recipe, optionally scoped to a specific user.
 * Returns counts and the current user's reaction state.
 */
export async function getReactions(
  recipeId: string,
  userId?: string,
): Promise<RecipeReactions> {
  const empty: RecipeReactions = {
    userLiked: false,
    userBookmarked: false,
    userEmojiCode: null,
    likeCount: 0,
    bookmarkCount: 0,
    emojiCount: 0,
  }
  if (!supabase) return empty

  const { data } = await supabase
    .from('reactions')
    .select('user_id, type, emoji_code')
    .eq('recipe_id', recipeId)

  if (!data) return empty

  let userLiked = false
  let userBookmarked = false
  let userEmojiCode: string | null = null
  let likeCount = 0
  let bookmarkCount = 0
  let emojiCount = 0

  for (const r of data as Pick<Reaction, 'user_id' | 'type' | 'emoji_code'>[]) {
    if (r.type === 'like') {
      likeCount++
      if (r.user_id === userId) userLiked = true
    } else if (r.type === 'bookmark') {
      bookmarkCount++
      if (r.user_id === userId) userBookmarked = true
    } else if (r.type === 'emoji') {
      emojiCount++
      if (r.user_id === userId) userEmojiCode = r.emoji_code
    }
  }

  return { userLiked, userBookmarked, userEmojiCode, likeCount, bookmarkCount, emojiCount }
}

/**
 * Toggle a like reaction. Returns the new liked state.
 * Uses optimistic-friendly pattern: insert on add, delete on remove.
 */
export async function toggleLike(
  recipeId: string,
  userId: string,
): Promise<{ liked: boolean; error: Error | null }> {
  if (!supabase) return { liked: false, error: new Error('Supabase not configured') }

  const { data: existing } = await supabase
    .from('reactions')
    .select('id')
    .eq('recipe_id', recipeId)
    .eq('user_id', userId)
    .eq('type', 'like')
    .maybeSingle()

  if (existing) {
    const { error } = await supabase.from('reactions').delete().eq('id', existing.id)
    return { liked: false, error: error ? new Error(error.message) : null }
  }

  const { error } = await supabase
    .from('reactions')
    .insert({ recipe_id: recipeId, user_id: userId, type: 'like' })
  return { liked: !error, error: error ? new Error(error.message) : null }
}

/**
 * Toggle a bookmark reaction. Returns the new bookmarked state.
 */
export async function toggleBookmark(
  recipeId: string,
  userId: string,
): Promise<{ bookmarked: boolean; error: Error | null }> {
  if (!supabase) return { bookmarked: false, error: new Error('Supabase not configured') }

  const { data: existing } = await supabase
    .from('reactions')
    .select('id')
    .eq('recipe_id', recipeId)
    .eq('user_id', userId)
    .eq('type', 'bookmark')
    .maybeSingle()

  if (existing) {
    const { error } = await supabase.from('reactions').delete().eq('id', existing.id)
    return { bookmarked: false, error: error ? new Error(error.message) : null }
  }

  const { error } = await supabase
    .from('reactions')
    .insert({ recipe_id: recipeId, user_id: userId, type: 'bookmark' })
  return { bookmarked: !error, error: error ? new Error(error.message) : null }
}

/**
 * Set an emoji reaction. Pass null to remove the current emoji reaction.
 */
export async function setEmojiReaction(
  recipeId: string,
  userId: string,
  emojiCode: string | null,
): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error('Supabase not configured') }

  // Remove existing emoji reaction first
  await supabase
    .from('reactions')
    .delete()
    .eq('recipe_id', recipeId)
    .eq('user_id', userId)
    .eq('type', 'emoji')

  if (emojiCode === null) return { error: null }

  const { error } = await supabase
    .from('reactions')
    .insert({ recipe_id: recipeId, user_id: userId, type: 'emoji', emoji_code: emojiCode })
  return { error: error ? new Error(error.message) : null }
}

// ─── Comments ─────────────────────────────────────────────────────────────────

/**
 * Fetch all non-deleted comments for a recipe, threaded (replies nested under parents).
 * Soft-deleted comments are retained as placeholders with null body in the tree.
 */
export async function getComments(recipeId: string): Promise<CommentWithAuthor[]> {
  if (!supabase) return []

  const { data } = await supabase
    .from('comments')
    .select('*, profiles(id, display_name, avatar_url)')
    .eq('recipe_id', recipeId)
    .order('created_at', { ascending: true })

  if (!data) return []

  return buildCommentTree(data as unknown as CommentWithAuthor[])
}

function buildCommentTree(flat: CommentWithAuthor[]): CommentWithAuthor[] {
  const byId = new Map<string, CommentWithAuthor>()
  const roots: CommentWithAuthor[] = []

  for (const c of flat) {
    byId.set(c.id, { ...c, replies: [] })
  }

  for (const c of byId.values()) {
    if (c.parent_comment_id) {
      const parent = byId.get(c.parent_comment_id)
      if (parent) {
        parent.replies.push(c)
      } else {
        // orphaned reply (parent was hard-deleted) — show at root
        roots.push(c)
      }
    } else {
      roots.push(c)
    }
  }

  return roots
}

/**
 * Post a new comment (or reply) on a recipe.
 */
export async function addComment(
  recipeId: string,
  userId: string,
  body: string,
  parentCommentId?: string,
): Promise<{ data: CommentWithAuthor | null; error: Error | null }> {
  if (!supabase) return { data: null, error: new Error('Supabase not configured') }

  const { data, error } = await supabase
    .from('comments')
    .insert({
      recipe_id: recipeId,
      user_id: userId,
      body: body.trim(),
      parent_comment_id: parentCommentId ?? null,
    })
    .select('*, profiles(id, display_name, avatar_url)')
    .single()

  if (error || !data) return { data: null, error: error ? new Error(error.message) : null }

  return {
    data: { ...(data as unknown as CommentWithAuthor), replies: [] },
    error: null,
  }
}

/**
 * Soft-delete a comment by setting deleted_at.
 * Only the comment author or recipe owner can call this (enforced by RLS).
 */
export async function deleteComment(commentId: string): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error('Supabase not configured') }

  const { error } = await supabase
    .from('comments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', commentId)
  return { error: error ? new Error(error.message) : null }
}

// ─── Ratings ─────────────────────────────────────────────────────────────────

/**
 * Get aggregate rating and the current user's score for a recipe.
 */
export async function getRating(
  recipeId: string,
  userId?: string,
): Promise<RecipeRating> {
  if (!supabase) return { userScore: null, avgScore: null, ratingCount: 0 }

  const { data } = await supabase
    .from('ratings')
    .select('user_id, score')
    .eq('recipe_id', recipeId)

  if (!data || data.length === 0) return { userScore: null, avgScore: null, ratingCount: 0 }

  const ratings = data as Pick<Rating, 'user_id' | 'score'>[]
  const total = ratings.reduce((sum, r) => sum + r.score, 0)
  const avgScore = Math.round((total / ratings.length) * 10) / 10
  const userRow = userId ? ratings.find((r) => r.user_id === userId) : undefined

  return {
    userScore: userRow?.score ?? null,
    avgScore,
    ratingCount: ratings.length,
  }
}

/**
 * Upsert (set or update) the current user's star rating (1-5).
 */
export async function upsertRating(
  recipeId: string,
  userId: string,
  score: number,
): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error('Supabase not configured') }

  const { error } = await supabase.from('ratings').upsert(
    { recipe_id: recipeId, user_id: userId, score },
    { onConflict: 'user_id,recipe_id' },
  )
  return { error: error ? new Error(error.message) : null }
}

/**
 * Remove the current user's rating for a recipe.
 */
export async function deleteRating(
  recipeId: string,
  userId: string,
): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error('Supabase not configured') }

  const { error } = await supabase
    .from('ratings')
    .delete()
    .eq('recipe_id', recipeId)
    .eq('user_id', userId)
  return { error: error ? new Error(error.message) : null }
}

// ─── Batch engagement stats (for feed cards) ──────────────────────────────────

/**
 * Fetch lightweight engagement stats for a list of recipe IDs.
 * Returns a map of recipeId → stats, suitable for annotating feed cards.
 */
export async function getEngagementStats(
  recipeIds: string[],
): Promise<Record<string, EngagementStats>> {
  if (!supabase || recipeIds.length === 0) return {}

  const [reactionsRes, commentsRes, ratingsRes] = await Promise.all([
    supabase
      .from('reactions')
      .select('recipe_id, type')
      .in('recipe_id', recipeIds),
    supabase
      .from('comments')
      .select('recipe_id')
      .in('recipe_id', recipeIds)
      .is('deleted_at', null),
    supabase
      .from('ratings')
      .select('recipe_id, score')
      .in('recipe_id', recipeIds),
  ])

  const stats: Record<string, EngagementStats> = {}
  const ensureEntry = (id: string): EngagementStats => {
    if (!stats[id]) {
      stats[id] = { likeCount: 0, bookmarkCount: 0, commentCount: 0, avgRating: null, ratingCount: 0 }
    }
    return stats[id]
  }

  for (const r of (reactionsRes.data ?? []) as { recipe_id: string; type: string }[]) {
    const e = ensureEntry(r.recipe_id)
    if (r.type === 'like') e.likeCount++
    else if (r.type === 'bookmark') e.bookmarkCount++
  }

  for (const c of (commentsRes.data ?? []) as { recipe_id: string }[]) {
    ensureEntry(c.recipe_id).commentCount++
  }

  // Aggregate ratings per recipe
  const ratingsByRecipe: Record<string, number[]> = {}
  for (const r of (ratingsRes.data ?? []) as { recipe_id: string; score: number }[]) {
    if (!ratingsByRecipe[r.recipe_id]) ratingsByRecipe[r.recipe_id] = []
    ratingsByRecipe[r.recipe_id].push(r.score)
  }
  for (const [recipeId, scores] of Object.entries(ratingsByRecipe)) {
    const e = ensureEntry(recipeId)
    const total = scores.reduce((s, n) => s + n, 0)
    e.avgRating = Math.round((total / scores.length) * 10) / 10
    e.ratingCount = scores.length
  }

  return stats
}
