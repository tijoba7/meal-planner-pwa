import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { getRecipes, toggleFavorite, durationToMinutes } from '../lib/db'
import type { Recipe } from '../types'
import EmptyState from '../components/EmptyState'
import {
  RecipeBookIllustration,
  SearchNoResultsIllustration,
  HeartIllustration,
} from '../components/EmptyStateIllustrations'
import RecipeImage from '../components/RecipeImage'
import Skeleton from '../components/Skeleton'

type SortKey = 'newest' | 'oldest' | 'alpha-asc' | 'alpha-desc' | 'cook-asc' | 'prep-asc'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'alpha-asc', label: 'A–Z' },
  { value: 'alpha-desc', label: 'Z–A' },
  { value: 'cook-asc', label: 'Shortest cook time' },
  { value: 'prep-asc', label: 'Shortest prep time' },
]

const SORT_STORAGE_KEY = 'mise-recipe-sort'

function getSavedSort(): SortKey {
  try {
    const saved = localStorage.getItem(SORT_STORAGE_KEY)
    if (saved && SORT_OPTIONS.some((o) => o.value === saved)) return saved as SortKey
  } catch {
    // ignore
  }
  return 'newest'
}

function sortRecipes(recipes: Recipe[], sort: SortKey): Recipe[] {
  const sorted = [...recipes]
  switch (sort) {
    case 'alpha-asc':
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
    case 'alpha-desc':
      return sorted.sort((a, b) => b.name.localeCompare(a.name))
    case 'oldest':
      return sorted.sort((a, b) => a.dateCreated.localeCompare(b.dateCreated))
    case 'cook-asc':
      return sorted.sort((a, b) => durationToMinutes(a.cookTime) - durationToMinutes(b.cookTime))
    case 'prep-asc':
      return sorted.sort((a, b) => durationToMinutes(a.prepTime) - durationToMinutes(b.prepTime))
    case 'newest':
    default:
      return sorted.sort((a, b) => b.dateCreated.localeCompare(a.dateCreated))
  }
}

function RecipeCardSkeleton() {
  return (
    <li className="flex gap-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <Skeleton className="w-16 h-16 shrink-0 rounded-lg" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-12 shrink-0" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <div className="flex gap-3 pt-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </li>
  )
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [query, setQuery] = useState('')
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [sort, setSort] = useState<SortKey>(getSavedSort)
  const [loading, setLoading] = useState(true)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([])
  const searchRef = useRef<HTMLInputElement>(null)

  useKeyboardShortcuts({
    '/': () => { searchRef.current?.focus(); searchRef.current?.select() },
  })

  const allCategories = useMemo(() => {
    const set = new Set<string>()
    for (const r of recipes) {
      if (r.recipeCategory?.trim()) set.add(r.recipeCategory.trim())
    }
    return [...set].sort()
  }, [recipes])

  const allCuisines = useMemo(() => {
    const set = new Set<string>()
    for (const r of recipes) {
      if (r.recipeCuisine?.trim()) set.add(r.recipeCuisine.trim())
    }
    return [...set].sort()
  }, [recipes])

  useEffect(() => {
    getRecipes().then((r) => {
      setRecipes(r)
      setLoading(false)
    })
  }, [])

  function handleSortChange(newSort: SortKey) {
    setSort(newSort)
    try {
      localStorage.setItem(SORT_STORAGE_KEY, newSort)
    } catch {
      // ignore
    }
  }

  async function handleToggleFavorite(e: React.MouseEvent, recipeId: string) {
    e.preventDefault()
    e.stopPropagation()
    await toggleFavorite(recipeId)
    setRecipes((prev) =>
      prev.map((r) => (r.id === recipeId ? { ...r, isFavorite: !r.isFavorite } : r))
    )
  }

  const filtered = sortRecipes(
    recipes.filter((r) => {
      if (showFavoritesOnly && !r.isFavorite) return false
      if (selectedCategories.length > 0 && !selectedCategories.includes(r.recipeCategory?.trim() ?? '')) return false
      if (selectedCuisines.length > 0 && !selectedCuisines.includes(r.recipeCuisine?.trim() ?? '')) return false
      if (!query.trim()) return true
      const q = query.toLowerCase()
      return (
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.keywords.some((t) => t.toLowerCase().includes(q))
      )
    }),
    sort,
  )

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Recipes</h2>
        <div className="flex gap-2">
          <Link
            to="/recipes/import"
            className="border border-green-600 dark:border-green-500 text-green-600 dark:text-green-400 text-sm font-medium px-3 py-2 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
          >
            Import URL
          </Link>
          <Link
            to="/recipes/new"
            className="bg-green-600 text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            + Add Recipe
          </Link>
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <input
            ref={searchRef}
            type="search"
            placeholder="Search recipes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-3 py-2 pr-10 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-mono bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-gray-400 dark:text-gray-500 pointer-events-none">
            /
          </kbd>
        </div>
        <button
          onClick={() => setShowFavoritesOnly((v) => !v)}
          aria-pressed={showFavoritesOnly}
          aria-label={showFavoritesOnly ? 'Show all recipes' : 'Show favorites only'}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
            showFavoritesOnly
              ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400'
              : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <Heart
            size={14}
            aria-hidden="true"
            className={showFavoritesOnly ? 'fill-current' : ''}
          />
          Favorites
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <label htmlFor="recipe-sort" className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
          Sort by
        </label>
        <select
          id="recipe-sort"
          value={sort}
          onChange={(e) => handleSortChange(e.target.value as SortKey)}
          className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Category filter chips */}
      {allCategories.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-2 scrollbar-hide">
          <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500 font-medium">Category</span>
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategories((prev) =>
                prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
              )}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedCategories.includes(cat)
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Cuisine filter chips */}
      {allCuisines.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide">
          <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500 font-medium">Cuisine</span>
          {allCuisines.map((cui) => (
            <button
              key={cui}
              onClick={() => setSelectedCuisines((prev) =>
                prev.includes(cui) ? prev.filter((c) => c !== cui) : [...prev, cui]
              )}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedCuisines.includes(cui)
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {cui}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <ul className="space-y-3" aria-busy="true" aria-label="Loading recipes">
          {Array.from({ length: 4 }).map((_, i) => (
            <RecipeCardSkeleton key={i} />
          ))}
        </ul>
      ) : filtered.length === 0 ? (
        showFavoritesOnly ? (
          <EmptyState
            illustration={<HeartIllustration />}
            title="No favorites yet"
            description="Tap the heart on any recipe to save it here."
            action={{ label: 'Browse all recipes', onClick: () => setShowFavoritesOnly(false) }}
          />
        ) : selectedCategories.length > 0 || selectedCuisines.length > 0 ? (
          <EmptyState
            illustration={<SearchNoResultsIllustration />}
            title="No recipes found"
            description="No recipes match the selected category or cuisine."
            action={{ label: 'Clear filters', onClick: () => { setSelectedCategories([]); setSelectedCuisines([]) } }}
          />
        ) : query ? (
          <EmptyState
            illustration={<SearchNoResultsIllustration />}
            title="No recipes found"
            description={`No recipes match "${query}". Try a different search term.`}
            action={{ label: 'Clear search', onClick: () => setQuery('') }}
          />
        ) : (
          <EmptyState
            illustration={<RecipeBookIllustration />}
            title="No recipes yet"
            description="Add your first recipe to get started planning meals."
            action={{ label: 'Add your first recipe', href: '/recipes/new' }}
          />
        )
      ) : (
        <ul className="space-y-3" aria-live="polite">
          {filtered.map((recipe) => {
            const prepMins = durationToMinutes(recipe.prepTime)
            const cookMins = durationToMinutes(recipe.cookTime)
            return (
              <li key={recipe.id} className="relative">
                <Link
                  to={`/recipes/${recipe.id}`}
                  className="flex gap-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-sm transition-shadow"
                >
                  {/* Thumbnail */}
                  {(recipe.imageThumbnailUrl || recipe.image) && (
                    <RecipeImage
                      src={recipe.imageThumbnailUrl ?? recipe.image}
                      alt={recipe.name}
                      className="w-16 h-16 shrink-0 rounded-lg"
                    />
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0 pr-8">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-800 dark:text-gray-100">{recipe.name}</h3>
                      <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                        {prepMins + cookMins} min
                      </span>
                    </div>
                    {recipe.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{recipe.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 dark:text-gray-500">
                      <span>{recipe.recipeYield} servings</span>
                      <span>·</span>
                      <span>prep {prepMins}m</span>
                      <span>·</span>
                      <span>cook {cookMins}m</span>
                    </div>
                    {recipe.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {recipe.keywords.map((tag) => (
                          <span
                            key={tag}
                            className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs px-2 py-0.5 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
                {/* Favorite button — outside the Link to avoid nested interactivity */}
                <button
                  onClick={(e) => handleToggleFavorite(e, recipe.id)}
                  aria-label={recipe.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Heart
                    size={16}
                    aria-hidden="true"
                    className={recipe.isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-300 dark:text-gray-600'}
                  />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
