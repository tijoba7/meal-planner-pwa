import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Search } from 'lucide-react'
import { getRecipes, durationToMinutes } from '../lib/db'
import type { Recipe } from '../types'
import EmptyState from '../components/EmptyState'
import RecipeImage from '../components/RecipeImage'
import Skeleton from '../components/Skeleton'

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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getRecipes().then((r) => {
      setRecipes(r)
      setLoading(false)
    })
  }, [])

  const filtered = query.trim()
    ? recipes.filter((r) => {
        const q = query.toLowerCase()
        return (
          r.name.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.keywords.some((t) => t.toLowerCase().includes(q))
        )
      })
    : recipes

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

      <input
        type="search"
        placeholder="Search recipes..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full mb-4 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
      />

      {loading ? (
        <ul className="space-y-3" aria-busy="true" aria-label="Loading recipes">
          {Array.from({ length: 4 }).map((_, i) => (
            <RecipeCardSkeleton key={i} />
          ))}
        </ul>
      ) : filtered.length === 0 ? (
        query ? (
          <EmptyState
            icon={Search}
            title="No recipes found"
            description={`No recipes match "${query}". Try a different search term.`}
            action={{ label: 'Clear search', onClick: () => setQuery('') }}
          />
        ) : (
          <EmptyState
            icon={BookOpen}
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
              <li key={recipe.id}>
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
                  <div className="flex-1 min-w-0">
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
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
