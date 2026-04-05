import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { X, BookOpen } from 'lucide-react'
import type { MealType, Recipe } from '../../types'

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

function QuickPickCard({ recipe, onClick }: { recipe: Recipe; onClick: () => void }) {
  const initials = recipe.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return (
    <button
      onClick={onClick}
      className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 flex flex-col items-end justify-end hover:ring-2 hover:ring-green-500 active:scale-95 transition-transform"
      aria-label={`Quick-add ${recipe.name}`}
    >
      {recipe.imageThumbnailUrl ? (
        <img src={recipe.imageThumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-gray-400 dark:text-gray-500">{initials}</span>
        </div>
      )}
      <div className="relative w-full px-1.5 py-1 bg-black/50 backdrop-blur-sm">
        <p className="text-xs font-medium text-white line-clamp-1">{recipe.name}</p>
      </div>
    </button>
  )
}

interface RecipePickerModalProps {
  pickerTarget: { date: string; meal: MealType }
  search: string
  recipes: Recipe[]
  favoriteRecipes: Recipe[]
  recentRecipes: Recipe[]
  filteredRecipes: Recipe[]
  onSearchChange: (v: string) => void
  onClose: () => void
  onAddRecipe: (date: string, meal: MealType, recipeId: string) => void
}

export default function RecipePickerModal({
  pickerTarget,
  search,
  recipes,
  favoriteRecipes,
  recentRecipes,
  filteredRecipes,
  onSearchChange,
  onClose,
  onAddRecipe,
}: RecipePickerModalProps) {
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
            <h3 className="font-bold text-gray-800 dark:text-gray-100">{MEAL_LABELS[pickerTarget.meal]}</h3>
            <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" aria-label="Close">
              <X size={20} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
          <input
            type="search"
            placeholder="Search recipes…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
            autoFocus
          />
        </div>
        <div className="overflow-y-auto flex-1">
          {!search && (favoriteRecipes.length > 0 || recentRecipes.length > 0) && (
            <div className="px-4 pt-3 pb-2 border-b border-gray-100 dark:border-gray-700">
              {favoriteRecipes.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">Favorites</p>
                  <div className="grid grid-cols-3 gap-2">
                    {favoriteRecipes.slice(0, 6).map((recipe) => (
                      <QuickPickCard key={recipe.id} recipe={recipe} onClick={() => onAddRecipe(pickerTarget.date, pickerTarget.meal, recipe.id)} />
                    ))}
                  </div>
                </div>
              )}
              {recentRecipes.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">Recent</p>
                  <div className="grid grid-cols-3 gap-2">
                    {recentRecipes.slice(0, 6).map((recipe) => (
                      <QuickPickCard key={recipe.id} recipe={recipe} onClick={() => onAddRecipe(pickerTarget.date, pickerTarget.meal, recipe.id)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {filteredRecipes.length === 0 ? (
            <div className="flex flex-col items-center text-center py-10 px-4">
              <BookOpen size={32} strokeWidth={1.5} className="text-gray-300 dark:text-gray-600 mb-3" aria-hidden="true" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{recipes.length === 0 ? 'No recipes yet' : 'No recipes found'}</p>
              {recipes.length === 0 ? (
                <Link to="/recipes/new" className="mt-3 bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-800 transition-colors">Add your first recipe</Link>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Try a different search term.</p>
              )}
            </div>
          ) : (
            filteredRecipes.map((recipe) => (
              <button
                key={recipe.id}
                onClick={() => onAddRecipe(pickerTarget.date, pickerTarget.meal, recipe.id)}
                className="w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-green-50 dark:hover:bg-green-900/20 active:bg-green-100 dark:active:bg-green-900/30"
              >
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{recipe.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{recipe.description}</p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
