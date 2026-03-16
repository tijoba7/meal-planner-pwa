import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import {
  getFriendsFeed,
  getPublicFeed,
  type CloudRecipeWithAuthor,
} from '../lib/recipeShareService'
import {
  getEngagementStats,
  toggleLike,
  toggleBookmark,
} from '../lib/engagementService'

export const FEED_PAGE_SIZE = 10

// ─── Query keys ──────────────────────────────────────────────────────────────

export const feedKeys = {
  friends: (userId: string) => ['feed', 'friends', userId] as const,
  public: () => ['feed', 'public'] as const,
  trending: () => ['feed', 'trending'] as const,
  engagement: (ids: readonly string[]) =>
    ['engagement', [...ids].sort().join(',')] as const,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNextPageParam(
  lastPage: CloudRecipeWithAuthor[],
  allPages: CloudRecipeWithAuthor[][]
) {
  if (lastPage.length < FEED_PAGE_SIZE) return undefined
  return allPages.reduce((sum, p) => sum + p.length, 0)
}

// ─── Feed hooks ───────────────────────────────────────────────────────────────

/** Infinite feed of recipes from friends (non-private, non-self). */
export function useFriendsFeed() {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  return useInfiniteQuery({
    queryKey: feedKeys.friends(userId),
    queryFn: ({ pageParam }) => getFriendsFeed(userId, pageParam as number, FEED_PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam,
    enabled: !!userId,
  })
}

/** Infinite feed of public recipes from all users. */
export function usePublicFeed() {
  return useInfiniteQuery({
    queryKey: feedKeys.public(),
    queryFn: ({ pageParam }) => getPublicFeed(pageParam as number, FEED_PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam,
  })
}

/**
 * Trending recipes: public recipes from the last 7 days ranked by
 * likes + comments. Falls back to the latest 20 if nothing is recent.
 */
export function useTrendingFeed() {
  return useQuery({
    queryKey: feedKeys.trending(),
    queryFn: async (): Promise<CloudRecipeWithAuthor[]> => {
      const items = await getPublicFeed(0, 100)
      if (items.length === 0) return []

      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1_000
      const recent = items.filter((item) => {
        const pub = item.published_at ?? item.created_at
        return new Date(pub).getTime() > sevenDaysAgo
      })

      const pool = recent.length > 0 ? recent : items.slice(0, 20)
      const stats = await getEngagementStats(pool.map((i) => i.id))

      return pool
        .sort((a, b) => {
          const aScore = (stats[a.id]?.likeCount ?? 0) + (stats[a.id]?.commentCount ?? 0)
          const bScore = (stats[b.id]?.likeCount ?? 0) + (stats[b.id]?.commentCount ?? 0)
          return bScore - aScore
        })
        .slice(0, 20)
    },
    staleTime: 5 * 60_000, // trending changes slowly
  })
}

// ─── Engagement hooks ─────────────────────────────────────────────────────────

/** Batch engagement stats (like count, comment count, avg rating) for a list of recipe IDs. */
export function useEngagementStats(ids: string[]) {
  return useQuery({
    queryKey: feedKeys.engagement(ids),
    queryFn: () => getEngagementStats(ids),
    enabled: ids.length > 0,
    staleTime: 30_000,
  })
}

/** Toggle like on a shared recipe. Invalidates engagement cache on success. */
export function useToggleLikeMutation() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (recipeId: string) => toggleLike(recipeId, user!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['engagement'] })
    },
  })
}

/** Toggle bookmark on a shared recipe. Invalidates engagement cache on success. */
export function useToggleBookmarkMutation() {
  const { user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (recipeId: string) => toggleBookmark(recipeId, user!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['engagement'] })
    },
  })
}
