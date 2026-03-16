/**
 * Stories service — create, fetch, and expire cooking stories.
 *
 * Stories expire after 24 hours (client-side filter on expires_at).
 * Views are tracked locally in localStorage to avoid a dedicated DB table.
 *
 * NOTE: Requires the `stories` table in Supabase:
 *   stories (id, user_id, media_url, caption, linked_recipe_id, created_at, expires_at)
 *   + RLS: friends can view each other's stories; owner can insert/delete.
 */

import { supabase } from './supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoryWithAuthor {
  id: string
  user_id: string
  media_url: string
  caption: string | null
  linked_recipe_id: string | null
  created_at: string
  expires_at: string
  profiles: {
    display_name: string
    avatar_url: string | null
  } | null
}

export interface UserStoryGroup {
  userId: string
  profile: {
    display_name: string
    avatar_url: string | null
  }
  stories: StoryWithAuthor[]
  /** True when any story in this group hasn't been viewed yet. */
  hasNew: boolean
}

// ─── Viewed tracking (localStorage) ──────────────────────────────────────────

const VIEWED_KEY = 'mise_viewed_stories'

export function getViewedStoryIds(): Set<string> {
  try {
    const raw = localStorage.getItem(VIEWED_KEY)
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

export function markStoriesViewed(storyIds: string[]): void {
  if (storyIds.length === 0) return
  const viewed = getViewedStoryIds()
  storyIds.forEach((id) => viewed.add(id))
  // Cap at 1000 IDs — stories expire after 24h so this stays small
  const arr = [...viewed].slice(-1000)
  localStorage.setItem(VIEWED_KEY, JSON.stringify(arr))
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Fetch active (non-expired) stories from friends, grouped by user.
 * Returns [] gracefully if the `stories` table doesn't exist yet.
 */
export async function getFriendsStories(currentUserId: string): Promise<UserStoryGroup[]> {
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('stories')
    .select('*, profiles(display_name, avatar_url)')
    .neq('user_id', currentUserId)
    .gt('expires_at', now)
    .order('created_at', { ascending: true })
    .overrideTypes<StoryWithAuthor[], { merge: false }>()

  if (error || !data) return []

  const viewed = getViewedStoryIds()
  const groupMap = new Map<string, UserStoryGroup>()

  for (const story of data) {
    const uid = story.user_id
    if (!groupMap.has(uid)) {
      groupMap.set(uid, {
        userId: uid,
        profile: story.profiles ?? { display_name: 'User', avatar_url: null },
        stories: [],
        hasNew: false,
      })
    }
    const group = groupMap.get(uid)!
    group.stories.push(story)
    if (!viewed.has(story.id)) group.hasNew = true
  }

  return [...groupMap.values()]
}

/**
 * Fetch all active stories created by the current user.
 * Used to determine whether to show "your story" in the bar.
 */
export async function getMyStories(userId: string): Promise<StoryWithAuthor[]> {
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('stories')
    .select('*, profiles(display_name, avatar_url)')
    .eq('user_id', userId)
    .gt('expires_at', now)
    .order('created_at', { ascending: true })
    .overrideTypes<StoryWithAuthor[], { merge: false }>()

  if (error || !data) return []
  return data
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Upload an image file to Supabase Storage and return its public URL.
 * Stories are stored in the `recipe-images` bucket under a `stories/` prefix.
 */
export async function uploadStoryMedia(
  userId: string,
  file: File
): Promise<{ url: string | null; error: Error | null }> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `stories/${userId}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from('recipe-images').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })

  if (error) return { url: null, error: new Error(error.message) }

  const { data } = supabase.storage.from('recipe-images').getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

/**
 * Create a new story. Expires after 24 hours.
 */
export async function createStory(
  userId: string,
  mediaUrl: string,
  caption?: string,
  linkedRecipeId?: string
): Promise<{ data: StoryWithAuthor | null; error: Error | null }> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('stories')
    .insert({
      user_id: userId,
      media_url: mediaUrl,
      caption: caption ?? null,
      linked_recipe_id: linkedRecipeId ?? null,
      expires_at: expiresAt,
    })
    .select('*, profiles(display_name, avatar_url)')
    .single()
    .overrideTypes<StoryWithAuthor, { merge: false }>()

  if (error) return { data: null, error: new Error(error.message) }
  return { data, error: null }
}

/**
 * Delete a story (author only, enforced by RLS).
 */
export async function deleteStory(storyId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('stories').delete().eq('id', storyId)
  return { error: error ? new Error(error.message) : null }
}
