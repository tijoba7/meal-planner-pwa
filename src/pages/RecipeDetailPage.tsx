import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ChefHat } from 'lucide-react'
import { getRecipe, deleteRecipe, durationToMinutes } from '../lib/db'
import type { Recipe } from '../types'
import CookingMode from '../components/CookingMode'

function parseServings(recipeYield: string): number {
  const match = recipeYield.match(/\d+/)
  return match ? Math.max(1, parseInt(match[0], 10)) : 1
}

function formatAmount(amount: number): string {
  if (amount === 0) return '0'
  const whole = Math.floor(amount)
  const decimal = amount - whole
  if (decimal < 0.01) return String(whole)

  const fractions: [number, string][] = [
    [1 / 8, '1/8'],
    [1 / 6, '1/6'],
    [1 / 4, '1/4'],
    [1 / 3, '1/3'],
    [3 / 8, '3/8'],
    [1 / 2, '1/2'],
    [5 / 8, '5/8'],
    [2 / 3, '2/3'],
    [3 / 4, '3/4'],
    [7 / 8, '7/8'],
  ]

  let bestFrac = ''
  let bestDiff = Infinity
  for (const [val, label] of fractions) {
    const diff = Math.abs(decimal - val)
    if (diff < bestDiff) {
      bestDiff = diff
      bestFrac = label
    }
  }

  if (bestDiff < 0.05) {
    return whole > 0 ? `${whole} ${bestFrac}` : bestFrac
  }

  return amount.toFixed(1).replace(/\.0$/, '')
}

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [scaledServings, setScaledServings] = useState(1)
  const [cookingMode, setCookingMode] = useState(false)

  useEffect(() => {
    if (!id) return
    getRecipe(id).then((r) => {
      if (r) {
        setRecipe(r)
        setScaledServings(parseServings(r.recipeYield))
      } else setNotFound(true)
    })
  }, [id])

  async function handleDelete() {
    if (!id) return
    setDeleting(true)
    await deleteRecipe(id)
    navigate('/')
  }

  if (notFound) {
    return (
      <div className="p-4 max-w-2xl mx-auto text-center py-16">
        <p className="text-gray-500">Recipe not found.</p>
        <Link to="/" className="text-green-600 text-sm mt-2 inline-block">
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

  const prepMins = durationToMinutes(recipe.prepTime)
  const cookMins = durationToMinutes(recipe.cookTime)
  const totalTime = prepMins + cookMins

  const originalServings = parseServings(recipe.recipeYield)
  const scale = originalServings > 0 ? scaledServings / originalServings : 1
  const isScaled = scaledServings !== originalServings

  return (
    <div className="p-4 max-w-2xl mx-auto pb-8">
      {cookingMode && (
        <CookingMode recipe={recipe} onClose={() => setCookingMode(false)} />
      )}

      {/* Back link */}
      <Link to="/" className="text-sm text-green-600 hover:text-green-700 inline-block mb-4">
        ← Recipes
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h2 className="text-2xl font-bold text-gray-800">{recipe.name}</h2>
        <div className="flex gap-2 shrink-0">
          {recipe.recipeInstructions.length > 0 && (
            <button
              onClick={() => setCookingMode(true)}
              className="flex items-center gap-1.5 text-sm font-medium bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors"
            >
              <ChefHat size={14} strokeWidth={2} aria-hidden="true" />
              Cook
            </button>
          )}
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
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mb-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setScaledServings((s) => Math.max(1, s - 1))}
            disabled={scaledServings <= 1}
            aria-label="Decrease servings"
            className="w-6 h-6 flex items-center justify-center rounded-full border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-colors leading-none select-none"
          >
            −
          </button>
          <span className="text-center">
            <span className="font-medium text-gray-700">{scaledServings}</span>
            {' servings'}
          </span>
          <button
            onClick={() => setScaledServings((s) => s + 1)}
            aria-label="Increase servings"
            className="w-6 h-6 flex items-center justify-center rounded-full border border-gray-300 text-gray-500 hover:bg-gray-50 transition-colors leading-none select-none"
          >
            +
          </button>
        </div>
        <span>·</span>
        <span>Prep {prepMins} min</span>
        <span>·</span>
        <span>Cook {cookMins} min</span>
        <span>·</span>
        <span>Total {totalTime} min</span>
      </div>

      {/* Keywords */}
      {recipe.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {recipe.keywords.map((tag) => (
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
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">Ingredients</h3>
          {isScaled && (
            <button
              onClick={() => setScaledServings(originalServings)}
              className="text-xs text-green-600 hover:text-green-700 hover:underline"
            >
              Reset to {originalServings}
            </button>
          )}
        </div>
        <ul className="space-y-2">
          {recipe.recipeIngredient.map((ing, i) => {
            const scaledAmount = ing.amount * scale
            const showOriginal = isScaled && ing.amount > 0
            return (
              <li key={i} className="flex items-baseline gap-2 text-sm">
                <span className="text-gray-400">·</span>
                <span className="font-medium text-gray-700">
                  {formatAmount(scaledAmount)} {ing.unit}
                  {showOriginal && (
                    <span className="font-normal text-gray-400 ml-1">
                      (was {formatAmount(ing.amount)})
                    </span>
                  )}
                </span>
                <span className="text-gray-600">{ing.name}</span>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Instructions */}
      <section>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Instructions</h3>
        <ol className="space-y-3">
          {recipe.recipeInstructions.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                {i + 1}
              </span>
              <p className="text-gray-700 leading-relaxed pt-0.5">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Delete confirm dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-sm w-full shadow-xl">
            <h4 className="text-lg font-semibold text-gray-800 mb-2">Delete recipe?</h4>
            <p className="text-sm text-gray-500 mb-6">
              "{recipe.name}" will be permanently deleted. This cannot be undone.
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
