import { ChefHat, Copy, Heart, Library, MoreHorizontal, Printer, Send, Share2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Recipe } from '../../types'

interface RecipeActionsProps {
  recipe: Recipe
  user: { id: string } | null
  cloudMeta: { visibility: string; published: boolean } | null
  duplicatePending: boolean
  onCookingMode: () => void
  onPost: () => void
  onShare: () => void
  onCollect: () => void
  onDuplicate: () => void
  onDelete: () => void
  onToggleFavorite: () => void
  onShowMore: () => void
}

export default function RecipeActions({
  recipe,
  user,
  cloudMeta,
  duplicatePending,
  onCookingMode,
  onPost,
  onShare,
  onCollect,
  onDuplicate,
  onDelete,
  onToggleFavorite,
  onShowMore,
}: RecipeActionsProps) {
  return (
    <>
      {/* Mobile: favorite + cook + "more" overflow button */}
      <div className="print:hidden flex items-center gap-2 shrink-0 md:hidden">
        <button
          onClick={onToggleFavorite}
          aria-label={recipe.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <Heart
            size={16}
            aria-hidden="true"
            className={
              recipe.isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400 dark:text-gray-500'
            }
          />
        </button>
        {recipe.recipeInstructions.length > 0 && (
          <button
            onClick={onCookingMode}
            className="min-h-[44px] flex items-center gap-1.5 text-sm font-medium bg-green-700 text-white px-3 rounded-lg hover:bg-green-800 transition-colors"
          >
            <ChefHat size={14} strokeWidth={2} aria-hidden="true" />
            Cook
          </button>
        )}
        <button
          onClick={onShowMore}
          aria-label="More options"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <MoreHorizontal
            size={16}
            aria-hidden="true"
            className="text-gray-500 dark:text-gray-400"
          />
        </button>
      </div>

      {/* Desktop: all action buttons inline */}
      <div className="print:hidden hidden md:flex items-center gap-2 shrink-0">
        <button
          onClick={onToggleFavorite}
          aria-label={recipe.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <Heart
            size={16}
            aria-hidden="true"
            className={
              recipe.isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400 dark:text-gray-500'
            }
          />
        </button>
        {recipe.recipeInstructions.length > 0 && (
          <button
            onClick={onCookingMode}
            className="flex items-center gap-1.5 text-sm font-medium bg-green-700 text-white px-3 py-1.5 rounded-lg hover:bg-green-800 transition-colors"
          >
            <ChefHat size={14} strokeWidth={2} aria-hidden="true" />
            Cook
          </button>
        )}
        {user && (
          <>
            <button
              onClick={onPost}
              aria-label="Post recipe to feed"
              className="flex items-center gap-1.5 text-sm font-medium bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Send size={14} strokeWidth={2} aria-hidden="true" />
              Post
            </button>
            <button
              onClick={onShare}
              aria-label="Share recipe"
              className="flex items-center gap-1.5 text-sm font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Share2 size={14} strokeWidth={2} aria-hidden="true" />
              {cloudMeta && cloudMeta.visibility !== 'private' ? 'Shared' : 'Share'}
            </button>
          </>
        )}
        <button
          onClick={onCollect}
          aria-label="Add to collection"
          className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <Library size={14} strokeWidth={2} aria-hidden="true" />
          Collect
        </button>
        <button
          onClick={() => window.print()}
          aria-label="Print recipe"
          className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <Printer size={14} strokeWidth={2} aria-hidden="true" />
          Print
        </button>
        <Link
          to={`/recipes/${recipe.id}/edit`}
          className="text-sm font-medium text-green-600 dark:text-green-400 border border-green-600 dark:border-green-500 px-3 py-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
        >
          Edit
        </Link>
        <button
          onClick={onDuplicate}
          disabled={duplicatePending}
          aria-label="Duplicate recipe"
          className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <Copy size={14} strokeWidth={2} aria-hidden="true" />
          {duplicatePending ? 'Copying…' : 'Duplicate'}
        </button>
        <button
          onClick={onDelete}
          className="text-sm font-medium text-red-500 dark:text-red-400 border border-red-300 dark:border-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          Delete
        </button>
      </div>
    </>
  )
}
