import { useCallback, useEffect, useRef, useState } from 'react'
import { Rss } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useProfile } from '../contexts/ProfileContext'
import {
  getFriendsFeed,
  type CloudRecipeWithAuthor,
} from '../lib/recipeShareService'
import StoriesBar, { type StoryItem } from '../components/social/StoriesBar'
import InstaRecipeCard from '../components/social/InstaRecipeCard'
import Skeleton from '../components/Skeleton'
import { durationToMinutes } from '../lib/db'

const PAGE_SIZE = 10

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
      {/* Author row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Skeleton className="w-8 h-8 rounded-full shrink-0" />
        <Skeleton className="h-4 w-32" />
      </div>
      {/* Image */}
      <Skeleton className="aspect-square w-full rounded-none" />
      {/* Action row */}
      <div className="flex gap-2 px-4 py-3">
        <Skeleton className="w-6 h-6 rounded-full" />
        <Skeleton className="w-6 h-6 rounded-full" />
        <Skeleton className="w-6 h-6 rounded-full" />
      </div>
      {/* Like count + caption */}
      <div className="px-4 pb-4 space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  )
}

function StoriesBarSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5 min-w-[56px]">
          <Skeleton className="w-10 h-10 rounded-full" />
          <Skeleton className="h-2.5 w-10" />
        </div>
      ))}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function itemToInstaRecipe(item: CloudRecipeWithAuthor) {
  const r = item.data
  const prepMins = durationToMinutes(r.prepTime)
  const cookMins = durationToMinutes(r.cookTime)
  const totalMins = prepMins + cookMins

  return {
    id: item.id,
    name: r.name,
    description: totalMins > 0 ? `${totalMins} min` : r.description,
    imageUrl: r.image,
    imageThumbnailUrl: r.imageThumbnailUrl,
    publishedAt: item.published_at ?? item.created_at,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const { user } = useAuth()
  const { profile } = useProfile()

  const [items, setItems] = useState<CloudRecipeWithAuthor[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sentinelRef = useRef<HTMLDivElement>(null)

  // Stories are derived from feed authors (stub — engineers will wire real stories)
  const stories: StoryItem[] = items
    .reduce<StoryItem[]>((acc, item) => {
      if (acc.some((s) => s.userId === item.author_id)) return acc
      acc.push({
        userId: item.author_id,
        profile: {
          display_name: item.profiles?.display_name ?? 'User',
          avatar_url: item.profiles?.avatar_url ?? null,
        },
        hasNew: true,
      })
      return acc
    }, [])
    .slice(0, 10)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    setError(null)
    getFriendsFeed(user.id, 0, PAGE_SIZE)
      .then((data) => {
        setItems(data)
        setOffset(data.length)
        setHasMore(data.length === PAGE_SIZE)
      })
      .catch(() => setError('Failed to load feed.'))
      .finally(() => setLoading(false))
  }, [user])

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || !user) return
    setLoadingMore(true)
    getFriendsFeed(user.id, offset, PAGE_SIZE)
      .then((data) => {
        setItems((prev) => [...prev, ...data])
        setOffset((o) => o + data.length)
        setHasMore(data.length === PAGE_SIZE)
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false))
  }, [loadingMore, hasMore, user, offset])

  useEffect(() => {
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore()
      },
      { rootMargin: '300px' }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [loadMore])

  // ── Not signed in ──────────────────────────────────────────────────────────

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <Rss size={40} className="text-gray-300 dark:text-gray-600 mb-3" strokeWidth={1.5} />
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Sign in to see recipes from people you follow.
        </p>
      </div>
    )
  }

  // ── Feed ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-lg mx-auto">
      {/* Stories bar */}
      {loading ? (
        <StoriesBarSkeleton />
      ) : (
        <StoriesBar
          stories={stories}
          currentUserProfile={profile}
          onAddStory={() => {
            /* engineers: open story composer */
          }}
          onStoryClick={(_userId) => {
            /* engineers: open story viewer */
          }}
        />
      )}

      {/* Feed */}
      {error ? (
        <p className="text-sm text-red-500 dark:text-red-400 text-center py-12">{error}</p>
      ) : loading ? (
        <div aria-busy="true" aria-label="Loading feed">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <Rss size={40} className="text-gray-300 dark:text-gray-600 mb-3" strokeWidth={1.5} />
          <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">
            Nothing in your feed yet
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Follow people from the Discover tab to see their recipes here.
          </p>
        </div>
      ) : (
        <div aria-live="polite">
          {items.map((item) => (
            <InstaRecipeCard
              key={item.id}
              recipe={itemToInstaRecipe(item)}
              author={{
                id: item.author_id,
                display_name: item.profiles?.display_name ?? 'Unknown',
                avatar_url: item.profiles?.avatar_url ?? null,
              }}
              likeCount={0}
              commentCount={0}
              isFollowing={true}
              onLike={() => {
                /* engineers: wire to engagementService */
              }}
              onUnlike={() => {
                /* engineers: wire to engagementService */
              }}
              onCommentClick={() => {
                /* engineers: open comment sheet */
              }}
              onShareClick={() => {
                /* engineers: open ShareDialog */
              }}
            />
          ))}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef}>
            {loadingMore && (
              <div className="flex justify-center py-6" aria-label="Loading more">
                <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!hasMore && items.length > 0 && (
              <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-8">
                You're all caught up
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
