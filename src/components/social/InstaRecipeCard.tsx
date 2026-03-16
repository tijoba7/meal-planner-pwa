import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from 'lucide-react'
import { Avatar } from '../ProfileCard'
import type { Profile } from '../../types/supabase'

export interface InstaRecipe {
  id: string
  name: string
  description?: string
  imageUrl?: string
  imageThumbnailUrl?: string
  publishedAt: string
}

interface InstaRecipeCardProps {
  recipe: InstaRecipe
  author: Pick<Profile, 'id' | 'display_name' | 'avatar_url'>
  likeCount: number
  commentCount: number
  hasLiked?: boolean
  hasBookmarked?: boolean
  /** True if current user follows this author. Controls follow button visibility. */
  isFollowing?: boolean
  onLike?: () => void
  onUnlike?: () => void
  onBookmark?: () => void
  onUnbookmark?: () => void
  onCommentClick?: () => void
  onShareClick?: () => void
  onFollowClick?: () => void
  onMoreClick?: () => void
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * Instagram-style recipe feed card. Full-width hero image, action bar with
 * like/comment/share/bookmark, and caption below. Designed to go edge-to-edge
 * on mobile inside a feed container.
 *
 * Unlike RecipeFeedCard (which uses ReactionPicker), this component uses a
 * simplified like/comment/share/bookmark interaction row matching the
 * Instagram UX pattern.
 *
 * @example
 * <InstaRecipeCard
 *   recipe={recipe}
 *   author={profile}
 *   likeCount={42}
 *   commentCount={7}
 *   hasLiked={false}
 *   onLike={() => like(recipe.id)}
 *   onCommentClick={() => openComments(recipe.id)}
 * />
 */
export default function InstaRecipeCard({
  recipe,
  author,
  likeCount,
  commentCount,
  hasLiked = false,
  hasBookmarked = false,
  isFollowing = true,
  onLike,
  onUnlike,
  onBookmark,
  onUnbookmark,
  onCommentClick,
  onShareClick,
  onFollowClick,
  onMoreClick,
}: InstaRecipeCardProps) {
  const [localLiked, setLocalLiked] = useState(hasLiked)
  const [localLikeCount, setLocalLikeCount] = useState(likeCount)
  const [localBookmarked, setLocalBookmarked] = useState(hasBookmarked)

  function toggleLike() {
    if (localLiked) {
      setLocalLiked(false)
      setLocalLikeCount((c) => c - 1)
      onUnlike?.()
    } else {
      setLocalLiked(true)
      setLocalLikeCount((c) => c + 1)
      onLike?.()
    }
  }

  function toggleBookmark() {
    if (localBookmarked) {
      setLocalBookmarked(false)
      onUnbookmark?.()
    } else {
      setLocalBookmarked(true)
      onBookmark?.()
    }
  }

  return (
    <article className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
      {/* ── Author row ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Link to={`/users/${author.id}`} aria-label={`View ${author.display_name}'s profile`}>
          <Avatar profile={author} size="sm" />
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            to={`/users/${author.id}`}
            className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:text-green-700 dark:hover:text-green-400 transition-colors truncate block"
          >
            {author.display_name}
          </Link>
        </div>

        {/* Follow button — shown when not following (not for self) */}
        {!isFollowing && (
          <button
            onClick={onFollowClick}
            className="text-xs font-semibold text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors"
          >
            Follow
          </button>
        )}

        <button
          onClick={onMoreClick}
          aria-label="More options"
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors ml-1"
        >
          <MoreHorizontal size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      {/* ── Hero image ──────────────────────────────────────────────────── */}
      <Link to={`/shared/${recipe.id}`} className="block">
        {recipe.imageUrl || recipe.imageThumbnailUrl ? (
          <div className="aspect-square w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
            <img
              src={recipe.imageThumbnailUrl ?? recipe.imageUrl}
              alt={recipe.name}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
        ) : (
          /* Placeholder when no image */
          <div className="aspect-square w-full bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 flex items-center justify-center">
            <span
              className="text-5xl select-none"
              role="img"
              aria-label="Recipe placeholder"
            >
              🍽️
            </span>
          </div>
        )}
      </Link>

      {/* ── Action row ──────────────────────────────────────────────────── */}
      <div className="flex items-center px-3 py-2">
        {/* Left actions: like, comment, share */}
        <div className="flex items-center gap-0.5 flex-1">
          {/* Like */}
          <button
            onClick={toggleLike}
            aria-pressed={localLiked}
            aria-label={localLiked ? 'Unlike recipe' : 'Like recipe'}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Heart
              size={22}
              strokeWidth={localLiked ? 0 : 1.75}
              fill={localLiked ? '#ef4444' : 'none'}
              className={localLiked ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}
              aria-hidden="true"
            />
          </button>

          {/* Comment */}
          <button
            onClick={onCommentClick}
            aria-label={`${commentCount} comment${commentCount !== 1 ? 's' : ''}`}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <MessageCircle
              size={22}
              strokeWidth={1.75}
              className="text-gray-700 dark:text-gray-300"
              aria-hidden="true"
            />
          </button>

          {/* Share */}
          <button
            onClick={onShareClick}
            aria-label="Share recipe"
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Send
              size={20}
              strokeWidth={1.75}
              className="text-gray-700 dark:text-gray-300"
              aria-hidden="true"
            />
          </button>
        </div>

        {/* Right action: bookmark */}
        <button
          onClick={toggleBookmark}
          aria-pressed={localBookmarked}
          aria-label={localBookmarked ? 'Remove bookmark' : 'Bookmark recipe'}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <Bookmark
            size={22}
            strokeWidth={localBookmarked ? 0 : 1.75}
            fill={localBookmarked ? 'currentColor' : 'none'}
            className={
              localBookmarked
                ? 'text-gray-900 dark:text-gray-100'
                : 'text-gray-700 dark:text-gray-300'
            }
            aria-hidden="true"
          />
        </button>
      </div>

      {/* ── Like count ──────────────────────────────────────────────────── */}
      {localLikeCount > 0 && (
        <p className="px-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
          {localLikeCount.toLocaleString()} {localLikeCount === 1 ? 'like' : 'likes'}
        </p>
      )}

      {/* ── Caption ─────────────────────────────────────────────────────── */}
      <div className="px-4 pt-1 pb-2">
        <p className="text-sm text-gray-900 dark:text-gray-100">
          <Link
            to={`/users/${author.id}`}
            className="font-semibold hover:text-green-700 dark:hover:text-green-400 transition-colors"
          >
            {author.display_name}
          </Link>{' '}
          <Link
            to={`/shared/${recipe.id}`}
            className="hover:text-green-700 dark:hover:text-green-400 transition-colors"
          >
            {recipe.name}
            {recipe.description && (
              <span className="text-gray-600 dark:text-gray-400 font-normal">
                {' '}
                — {recipe.description}
              </span>
            )}
          </Link>
        </p>

        {/* View all comments */}
        {commentCount > 0 && (
          <button
            onClick={onCommentClick}
            className="mt-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            View all {commentCount} comment{commentCount !== 1 ? 's' : ''}
          </button>
        )}

        {/* Timestamp */}
        <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">
          {relativeTime(recipe.publishedAt)}
        </p>
      </div>
    </article>
  )
}
