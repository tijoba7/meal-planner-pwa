import { useCallback, useEffect, useRef, useState } from 'react'
import { Rss, X } from 'lucide-react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { useAuth } from '../contexts/AuthContext'
import { useProfile } from '../contexts/ProfileContext'
import type { CloudRecipeWithAuthor } from '../lib/recipeShareService'
import type { RepostWithAuthor } from '../lib/repostService'
import {
  getComments,
  addComment,
  type CommentWithAuthor,
} from '../lib/engagementService'
import {
  useFriendsFeed,
  useEngagementStats,
  useToggleLikeMutation,
  useToggleBookmarkMutation,
} from '../hooks/useFeed'
import { useFriendsReposts } from '../hooks/useReposts'
import {
  useFriendsStories,
  storyGroupsToBarItems,
  useMarkStoriesViewedMutation,
} from '../hooks/useStories'
import StoriesBar from '../components/social/StoriesBar'
import StoryViewer from '../components/social/StoryViewer'
import StoryComposer from '../components/social/StoryComposer'
import InstaRecipeCard from '../components/social/InstaRecipeCard'
import RepostCard from '../components/social/RepostCard'
import RepostComposer from '../components/social/RepostComposer'
import CommentThread, { type CommentData } from '../components/social/CommentThread'
import Skeleton from '../components/Skeleton'
import { durationToMinutes } from '../lib/db'

// ─── Feed item union type ────────────────────────────────────────────────────

type FeedItem =
  | { kind: 'recipe'; data: CloudRecipeWithAuthor; sortDate: string }
  | { kind: 'repost'; data: RepostWithAuthor; sortDate: string }

function mergeFeedItems(
  recipes: CloudRecipeWithAuthor[],
  reposts: RepostWithAuthor[]
): FeedItem[] {
  const items: FeedItem[] = [
    ...recipes.map((r) => ({
      kind: 'recipe' as const,
      data: r,
      sortDate: r.published_at ?? r.created_at,
    })),
    ...reposts.map((r) => ({
      kind: 'repost' as const,
      data: r,
      sortDate: r.created_at,
    })),
  ]
  return items.sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime())
}

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
      const newComment = commentWithAuthorToData(data)
      setComments((prev) => {
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
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={20} strokeWidth={2} aria-hidden="true" />
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

// ─── Pull-to-refresh ──────────────────────────────────────────────────────────

const PULL_THRESHOLD = 80

interface PullToRefreshProps {
  onRefresh: () => Promise<unknown>
  children: React.ReactNode
}

function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullDelta, setPullDelta] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const touchStartY = useRef(0)
  const pulling = useRef(false)

  function handleTouchStart(e: React.TouchEvent) {
    if (window.scrollY > 0) return
    touchStartY.current = e.touches[0].clientY
    pulling.current = true
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!pulling.current) return
    const delta = e.touches[0].clientY - touchStartY.current
    if (delta > 0) {
      setPullDelta(Math.min(delta, PULL_THRESHOLD * 1.5))
    }
  }

  async function handleTouchEnd() {
    if (!pulling.current) return
    pulling.current = false
    if (pullDelta >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true)
      setPullDelta(PULL_THRESHOLD)
      await onRefresh()
      setRefreshing(false)
    }
    setPullDelta(0)
  }

  const indicatorOffset = Math.min(pullDelta, PULL_THRESHOLD)
  const progress = pullDelta / PULL_THRESHOLD
  const radius = 10
  const circumference = 2 * Math.PI * radius
  const strokeDash = circumference * Math.min(progress, 1)

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {(pullDelta > 0 || refreshing) && (
        <div
          className="flex justify-center overflow-hidden"
          style={{ height: indicatorOffset }}
        >
          <div
            className="flex items-center justify-center w-8 h-8 bg-white dark:bg-gray-800 rounded-full shadow-md"
            style={{ marginTop: Math.max(0, indicatorOffset - 36) }}
          >
            {refreshing ? (
              <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" className="text-green-600">
                <circle
                  cx="12"
                  cy="12"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - strokeDash}
                  strokeLinecap="round"
                  transform="rotate(-90 12 12)"
                />
              </svg>
            )}
          </div>
        </div>
      )}
      {children}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const { user } = useAuth()
  const { profile } = useProfile()

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useFriendsFeed()

  const { data: reposts = [] } = useFriendsReposts()

  const recipeItems = data?.pages.flat() ?? []
  const feedItems = mergeFeedItems(recipeItems, reposts)

  const uniqueIds = [...new Set(
    feedItems.map((fi) => fi.kind === 'recipe' ? fi.data.id : fi.data.recipe_id)
  )]

  const { data: engagementMap = {} } = useEngagementStats(uniqueIds)
  const likeMutation = useToggleLikeMutation()
  const bookmarkMutation = useToggleBookmarkMutation()

  const [commentSheetId, setCommentSheetId] = useState<string | null>(null)
  const [repostTarget, setRepostTarget] = useState<{
    id: string
    name: string
    image?: string
  } | null>(null)
  const [viewerGroupIdx, setViewerGroupIdx] = useState<number | null>(null)
  const [showComposer, setShowComposer] = useState(false)

  // Stories
  const { data: storyGroups = [] } = useFriendsStories()
  const barItems = storyGroupsToBarItems(storyGroups)
  const markViewed = useMarkStoriesViewedMutation()
  const handleStoryViewed = useCallback((id: string) => markViewed.mutate([id]), [markViewed])

  function handleStoryClick(userId: string) {
    const idx = storyGroups.findIndex((g) => g.userId === userId)
    if (idx >= 0) setViewerGroupIdx(idx)
  }

  // ── TanStack Virtual ───────────────────────────────────────────────────────

  const virtualizer = useWindowVirtualizer({
    count: feedItems.length,
    estimateSize: () => 480,
    overscan: 3,
  })

  const virtualItems = virtualizer.getVirtualItems()

  // Trigger infinite scroll load when near end of list
  useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1]
    if (!lastItem) return
    if (lastItem.index >= feedItems.length - 3 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [virtualItems, feedItems.length, hasNextPage, isFetchingNextPage, fetchNextPage])

  // ── Feed ───────────────────────────────────────────────────────────────────

  return (
    <PullToRefresh onRefresh={() => refetch()}>
      <div className="max-w-lg mx-auto">
        {/* Stories bar */}
        {isLoading ? (
          <StoriesBarSkeleton />
        ) : (
          <StoriesBar
            stories={barItems}
            currentUserProfile={profile}
            onAddStory={() => setShowComposer(true)}
            onStoryClick={handleStoryClick}
          />
        )}

        {/* Feed */}
        {isError ? (
          <p className="text-sm text-red-500 dark:text-red-400 text-center py-12">
            Failed to load feed.
          </p>
        ) : isLoading ? (
          <div role="status" aria-busy="true" aria-label="Loading feed">
            {Array.from({ length: 3 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : feedItems.length === 0 ? (
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
          <div
            aria-live="polite"
            style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
          >
            {virtualItems.map((virtualItem) => {
              const fi = feedItems[virtualItem.index]
              return (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  {fi.kind === 'repost' ? (
                    <RepostCard
                      repost={fi.data}
                      likeCount={engagementMap[fi.data.recipe_id]?.likeCount ?? 0}
                      commentCount={engagementMap[fi.data.recipe_id]?.commentCount ?? 0}
                      hasLiked={engagementMap[fi.data.recipe_id]?.userLiked ?? false}
                      isOwn={fi.data.user_id === user?.id}
                      onLike={() => likeMutation.mutate(fi.data.recipe_id)}
                      onCommentClick={() => setCommentSheetId(fi.data.recipe_id)}
                    />
                  ) : (
                    <InstaRecipeCard
                      recipe={itemToInstaRecipe(fi.data)}
                      author={{
                        id: fi.data.author_id,
                        display_name: fi.data.profiles?.display_name ?? 'Unknown',
                        avatar_url: fi.data.profiles?.avatar_url ?? null,
                      }}
                      likeCount={engagementMap[fi.data.id]?.likeCount ?? 0}
                      commentCount={engagementMap[fi.data.id]?.commentCount ?? 0}
                      hasLiked={engagementMap[fi.data.id]?.userLiked ?? false}
                      isFollowing={true}
                      onLike={() => likeMutation.mutate(fi.data.id)}
                      onUnlike={() => likeMutation.mutate(fi.data.id)}
                      onBookmark={() => bookmarkMutation.mutate(fi.data.id)}
                      onUnbookmark={() => bookmarkMutation.mutate(fi.data.id)}
                      onCommentClick={() => setCommentSheetId(fi.data.id)}
                      onShareClick={() =>
                        setRepostTarget({
                          id: fi.data.id,
                          name: fi.data.data.name,
                          image: fi.data.data.image,
                        })
                      }
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {isFetchingNextPage && (
          <div className="flex justify-center py-6" aria-label="Loading more">
            <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!hasNextPage && feedItems.length > 0 && (
          <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-8">
            You're all caught up
          </p>
        )}

        {commentSheetId && (
          <CommentSheet recipeId={commentSheetId} onClose={() => setCommentSheetId(null)} />
        )}

        {repostTarget && (
          <RepostComposer
            recipeId={repostTarget.id}
            recipeName={repostTarget.name}
            recipeImage={repostTarget.image}
            onClose={() => setRepostTarget(null)}
          />
        )}

        {viewerGroupIdx !== null && storyGroups.length > 0 && (
          <StoryViewer
            groups={storyGroups}
            initialGroupIndex={viewerGroupIdx}
            onClose={() => setViewerGroupIdx(null)}
            onStoryViewed={handleStoryViewed}
          />
        )}

        {showComposer && (
          <StoryComposer onClose={() => setShowComposer(false)} />
        )}
      </div>
    </PullToRefresh>
  )
}
