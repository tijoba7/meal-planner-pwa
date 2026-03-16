import { useCallback, useEffect, useRef, useState } from 'react'
import { Rss, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useProfile } from '../contexts/ProfileContext'
import {
  getFriendsFeed,
  type CloudRecipeWithAuthor,
} from '../lib/recipeShareService'
import {
  getEngagementStats,
  toggleLike,
  toggleBookmark,
  getComments,
  addComment,
  type EngagementStats,
  type CommentWithAuthor,
} from '../lib/engagementService'
import StoriesBar, { type StoryItem } from '../components/social/StoriesBar'
import InstaRecipeCard from '../components/social/InstaRecipeCard'
import CommentThread, { type CommentData } from '../components/social/CommentThread'
import ShareDialog from '../components/social/ShareDialog'
import Skeleton from '../components/Skeleton'
import { durationToMinutes } from '../lib/db'

const PAGE_SIZE = 10

// ─── Helpers ──────────────────────────────────────────────────────────────────

function commentWithAuthorToData(c: CommentWithAuthor): CommentData {
  return {
    id: c.id,
    body: c.body ?? '',
    createdAt: c.created_at,
    author: {
      id: c.profiles?.id ?? '',
      display_name: c.profiles?.display_name ?? 'Unknown',
      avatar_url: c.profiles?.avatar_url ?? null,
    },
    deletedAt: c.deleted_at,
    replies: (c.replies ?? []).map(commentWithAuthorToData),
  }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
      <div className="flex items-center gap-3 px-4 py-3">
        <Skeleton className="w-8 h-8 rounded-full shrink-0" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="flex gap-2 px-4 py-3">
        <Skeleton className="w-6 h-6 rounded-full" />
        <Skeleton className="w-6 h-6 rounded-full" />
        <Skeleton className="w-6 h-6 rounded-full" />
      </div>
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

// ─── Comment bottom sheet ─────────────────────────────────────────────────────

interface CommentSheetProps {
  recipeId: string
  onClose: () => void
}

function CommentSheet({ recipeId, onClose }: CommentSheetProps) {
  const { user } = useAuth()
  const { profile } = useProfile()

  const [comments, setComments] = useState<CommentData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getComments(recipeId)
      .then((raw) => setComments(raw.map(commentWithAuthorToData)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [recipeId])

  async function handleSubmit(body: string, parentId?: string) {
    if (!user) return
    const { data } = await addComment(recipeId, user.id, body, parentId)
    if (data) {
      setComments((prev) => {
        const newComment = commentWithAuthorToData(data)
        if (parentId) {
          return prev.map((c) =>
            c.id === parentId ? { ...c, replies: [...(c.replies ?? []), newComment] } : c
          )
        }
        return [...prev, newComment]
      })
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-t-2xl shadow-xl flex flex-col"
        style={{ maxHeight: '70vh' }}
        role="dialog"
        aria-modal="true"
        aria-label="Comments"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Comments</h3>
          <button
            onClick={onClose}
            aria-label="Close comments"
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-4">
          <CommentThread
            comments={comments}
            currentUserProfile={
              profile && user
                ? { id: user.id, display_name: profile.display_name, avatar_url: profile.avatar_url }
                : undefined
            }
            onSubmit={user ? handleSubmit : undefined}
            isLoading={loading}
          />
        </div>
        <div className="pb-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const { user } = useAuth()

  const [items, setItems] = useState<CloudRecipeWithAuthor[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Engagement stats per recipe (likeCount, commentCount, etc.)
  const [stats, setStats] = useState<Record<string, EngagementStats>>({})

  // Optimistic like/bookmark state (per recipe id)
  const [liked, setLiked] = useState<Record<string, boolean>>({})
  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>({})

  // Comment sheet + share dialog state
  const [commentSheetId, setCommentSheetId] = useState<string | null>(null)
  const [shareItem, setShareItem] = useState<CloudRecipeWithAuthor | null>(null)

  const sentinelRef = useRef<HTMLDivElement>(null)
  const { profile } = useProfile()

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
        // Load engagement stats for the first page
        const ids = data.map((d) => d.id)
        if (ids.length > 0) {
          getEngagementStats(ids).then((s) => setStats((prev) => ({ ...prev, ...s })))
        }
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
        const ids = data.map((d) => d.id)
        if (ids.length > 0) {
          getEngagementStats(ids).then((s) => setStats((prev) => ({ ...prev, ...s })))
        }
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

  function handleLike(recipeId: string) {
    if (!user) return
    // Optimistic update
    setLiked((prev) => ({ ...prev, [recipeId]: true }))
    setStats((prev) => {
      const s = prev[recipeId]
      if (!s) return prev
      return { ...prev, [recipeId]: { ...s, likeCount: s.likeCount + 1 } }
    })
    toggleLike(recipeId, user.id).then(({ liked: newLiked }) => {
      // Revert if server disagrees
      if (!newLiked) {
        setLiked((prev) => ({ ...prev, [recipeId]: false }))
        setStats((prev) => {
          const s = prev[recipeId]
          if (!s) return prev
          return { ...prev, [recipeId]: { ...s, likeCount: Math.max(0, s.likeCount - 1) } }
        })
      }
    })
  }

  function handleUnlike(recipeId: string) {
    if (!user) return
    // Optimistic update
    setLiked((prev) => ({ ...prev, [recipeId]: false }))
    setStats((prev) => {
      const s = prev[recipeId]
      if (!s) return prev
      return { ...prev, [recipeId]: { ...s, likeCount: Math.max(0, s.likeCount - 1) } }
    })
    toggleLike(recipeId, user.id).then(({ liked: newLiked }) => {
      // Revert if server disagrees (already liked = couldn't unlike)
      if (newLiked) {
        setLiked((prev) => ({ ...prev, [recipeId]: true }))
        setStats((prev) => {
          const s = prev[recipeId]
          if (!s) return prev
          return { ...prev, [recipeId]: { ...s, likeCount: s.likeCount + 1 } }
        })
      }
    })
  }

  function handleBookmark(recipeId: string) {
    if (!user) return
    setBookmarked((prev) => ({ ...prev, [recipeId]: true }))
    toggleBookmark(recipeId, user.id).then(({ bookmarked: ok }) => {
      if (!ok) setBookmarked((prev) => ({ ...prev, [recipeId]: false }))
    })
  }

  function handleUnbookmark(recipeId: string) {
    if (!user) return
    setBookmarked((prev) => ({ ...prev, [recipeId]: false }))
    toggleBookmark(recipeId, user.id).then(({ bookmarked: ok }) => {
      if (ok) setBookmarked((prev) => ({ ...prev, [recipeId]: true }))
    })
  }

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
          onAddStory={() => {}}
          onStoryClick={() => {}}
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
          {items.map((item) => {
            const s = stats[item.id]
            const isLiked = liked[item.id] ?? false
            const isBookmarked = bookmarked[item.id] ?? false
            return (
              <InstaRecipeCard
                key={item.id}
                recipe={itemToInstaRecipe(item)}
                author={{
                  id: item.author_id,
                  display_name: item.profiles?.display_name ?? 'Unknown',
                  avatar_url: item.profiles?.avatar_url ?? null,
                }}
                likeCount={s?.likeCount ?? 0}
                commentCount={s?.commentCount ?? 0}
                hasLiked={isLiked}
                hasBookmarked={isBookmarked}
                isFollowing={true}
                onLike={() => handleLike(item.id)}
                onUnlike={() => handleUnlike(item.id)}
                onBookmark={() => handleBookmark(item.id)}
                onUnbookmark={() => handleUnbookmark(item.id)}
                onCommentClick={() => setCommentSheetId(item.id)}
                onShareClick={() => setShareItem(item)}
              />
            )
          })}

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

      {/* Comment bottom sheet */}
      {commentSheetId && (
        <CommentSheet recipeId={commentSheetId} onClose={() => setCommentSheetId(null)} />
      )}

      {/* Share dialog */}
      {shareItem && (
        <ShareDialog
          recipeName={shareItem.data.name}
          shareUrl={`${window.location.origin}/shared/${shareItem.id}`}
          currentVisibility={shareItem.visibility}
          onClose={() => setShareItem(null)}
        />
      )}
    </div>
  )
}
