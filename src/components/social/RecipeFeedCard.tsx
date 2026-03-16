import { Link } from 'react-router-dom'
import { MessageCircle, Clock } from 'lucide-react'
import { Avatar } from '../ProfileCard'
import VisibilityBadge from './VisibilityBadge'
import ReactionPicker, { type ReactionSummary } from './ReactionPicker'
import type { Profile, ReactionType, RecipeVisibility } from '../../types/supabase'

export interface FeedRecipe {
  id: string
  name: string
  description?: string
  imageThumbnailUrl?: string
  /** Human-readable prep time string, e.g. "20 min". */
  prepTime?: string
  visibility: RecipeVisibility
  publishedAt: string
}

interface RecipeFeedCardProps {
  recipe: FeedRecipe
  author: Pick<Profile, 'id' | 'display_name' | 'avatar_url'>
  reactions: ReactionSummary[]
  commentCount: number
  onReact: (type: ReactionType, emojiCode?: string) => void
  onUnreact: (type: ReactionType, emojiCode?: string) => void
  onCommentClick?: () => void
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
 * Social feed card showing a recipe shared by another user.
 *
 * @example
 * <RecipeFeedCard
 *   recipe={{ id: '1', name: 'Pasta', visibility: 'public', publishedAt: new Date().toISOString() }}
 *   author={profile}
 *   reactions={[]}
 *   commentCount={0}
 *   onReact={handleReact}
 *   onUnreact={handleUnreact}
 * />
 */
export default function RecipeFeedCard({
  recipe,
  author,
  reactions,
  commentCount,
  onReact,
  onUnreact,
  onCommentClick,
}: RecipeFeedCardProps) {
  return (
    <article className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-sm transition-shadow">
      {/* Author row */}
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-2">
        <Avatar profile={author} size="sm" />
        <div className="min-w-0 flex-1">
          <Link
            to={`/users/${author.id}`}
            className="text-sm font-medium text-gray-800 hover:text-green-600 transition-colors truncate block"
          >
            {author.display_name}
          </Link>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">{relativeTime(recipe.publishedAt)}</span>
            <span aria-hidden="true" className="text-gray-200">·</span>
            <VisibilityBadge visibility={recipe.visibility} />
          </div>
        </div>
      </div>

      {/* Recipe content — tappable to open detail */}
      <Link to={`/recipes/${recipe.id}`} className="block group">
        {recipe.imageThumbnailUrl && (
          <div className="mx-4 mb-3 rounded-lg overflow-hidden aspect-video bg-gray-100">
            <img
              src={recipe.imageThumbnailUrl}
              alt={recipe.name}
              className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-200"
              loading="lazy"
            />
          </div>
        )}
        <div className="px-4 pb-1">
          <h3 className="font-semibold text-gray-800 group-hover:text-green-700 transition-colors leading-snug">
            {recipe.name}
          </h3>
          {recipe.description && (
            <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{recipe.description}</p>
          )}
          {recipe.prepTime && (
            <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-400">
              <Clock size={11} strokeWidth={1.75} aria-hidden="true" />
              <span>{recipe.prepTime}</span>
            </div>
          )}
        </div>
      </Link>

      {/* Reactions + comment count */}
      <div className="px-4 pt-3 pb-4 border-t border-gray-100 mt-3 flex items-center justify-between gap-2 flex-wrap">
        <ReactionPicker reactions={reactions} onReact={onReact} onUnreact={onUnreact} />
        <button
          onClick={onCommentClick}
          aria-label={`${commentCount} comment${commentCount !== 1 ? 's' : ''}`}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <MessageCircle size={13} strokeWidth={2} aria-hidden="true" />
          {commentCount > 0 && <span>{commentCount}</span>}
        </button>
      </div>
    </article>
  )
}
