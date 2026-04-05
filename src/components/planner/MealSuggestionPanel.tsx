import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Sparkles, X, Plus, BookOpen } from 'lucide-react'
import type { MealType, PantryItem } from '../../types'
import type { ScoredRecipe } from '../../lib/suggestionService'

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

interface MealSuggestionPanelProps {
  suggestions: ScoredRecipe[]
  suggestMealType: MealType | undefined
  pantryItems: PantryItem[]
  hasRecipes: boolean
  weekDays: { date: string }[]
  onClose: () => void
  onMealTypeChange: (mt: MealType | undefined) => void
  onRefresh: () => void
  onAddToToday: (date: string, meal: MealType, recipeId: string) => void
}

export default function MealSuggestionPanel({
  suggestions,
  suggestMealType,
  pantryItems,
  hasRecipes,
  weekDays,
  onClose,
  onMealTypeChange,
  onRefresh,
  onAddToToday,
}: MealSuggestionPanelProps) {
  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[80vh] animate-slide-up sm:animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-purple-500" aria-hidden="true" />
              <h3 className="font-bold text-gray-800 dark:text-gray-100">What should I cook?</h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Close"
            >
              <X size={20} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {([undefined, ...MEAL_TYPES] as (MealType | undefined)[]).map((mt) => (
              <button
                key={mt ?? 'any'}
                onClick={() => onMealTypeChange(mt)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  suggestMealType === mt
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {mt ? MEAL_LABELS[mt] : 'Any meal'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {!hasRecipes ? (
            <div className="flex flex-col items-center text-center py-10 px-4">
              <BookOpen size={32} strokeWidth={1.5} className="text-gray-300 dark:text-gray-600 mb-3" aria-hidden="true" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">No recipes yet</p>
              <Link
                to="/recipes/new"
                onClick={onClose}
                className="mt-3 bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-800 transition-colors"
              >
                Add your first recipe
              </Link>
            </div>
          ) : (
            suggestions.map(({ recipe, reason, pantryMatches }) => (
              <div
                key={recipe.id}
                className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0 flex items-start gap-3"
              >
                <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  {recipe.imageThumbnailUrl ? (
                    <img src={recipe.imageThumbnailUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <span className="text-sm font-bold text-gray-400 dark:text-gray-500">
                      {recipe.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{recipe.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{recipe.description}</p>
                  {reason === 'pantry' && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                      {pantryMatches} ingredient{pantryMatches !== 1 ? 's' : ''} in pantry
                    </p>
                  )}
                  {reason === 'favorite' && (
                    <p className="text-xs text-amber-500 dark:text-amber-400 mt-0.5">Favourite</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    const todayStr = new Date().toISOString().slice(0, 10)
                    const targetDate = weekDays.find((d) => d.date === todayStr)?.date ?? weekDays[0].date
                    const targetMeal = suggestMealType ?? 'dinner'
                    onAddToToday(targetDate, targetMeal, recipe.id)
                  }}
                  className="shrink-0 flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 border border-green-600 dark:border-green-500 px-2.5 py-1 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                >
                  <Plus size={12} strokeWidth={2.5} aria-hidden="true" />
                  Add
                </button>
              </div>
            ))
          )}
        </div>

        {hasRecipes && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-2">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {pantryItems.length > 0
                ? 'Ranked by pantry overlap, favourites, and variety'
                : 'Ranked by favourites and variety'}
            </p>
            <button
              onClick={onRefresh}
              className="text-xs text-purple-600 dark:text-purple-400 hover:underline shrink-0"
            >
              Refresh
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
