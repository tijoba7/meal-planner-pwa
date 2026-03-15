import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getRecipes } from '../lib/db'
import type { Recipe } from '../types'

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    getRecipes().then(setRecipes)
  }, [])

  const filtered = query.trim()
    ? recipes.filter((r) => {
        const q = query.toLowerCase()
        return (
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.tags.some((t) => t.toLowerCase().includes(q))
        )
      })
    : recipes

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Recipes</h2>
        <Link
          to="/recipes/new"
          className="bg-green-600 text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          + Add Recipe
        </Link>
      </div>

      <input
        type="search"
        placeholder="Search recipes..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full mb-4 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
      />

      {filtered.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">
          {query ? 'No recipes match your search.' : 'No recipes yet. Add your first one!'}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((recipe) => (
            <li key={recipe.id}>
              <Link
                to={`/recipes/${recipe.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-800">{recipe.title}</h3>
                  <span className="text-xs text-gray-400 shrink-0">
                    {recipe.prepTimeMinutes + recipe.cookTimeMinutes} min
                  </span>
                </div>
                {recipe.description && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{recipe.description}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                  <span>{recipe.servings} servings</span>
                  <span>·</span>
                  <span>prep {recipe.prepTimeMinutes}m</span>
                  <span>·</span>
                  <span>cook {recipe.cookTimeMinutes}m</span>
                </div>
                {recipe.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {recipe.tags.map((tag) => (
                      <span
                        key={tag}
                        className="bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
