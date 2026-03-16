import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { createRecipe } from '../lib/db'
import { extractRecipeFromUrl, getStoredApiKey, type ExtractedRecipe } from '../lib/scraper'
import RecipeImage from '../components/RecipeImage'
import { useToast } from '../contexts/ToastContext'

type ImportState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'review'; recipe: ExtractedRecipe }
  | { phase: 'saving'; recipe: ExtractedRecipe }

export default function RecipeImportPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [url, setUrl] = useState('')
  const [state, setState] = useState<ImportState>({ phase: 'idle' })

  const apiKey = getStoredApiKey()

  async function handleExtract(e: React.FormEvent) {
    e.preventDefault()
    const trimmedUrl = url.trim()
    if (!trimmedUrl) return

    setState({ phase: 'loading' })
    const result = await extractRecipeFromUrl(trimmedUrl, apiKey)

    if (result.ok) {
      setState({ phase: 'review', recipe: result.recipe })
    } else {
      toast.error('Could not extract recipe. Try a different URL.')
      setState({ phase: 'error', message: result.error })
    }
  }

  async function handleSave() {
    if (state.phase !== 'review') return
    const { recipe } = state
    setState({ phase: 'saving', recipe })
    const saved = await createRecipe({
      name: recipe.name,
      description: recipe.description,
      recipeYield: recipe.recipeYield || '2',
      prepTime: recipe.prepTime || 'PT0M',
      cookTime: recipe.cookTime || 'PT0M',
      recipeIngredient: recipe.recipeIngredient,
      recipeInstructions: recipe.recipeInstructions,
      keywords: recipe.keywords,
      image: recipe.image,
      author: recipe.author,
      url: recipe.url,
      recipeCategory: recipe.recipeCategory,
      recipeCuisine: recipe.recipeCuisine,
    })

    toast.success('Recipe imported.')
    navigate(`/recipes/${saved.id}`)
  }

  function handleReset() {
    setState({ phase: 'idle' })
    setUrl('')
  }

  if (!apiKey) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <Link to="/" className="text-sm text-green-600 hover:text-green-700 inline-block mb-4">
          ← Recipes
        </Link>
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Import Recipe</h2>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
          <p className="text-amber-800 font-medium mb-1">AI API key required</p>
          <p className="text-sm text-amber-700 mb-4">
            Recipe import uses Claude AI to extract recipes from URLs. Add your Anthropic API key in
            Settings to get started.
          </p>
          <Link
            to="/settings"
            className="inline-block bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
          >
            Go to Settings
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-2xl mx-auto pb-10">
      <Link to="/" className="text-sm text-green-600 hover:text-green-700 inline-block mb-4">
        ← Recipes
      </Link>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Import Recipe</h2>
      <p className="text-sm text-gray-500 mb-6">
        Paste a link from Instagram, Pinterest, TikTok, or any recipe website.
      </p>

      {/* URL form */}
      {(state.phase === 'idle' || state.phase === 'error') && (
        <form onSubmit={handleExtract} className="space-y-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.instagram.com/p/…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            required
            autoFocus
          />
          {state.phase === 'error' && (
            <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {state.message}
            </p>
          )}
          <button
            type="submit"
            className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 transition-colors"
          >
            Extract Recipe
          </button>
        </form>
      )}

      {/* Loading */}
      {state.phase === 'loading' && (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mb-4" />
          <p className="text-gray-500 text-sm">Extracting recipe with AI…</p>
        </div>
      )}

      {/* Review */}
      {(state.phase === 'review' || state.phase === 'saving') && (
        <RecipeReview
          recipe={state.recipe}
          onSave={handleSave}
          onReset={handleReset}
          saving={state.phase === 'saving'}
        />
      )}
    </div>
  )
}

// ── Review component ────────────────────────────────────────────────────────

function RecipeReview({
  recipe,
  onSave,
  onReset,
  saving,
}: {
  recipe: ExtractedRecipe
  onSave: () => void
  onReset: () => void
  saving: boolean
}) {
  // Helper: parse ISO 8601 duration to a readable string
  function fmtDuration(iso: string): string {
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
    if (!m) return iso
    const h = parseInt(m[1] ?? '0', 10)
    const min = parseInt(m[2] ?? '0', 10)
    if (h > 0 && min > 0) return `${h}h ${min}m`
    if (h > 0) return `${h}h`
    if (min > 0) return `${min}m`
    return '—'
  }

  return (
    <div className="space-y-5">
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <p className="text-sm text-green-700 font-medium">Recipe extracted! Review before saving.</p>
      </div>

      {recipe.image && (
        <RecipeImage
          src={recipe.image}
          alt={recipe.name}
          className="w-full h-48 rounded-xl"
        />
      )}

      <div>
        <h3 className="text-xl font-bold text-gray-800">{recipe.name}</h3>
        {recipe.author && <p className="text-sm text-gray-400 mt-0.5">by {recipe.author}</p>}
        {recipe.description && <p className="text-sm text-gray-600 mt-2">{recipe.description}</p>}
      </div>

      <div className="flex gap-4 text-sm text-gray-500">
        <span>Serves {recipe.recipeYield}</span>
        {recipe.prepTime && recipe.prepTime !== 'PT0M' && (
          <span>Prep {fmtDuration(recipe.prepTime)}</span>
        )}
        {recipe.cookTime && recipe.cookTime !== 'PT0M' && (
          <span>Cook {fmtDuration(recipe.cookTime)}</span>
        )}
      </div>

      {recipe.recipeIngredient.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Ingredients</h4>
          <ul className="space-y-1">
            {recipe.recipeIngredient.map((ing, i) => (
              <li key={i} className="text-sm text-gray-600 flex gap-2">
                <span className="shrink-0 text-gray-400">
                  {ing.amount > 0 ? ing.amount : ''} {ing.unit}
                </span>
                <span>{ing.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recipe.recipeInstructions.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Instructions</h4>
          <ol className="space-y-2">
            {recipe.recipeInstructions.map((step, i) => (
              <li key={i} className="text-sm text-gray-600 flex gap-3">
                <span className="shrink-0 w-5 h-5 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                  {i + 1}
                </span>
                <span>{step.text}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {recipe.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {recipe.keywords.map((kw) => (
            <span
              key={kw}
              className="bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded-full"
            >
              {kw}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-1 bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Recipe'}
        </button>
        <button
          onClick={onReset}
          disabled={saving}
          className="px-5 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Try another
        </button>
      </div>
    </div>
  )
}
