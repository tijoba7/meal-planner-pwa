import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { durationToMinutes } from '../lib/db'
import RecipeImage from './RecipeImage'
import type { PantryMatchResult } from '../lib/pantryMatchService'

interface PantryMatchCardProps {
  match: PantryMatchResult
}

export default function PantryMatchCard({ match }: PantryMatchCardProps) {
  const { recipe, matchCount, totalIngredients, matchPercent, expiringMatchedIngredients } = match
  const prepMins = durationToMinutes(recipe.prepTime)
  const cookMins = durationToMinutes(recipe.cookTime)
  const hasExpiring = expiringMatchedIngredients.length > 0

  const badgeClasses =
    matchPercent >= 75
      ? 'bg-green-700 text-white'
      : matchPercent >= 40
        ? 'bg-amber-500 text-white'
        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'

  return (
    <li>
      <Link
        to={`/recipes/${recipe.id}`}
        className="flex gap-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-sm transition-shadow"
      >
        <RecipeImage
          src={recipe.imageThumbnailUrl ?? recipe.image}
          alt={recipe.name}
          className="w-16 h-16 shrink-0 rounded-lg"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 leading-tight">
              {recipe.name}
            </h3>
            <span
              className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${badgeClasses}`}
              title={`${matchCount} of ${totalIngredients} ingredients in your pantry`}
            >
              {matchCount}/{totalIngredients}
            </span>
          </div>

          {hasExpiring && (
            <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
              <AlertTriangle size={11} aria-hidden="true" className="shrink-0" />
              Uses your {expiringMatchedIngredients.slice(0, 2).join(', ')}
              {expiringMatchedIngredients.length > 2
                ? ` + ${expiringMatchedIngredients.length - 2} more`
                : ''}{' '}
              — expiring soon
            </p>
          )}

          {recipe.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
              {recipe.description}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 dark:text-gray-500">
            <span>{prepMins + cookMins} min</span>
            <span>·</span>
            <span>{matchPercent}% match</span>
          </div>
        </div>
      </Link>
    </li>
  )
}
