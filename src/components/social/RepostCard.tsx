import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Repeat2, Heart, MessageCircle, Trash2 } from 'lucide-react'
import { Avatar } from '../ProfileCard'
import type { RepostWithAuthor } from '../../lib/repostService'
import type { Recipe } from '../../types'

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

interface RepostCardProps {
  repost: RepostWithAuthor
  likeCount?: number
  commentCount?: number
  hasLiked?: boolean
  isOwn?: boolean
  onLike?: () => void
  onCommentClick?: () => void
  onDelete?: () => void
}

/**
 * Feed card for a repost. Shows "UserName reposted" header, the original recipe
 * as a compact embedded card, optional user photo and caption.
 */
export default function RepostCard({
  repost,
  likeCount = 0,
  commentCount = 0,
  hasLiked = false,
  isOwn = false,
  onLike,
  onCommentClick,
  onDelete,
}: RepostCardProps) {
  const [localLiked, setLocalLiked] = useState(hasLiked)
  const [localLikeCount, setLocalLikeCount] = useState(likeCount)

  function handleLike() {
    if (localLiked) {
      setLocalLiked(false)
      setLocalLikeCount((c) => c - 1)
    } else {
      setLocalLiked(true)
      setLocalLikeCount((c) => c + 1)
    }
    onLike?.()
  }

  const reposter = repost.profiles ?? { display_name: 'Someone', avatar_url: null }
  const originalRecipe = repost.recipes_cloud
  const recipeData = originalRecipe?.data as Recipe | undefined
  const originalAuthor = originalRecipe?.profiles

  return (
    <article className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
      {/* ── Repost header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-1 text-xs text-gray-500 dark:text-gray-400">
        <Repeat2 size={14} strokeWidth={2} aria-hidden="true" className="text-green-600 dark:text-green-400" />
        <Link
          to={`/users/${repost.user_id}`}
          className="font-semibold hover:text-green-700 dark:hover:text-green-400 transition-colors"
        >
          {reposter.display_name}
        </Link>
        <span>reposted</span>
        {isOwn && onDelete && (
          <button
            onClick={onDelete}
            aria-label="Delete repost"
            className="ml-auto min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* ── User's photo (optional) ───────────────────────────────────── */}
      {repost.image_url && (
        <div className="px-4 pt-2">
          <div className="rounded-lg overflow-hidden aspect-[4/3] bg-gray-100 dark:bg-gray-800">
            <img
              src={repost.image_url}
              alt={repost.caption ?? 'Repost photo'}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      )}

      {/* ── User's caption (optional) ─────────────────────────────────── */}
      {repost.caption && (
        <div className="px-4 pt-2">
          <p className="text-sm text-gray-900 dark:text-gray-100">
            <Link
              to={`/users/${repost.user_id}`}
              className="font-semibold hover:text-green-700 dark:hover:text-green-400 transition-colors"
            >
              {reposter.display_name}
            </Link>{' '}
            {repost.caption}
          </p>
        </div>
      )}

      {/* ── Embedded original recipe ──────────────────────────────────── */}
      {originalRecipe && recipeData && (
        <div className="mx-4 mt-2 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <Link to={`/shared/${originalRecipe.id}`} className="block">
            {/* Recipe image */}
            {recipeData.image ? (
              <div className="aspect-video w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                <img
                  src={recipeData.image}
                  alt={recipeData.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            ) : (
              <div className="aspect-video w-full bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 flex items-center justify-center">
                <span className="text-3xl select-none" role="img" aria-label="Recipe">🍽️</span>
              </div>
            )}

            {/* Recipe info */}
            <div className="p-3">
              <div className="flex items-center gap-2 mb-1">
                {originalAuthor && (
                  <Avatar
                    profile={{
                      display_name: originalAuthor.display_name,
                      avatar_url: originalAuthor.avatar_url,
                    }}
                    size="xs"
                  />
                )}
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {originalAuthor?.display_name ?? 'Unknown'}
                </span>
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">
                {recipeData.name}
              </p>
              {recipeData.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                  {recipeData.description}
                </p>
              )}
            </div>
          </Link>
        </div>
      )}

      {/* ── Action row ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0 px-2 py-1">
        <button
          onClick={handleLike}
          aria-pressed={localLiked}
          aria-label={localLiked ? 'Unlike' : 'Like'}
          className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <Heart
            size={20}
            strokeWidth={localLiked ? 0 : 1.75}
            fill={localLiked ? 'currentColor' : 'none'}
            className={localLiked ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}
            aria-hidden="true"
          />
        </button>
        <button
          onClick={onCommentClick}
          aria-label={`${commentCount} comment${commentCount !== 1 ? 's' : ''}`}
          className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <MessageCircle
            size={20}
            strokeWidth={1.75}
            className="text-gray-700 dark:text-gray-300"
            aria-hidden="true"
          />
        </button>
      </div>

      {/* ── Counts + timestamp ────────────────────────────────────────── */}
      <div className="px-4 pb-3">
        {localLikeCount > 0 && (
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5">
            {localLikeCount.toLocaleString()} {localLikeCount === 1 ? 'like' : 'likes'}
          </p>
        )}
        <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">
          {relativeTime(repost.created_at)}
        </p>
      </div>
    </article>
  )
}
