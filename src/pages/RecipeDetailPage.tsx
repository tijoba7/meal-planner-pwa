import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getRecipe, deleteRecipe } from '../lib/db'
import type { Recipe } from '../types'

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!id) return
    getRecipe(id).then((r) => {
      if (r) setRecipe(r)
      else setNotFound(true)
    })
  }, [id])

  async function handleDelete() {
    if (!id) return
    setDeleting(true)
    await deleteRecipe(id)
    navigate('/recipes')
  }

  if (notFound) {
    return (
      <div className="p-4 max-w-2xl mx-auto text-center py-16">
        <p className="text-gray-500">Recipe not found.</p>
        <Link to="/recipes" className="text-green-600 text-sm mt-2 inline-block">
          ← Back to recipes
        </Link>
      </div>
    )
  }

  if (!recipe) {
    return (
      <div className="p-4 max-w-2xl mx-auto text-center py-16">
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    )
  }

  const totalTime = recipe.prepTimeMinutes + recipe.cookTimeMinutes

  return (
    <div className="p-4 max-w-2xl mx-auto pb-8">
      {/* Back link */}
      <Link to="/recipes" className="text-sm text-green-600 hover:text-green-700 inline-block mb-4">
        ← Recipes
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h2 className="text-2xl font-bold text-gray-800">{recipe.title}</h2>
        <div className="flex gap-2 shrink-0">
          <Link
            to={`/recipes/${recipe.id}/edit`}
            className="text-sm font-medium text-green-600 border border-green-600 px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
          >
            Edit
          </Link>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-sm font-medium text-red-500 border border-red-300 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-3 text-sm text-gray-500 mb-3">
        <span>{recipe.servings} servings</span>
        <span>·</span>
        <span>Prep {recipe.prepTimeMinutes} min</span>
        <span>·</span>
        <span>Cook {recipe.cookTimeMinutes} min</span>
        <span>·</span>
        <span>Total {totalTime} min</span>
      </div>

      {/* Tags */}
      {recipe.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
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

      {/* Description */}
      {recipe.description && (
        <p className="text-gray-600 mb-6">{recipe.description}</p>
      )}

      {/* Ingredients */}
      <section className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Ingredients</h3>
        <ul className="space-y-2">
          {recipe.ingredients.map((ing, i) => (
            <li key={i} className="flex items-baseline gap-2 text-sm">
              <span className="text-gray-400">·</span>
              <span className="font-medium text-gray-700">
                {ing.amount} {ing.unit}
              </span>
              <span className="text-gray-600">{ing.name}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Instructions */}
      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Instructions</h3>
        <ol className="space-y-3">
          {recipe.instructions.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                {i + 1}
              </span>
              <p className="text-gray-700 leading-relaxed pt-0.5">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Delete confirm dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h4 className="text-lg font-semibold text-gray-800 mb-2">Delete recipe?</h4>
            <p className="text-sm text-gray-500 mb-6">
              "{recipe.title}" will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-500 text-white text-sm font-medium py-2 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
