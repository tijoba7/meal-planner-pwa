import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Heart, Refrigerator, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useRecipes, useToggleFavorite } from '../hooks/useRecipes'
import { usePantryItems } from '../hooks/usePantryItems'
import { durationToMinutes } from '../lib/db'
import {
  matchRecipesToPantry,
  getExpiringPantryItems,
  getAiPantrySuggestions,
  formatExpiryDate,
  type AiRecipeSuggestion,
} from '../lib/pantryMatchService'
import { useToast } from '../contexts/ToastContext'
import type { Recipe, PantryItem } from '../types'
import type { PantryMatchResult } from '../lib/pantryMatchService'
import { DIETARY_PREFERENCES, getDietaryPrefs } from '../lib/dietary'
import EmptyState from '../components/EmptyState'
import {
  RecipeBookIllustration,
  SearchNoResultsIllustration,
  HeartIllustration,
} from '../components/EmptyStateIllustrations'
import PantryMatchCard from '../components/PantryMatchCard'
import PullToRefresh from '../components/PullToRefresh'
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

const SORT_STORAGE_KEY = 'braisely-recipe-sort'
const MAX_COOK_TIME = 180 // slider max in minutes; at this value = no limit
const PAGE_SIZE = 24

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

interface PantryTabProps {
  pantryItems: PantryItem[]
  pantryMatches: PantryMatchResult[]
  expiringItems: PantryItem[]
  aiState: { loading: boolean; suggestions: AiRecipeSuggestion[]; error: string | null }
  onAiSuggest: () => void
}

function PantryTab({
  pantryItems,
  pantryMatches,
  expiringItems,
  aiState,
  onAiSuggest,
}: PantryTabProps) {
  if (pantryItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Refrigerator
          size={48}
          strokeWidth={1}
          className="text-gray-300 dark:text-gray-600 mb-4"
          aria-hidden="true"
        />
        <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">
          Your pantry is empty
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
          Add items to your pantry first to see which recipes you can make.
        </p>
        <Link
          to="/pantry"
          className="mt-4 bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-800 transition-colors"
        >
          Go to Pantry
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Expiring items banner */}
      {expiringItems.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle
              size={15}
              className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-0.5">
                Use these before they expire
              </p>
              <ul className="flex flex-wrap gap-x-3 gap-y-0.5">
                {expiringItems.map((item) => (
                  <li key={item.id} className="text-xs text-amber-700 dark:text-amber-400">
                    <span className="font-medium">{item.name}</span> — by{' '}
                    {formatExpiryDate(item.expiryDate!)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* AI suggestions section */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div className="flex items-center justify-between gap-3 mb-1">
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              Get AI recipe ideas
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              New recipes you could make with what you have
            </p>
          </div>
          <button
            onClick={onAiSuggest}
            disabled={aiState.loading}
            className="flex items-center gap-1.5 shrink-0 bg-green-700 text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            <Sparkles size={14} aria-hidden="true" />
            {aiState.loading ? 'Thinking…' : 'Suggest'}
          </button>
        </div>

        {aiState.error && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">{aiState.error}</p>
        )}

        {aiState.suggestions.length > 0 && (
          <ul className="mt-3 space-y-2">
            {aiState.suggestions.map((s) => (
              <li
                key={s.name}
                className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2.5"
              >
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{s.name}</p>
                {s.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {s.description}
                  </p>
                )}
                {s.keyIngredients?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {s.keyIngredients.map((ing) => (
                      <span
                        key={ing}
                        className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs px-2 py-0.5 rounded-full"
                      >
                        {ing}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Matched saved recipes */}
      {pantryMatches.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            None of your saved recipes match your current pantry.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Try the AI suggestions above, or add more recipes.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Your saved recipes you can make ({pantryMatches.length})
            </p>
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {pantryMatches.map((match) => (
              <PantryMatchCard key={match.recipe.id} match={match} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export default function RecipesPage() {
  const { data: recipes = [], isLoading: loading, refetch } = useRecipes()
  const { data: pantryItems = [] } = usePantryItems()
  const toggleFavoriteMutation = useToggleFavorite()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<'all' | 'pantry'>('all')
  const [aiState, setAiState] = useState<{
    loading: boolean
    suggestions: AiRecipeSuggestion[]
    error: string | null
  }>({ loading: false, suggestions: [], error: null })
  const [query, setQuery] = useState('')
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [sort, setSort] = useState<SortKey>(getSavedSort)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedDiets, setSelectedDiets] = useState<string[]>(() => getDietaryPrefs())
  const [showFilters, setShowFilters] = useState(false)
  const [ingredientQuery, setIngredientQuery] = useState('')
  const [maxCookTime, setMaxCookTime] = useState(MAX_COOK_TIME)
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE)
  const searchRef = useRef<HTMLInputElement>(null)
  const ingredientRef = useRef<HTMLInputElement>(null)

  useKeyboardShortcuts({
    '/': () => {
      searchRef.current?.focus()
      searchRef.current?.select()
    },
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

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const r of recipes) {
      for (const kw of r.keywords) if (kw.trim()) set.add(kw.trim().toLowerCase())
    }
    return [...set].sort()
  }, [recipes])

  const pantryMatches = useMemo(
    () => matchRecipesToPantry(recipes, pantryItems),
    [recipes, pantryItems]
  )

  const expiringItems = useMemo(
    () => getExpiringPantryItems(pantryItems),
    [pantryItems]
  )

  async function handleAiSuggestions() {
    setAiState({ loading: true, suggestions: [], error: null })
    const result = await getAiPantrySuggestions(
      pantryItems,
      recipes.map((r) => r.name)
    )
    if (result.ok) {
      setAiState({ loading: false, suggestions: result.suggestions, error: null })
    } else {
      setAiState({ loading: false, suggestions: [], error: result.error })
    }
  }

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
    try {
      await toggleFavoriteMutation.mutateAsync(recipeId)
    } catch {
      toast.error('Failed to update favorite. Please try again.')
    }
  }

  function clearAdvancedFilters() {
    setSelectedCategories([])
    setSelectedCuisines([])
    setSelectedTags([])
    setSelectedDiets([])
    setIngredientQuery('')
    setMaxCookTime(MAX_COOK_TIME)
  }

  function clearAllFilters() {
    clearAdvancedFilters()
    setQuery('')
    setShowFavoritesOnly(false)
  }

  const activeFilterCount =
    selectedCategories.length +
    selectedCuisines.length +
    selectedTags.length +
    selectedDiets.length +
    (ingredientQuery.trim() ? 1 : 0) +
    (maxCookTime < MAX_COOK_TIME ? 1 : 0)

  const hasAnyFilter = activeFilterCount > 0 || showFavoritesOnly || !!query.trim()

  // Reset to first page whenever any filter or sort changes
  const filterKey = `${query}|${showFavoritesOnly}|${sort}|${selectedCategories.join(',')}|${selectedCuisines.join(',')}|${selectedTags.join(',')}|${selectedDiets.join(',')}|${ingredientQuery}|${maxCookTime}`
  useEffect(() => {
    setDisplayCount(PAGE_SIZE)
  }, [filterKey])

  const filtered = sortRecipes(
    recipes.filter((r) => {
      if (showFavoritesOnly && !r.isFavorite) return false
      if (
        selectedCategories.length > 0 &&
        !selectedCategories.includes(r.recipeCategory?.trim() ?? '')
      )
        return false
      if (selectedCuisines.length > 0 && !selectedCuisines.includes(r.recipeCuisine?.trim() ?? ''))
        return false
      if (selectedTags.length > 0) {
        const recipeTags = r.keywords.map((k) => k.toLowerCase())
        if (!selectedTags.every((tag) => recipeTags.includes(tag))) return false
      }
      if (selectedDiets.length > 0) {
        const recipeDiets = r.suitableForDiet ?? []
        if (!selectedDiets.every((diet) => recipeDiets.includes(diet))) return false
      }
      if (maxCookTime < MAX_COOK_TIME && durationToMinutes(r.cookTime) > maxCookTime) return false
      if (ingredientQuery.trim()) {
        const iq = ingredientQuery.toLowerCase()
        if (!r.recipeIngredient.some((ing) => ing.name.toLowerCase().includes(iq))) return false
      }
      if (!query.trim()) return true
      const q = query.toLowerCase()
      return (
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.keywords.some((t) => t.toLowerCase().includes(q))
      )
    }),
    sort
  )

  const displayed = filtered.slice(0, displayCount)
  const hasMore = displayCount < filtered.length

  return (
    <PullToRefresh onRefresh={refetch}>
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Recipes</h2>
        <div className="flex gap-2">
          <Link
            to="/recipes/import"
            className="border border-green-700 dark:border-green-500 text-green-700 dark:text-green-400 text-sm font-medium px-3 py-2 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
          >
            Import URL
          </Link>
          <Link
            to="/recipes/new"
            className="bg-green-700 text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-green-800 transition-colors"
          >
            + Add Recipe
          </Link>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'all'
              ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm'
              : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100'
          }`}
        >
          All Recipes
        </button>
        <button
          onClick={() => setActiveTab('pantry')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'pantry'
              ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm'
              : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100'
          }`}
        >
          <Refrigerator size={14} aria-hidden="true" />
          Cook with what you have
          {pantryMatches.length > 0 && (
            <span className="ml-1 min-w-[18px] h-[18px] flex items-center justify-center bg-green-700 text-white text-[10px] font-bold rounded-full px-1">
              {pantryMatches.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'pantry' ? (
        <PantryTab
          pantryItems={pantryItems}
          pantryMatches={pantryMatches}
          expiringItems={expiringItems}
          aiState={aiState}
          onAiSuggest={handleAiSuggestions}
        />
      ) : null}

      {activeTab === 'all' ? (
        <>
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <input
            ref={searchRef}
            type="search"
            placeholder="Search recipes..."
            aria-label="Search recipes"
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
          <Heart size={14} aria-hidden="true" className={showFavoritesOnly ? 'fill-current' : ''} />
          Favorites
        </button>
        <button
          onClick={() => {
            setShowFilters((v) => {
              if (!v) setTimeout(() => ingredientRef.current?.focus(), 50)
              return !v
            })
          }}
          aria-expanded={showFilters}
          aria-label="Toggle advanced filters"
          className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
            showFilters || activeFilterCount > 0
              ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400'
              : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <SlidersHorizontal size={14} aria-hidden="true" />
          Filters
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-green-700 text-white text-[10px] font-bold rounded-full px-1">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Advanced filter panel */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4 space-y-4">
          {/* Ingredient search */}
          <div>
            <label
              htmlFor="ingredient-search"
              className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5"
            >
              Contains ingredient
            </label>
            <div className="relative">
              <input
                ref={ingredientRef}
                id="ingredient-search"
                type="search"
                placeholder="e.g. chicken, garlic…"
                value={ingredientQuery}
                onChange={(e) => setIngredientQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {ingredientQuery && (
                <button
                  onClick={() => setIngredientQuery('')}
                  aria-label="Clear ingredient filter"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* Max cook time slider */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="max-cook-time"
                className="text-xs font-medium text-gray-600 dark:text-gray-400"
              >
                Max cook time
              </label>
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 tabular-nums">
                {maxCookTime >= MAX_COOK_TIME ? 'Any' : `≤ ${maxCookTime} min`}
              </span>
            </div>
            <input
              id="max-cook-time"
              type="range"
              min={15}
              max={MAX_COOK_TIME}
              step={15}
              value={maxCookTime}
              onChange={(e) => setMaxCookTime(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full appearance-none cursor-pointer accent-green-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mt-1">
              <span>15 min</span>
              <span>Any</span>
            </div>
          </div>

          {/* Category chips */}
          {allCategories.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Category
              </p>
              <div className="flex flex-wrap gap-1.5">
                {allCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() =>
                      setSelectedCategories((prev) =>
                        prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
                      )
                    }
                    aria-pressed={selectedCategories.includes(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedCategories.includes(cat)
                        ? 'bg-green-700 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cuisine chips */}
          {allCuisines.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Cuisine</p>
              <div className="flex flex-wrap gap-1.5">
                {allCuisines.map((cui) => (
                  <button
                    key={cui}
                    onClick={() =>
                      setSelectedCuisines((prev) =>
                        prev.includes(cui) ? prev.filter((c) => c !== cui) : [...prev, cui]
                      )
                    }
                    aria-pressed={selectedCuisines.includes(cui)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedCuisines.includes(cui)
                        ? 'bg-green-700 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {cui}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags & Dietary chips */}
          {allTags.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Tags & Dietary
              </p>
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() =>
                      setSelectedTags((prev) =>
                        prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                      )
                    }
                    aria-pressed={selectedTags.includes(tag)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedTags.includes(tag)
                        ? 'bg-green-700 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Dietary chips */}
          <div>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Dietary</p>
            <div className="flex flex-wrap gap-1.5">
              {DIETARY_PREFERENCES.map((pref) => (
                <button
                  key={pref.id}
                  onClick={() =>
                    setSelectedDiets((prev) =>
                      prev.includes(pref.id)
                        ? prev.filter((d) => d !== pref.id)
                        : [...prev, pref.id]
                    )
                  }
                  aria-pressed={selectedDiets.includes(pref.id)}
                  title={pref.description}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedDiets.includes(pref.id)
                      ? 'bg-green-700 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {pref.label}
                </button>
              ))}
            </div>
            {selectedDiets.length > 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                Shows only recipes tagged with these diets
              </p>
            )}
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={clearAdvancedFilters}
              className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 font-medium"
            >
              Clear {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}

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
        {!loading && filtered.length > 0 && (
          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 tabular-nums">
            {filtered.length} recipe{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading ? (
        <div role="status" aria-busy="true" aria-label="Loading recipes">
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <RecipeCardSkeleton key={i} />
            ))}
          </ul>
        </div>
      ) : filtered.length === 0 ? (
        showFavoritesOnly && !hasAnyFilter ? (
          <EmptyState
            illustration={<HeartIllustration />}
            title="No favorites yet"
            description="Tap the heart on any recipe to save it here."
            action={{ label: 'Browse all recipes', onClick: () => setShowFavoritesOnly(false) }}
          />
        ) : hasAnyFilter ? (
          <EmptyState
            illustration={<SearchNoResultsIllustration />}
            title="No recipes found"
            description="No recipes match your current filters."
            action={{ label: 'Clear all filters', onClick: clearAllFilters }}
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
        <>
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" aria-live="polite">
            {displayed.map((recipe, index) => {
              const prepMins = durationToMinutes(recipe.prepTime)
              const cookMins = durationToMinutes(recipe.cookTime)
              return (
                <li
                  key={recipe.id}
                  className="relative animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(index * 40, 200)}ms` }}
                >
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
                        <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                          {recipe.name}
                        </h3>
                        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                          {prepMins + cookMins} min
                        </span>
                      </div>
                      {recipe.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                          {recipe.description}
                        </p>
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
                    aria-label={
                      recipe.isFavorite
                        ? `Remove "${recipe.name}" from favorites`
                        : `Add "${recipe.name}" to favorites`
                    }
                    className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Heart
                      size={16}
                      aria-hidden="true"
                      className={
                        recipe.isFavorite
                          ? 'fill-red-500 text-red-500'
                          : 'text-gray-300 dark:text-gray-600'
                      }
                    />
                  </button>
                </li>
              )
            })}
          </ul>
          {hasMore && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => setDisplayCount((c) => c + PAGE_SIZE)}
                className="px-6 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Show {Math.min(PAGE_SIZE, filtered.length - displayCount)} more recipes
              </button>
            </div>
          )}
        </>
      )}
      </>
    ) : null}
    </div>
    </PullToRefresh>
  )
}
