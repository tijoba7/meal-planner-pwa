import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Upload, CheckCircle2, XCircle, Loader2, Circle } from 'lucide-react'
import { createRecipe } from '../lib/db'
import {
  extractRecipeFromUrl,
  extractRecipeFromText,
  extractRecipesFromUrls,
  importFromFile,
  detectInputMode,
  parseJsonLdRecipe,
  parsePaprikaRecipe,
  parseCroutonExport,
  getStoredApiKey,
  type ExtractedRecipe,
  type BatchItemState,
  type ScrapeResult,
} from '../lib/scraper'
import { APP_SETTING_KEYS, getAppSettingString } from '../lib/appSettingsService'
import RecipeImage from '../components/RecipeImage'
import { useToast } from '../contexts/ToastContext'

type ImportState =
  | { phase: 'idle' }
  | { phase: 'loading'; label: string }
  | { phase: 'error'; message: string }
  | { phase: 'review'; recipe: ExtractedRecipe }
  | { phase: 'saving'; recipe: ExtractedRecipe }
  | { phase: 'batch'; items: BatchItemState[] }

export default function RecipeImportPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [input, setInput] = useState('')
  const [state, setState] = useState<ImportState>({ phase: 'idle' })
  const fileRef = useRef<HTMLInputElement>(null)
  // null = still checking, true = admin has configured a key, false = no admin key
  const [adminKeyConfigured, setAdminKeyConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    getAppSettingString(APP_SETTING_KEYS.SCRAPING_API_KEY).then((key) => {
      setAdminKeyConfigured(key !== null)
    })
  }, [])

  const userApiKey = getStoredApiKey()
  const hasAnyKey = adminKeyConfigured === true || userApiKey.length > 0

  // ── Helpers ────────────────────────────────────────────────────────────────

  async function saveRecipe(recipe: ExtractedRecipe): Promise<string> {
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
    return saved.id
  }

  function applyFileResults(results: ScrapeResult[]) {
    const successful = results.filter((r) => r.ok)
    if (successful.length === 0) {
      const firstError = results.find((r) => !r.ok)
      setState({
        phase: 'error',
        message: firstError?.ok === false ? firstError.error : 'No recipes found.',
      })
      return
    }
    if (successful.length === 1 && successful[0].ok) {
      setState({ phase: 'review', recipe: successful[0].recipe })
      return
    }
    // Multiple recipes → batch view
    const items: BatchItemState[] = results.map((r, i) => ({
      label: r.ok ? r.recipe.name : `Recipe ${i + 1}`,
      status: r.ok ? 'done' : ('error' as const),
      recipe: r.ok ? r.recipe : undefined,
      error: r.ok ? undefined : r.error,
    }))
    setState({ phase: 'batch', items })
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleImport(e: React.FormEvent) {
    e.preventDefault()
    const raw = input.trim()
    if (!raw) return

    const mode = detectInputMode(raw)

    if (mode.type === 'json') {
      // Parse JSON formats immediately — no AI needed
      const jsonLd = parseJsonLdRecipe(mode.json)
      if (jsonLd.ok) {
        applyFileResults([jsonLd])
        return
      }
      const crouton = parseCroutonExport(mode.json)
      if (crouton.some((r) => r.ok)) {
        applyFileResults(crouton)
        return
      }
      const paprika = parsePaprikaRecipe(mode.json)
      applyFileResults([paprika])
      return
    }

    if (mode.type === 'single-url') {
      setState({ phase: 'loading', label: 'Extracting recipe from URL…' })
      const result = await extractRecipeFromUrl(mode.url, userApiKey || undefined)
      if (result.ok) {
        setState({ phase: 'review', recipe: result.recipe })
      } else {
        setState({ phase: 'error', message: result.error })
      }
      return
    }

    if (mode.type === 'batch-urls') {
      const initialItems: BatchItemState[] = mode.urls.map((url) => ({
        label: url,
        status: 'pending' as const,
      }))
      setState({ phase: 'batch', items: initialItems })
      await extractRecipesFromUrls(mode.urls, userApiKey || undefined, (items: BatchItemState[]) => {
        setState({ phase: 'batch', items })
      })
      return
    }

    // Plain text
    setState({ phase: 'loading', label: 'Extracting recipe from text…' })
    const result = await extractRecipeFromText(raw, userApiKey || undefined)
    if (result.ok) {
      setState({ phase: 'review', recipe: result.recipe })
    } else {
      setState({ phase: 'error', message: result.error })
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setState({ phase: 'loading', label: `Reading ${file.name}…` })
    try {
      const results = await importFromFile(file)
      applyFileResults(results)
    } catch (err) {
      setState({
        phase: 'error',
        message: err instanceof Error ? err.message : 'Failed to read file.',
      })
    }
  }

  async function handleSave() {
    if (state.phase !== 'review') return
    const { recipe } = state
    setState({ phase: 'saving', recipe })
    const id = await saveRecipe(recipe)
    toast.success('Recipe imported.')
    navigate(`/recipes/${id}`)
  }

  async function saveBatchItem(index: number) {
    if (state.phase !== 'batch') return
    const item = state.items[index]
    if (!item.recipe || item.savedId) return

    const id = await saveRecipe(item.recipe)
    const updated = [...state.items]
    updated[index] = { ...updated[index], savedId: id }
    setState({ phase: 'batch', items: updated })
    toast.success(`Saved "${item.recipe.name}"`)
  }

  async function saveAllBatchItems() {
    if (state.phase !== 'batch') return
    const toSave = state.items
      .map((item, i) => ({ item, i }))
      .filter(({ item }) => item.status === 'done' && !item.savedId && item.recipe)

    for (const { item, i } of toSave) {
      if (!item.recipe) continue
      const id = await saveRecipe(item.recipe)
      setState((prev) => {
        if (prev.phase !== 'batch') return prev
        const updated = [...prev.items]
        updated[i] = { ...updated[i], savedId: id }
        return { phase: 'batch', items: updated }
      })
    }
    toast.success(`Saved ${toSave.length} recipes.`)
  }

  function handleReset() {
    setState({ phase: 'idle' })
    setInput('')
  }

  // ── No API key gate ────────────────────────────────────────────────────────
  // Show gate only after we know whether an admin key is configured (adminKeyConfigured !== null).
  // If admin has set a key, users never need to supply their own.

  if (adminKeyConfigured === null && state.phase === 'idle') {
    // Still loading admin config — render nothing to avoid flash
    return null
  }

  if (!hasAnyKey && state.phase === 'idle') {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <Link
          to="/"
          className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 inline-block mb-4"
        >
          ← Recipes
        </Link>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Import Recipe</h2>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5 text-center">
          <p className="text-amber-800 dark:text-amber-300 font-medium mb-1">
            AI API key required for URL &amp; text import
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-400 mb-4">
            Paste a URL or recipe text to import with AI. You can also import .paprikarecipe and
            .json files without an API key.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Link
              to="/settings"
              className="inline-block bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
            >
              Add API key in Settings
            </Link>
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-sm font-medium px-4 py-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/40 transition-colors"
            >
              <Upload size={16} />
              Import file
            </button>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".paprikarecipe,.json"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    )
  }

  // ── Main ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 max-w-2xl mx-auto pb-10">
      <Link
        to="/"
        className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 inline-block mb-4"
      >
        ← Recipes
      </Link>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Import Recipe</h2>

      {/* Input form */}
      {(state.phase === 'idle' || state.phase === 'error') && (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Paste a URL, multiple URLs (one per line), recipe text, or JSON (JSON-LD / Paprika /
            Crouton).
          </p>
          <form onSubmit={handleImport} className="space-y-3">
            <div>
              <label htmlFor="recipe-input" className="sr-only">
                Recipe URL or text
              </label>
              <textarea
                id="recipe-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  'Paste a URL:\nhttps://www.allrecipes.com/recipe/…\n\nOr multiple URLs (one per line):\nhttps://…\nhttps://…\n\nOr paste recipe text directly.'
                }
                rows={6}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 resize-y"
                aria-describedby={state.phase === 'error' ? 'import-error' : undefined}
              />
            </div>
            {state.phase === 'error' && (
              <p
                id="import-error"
                role="alert"
                className="text-red-500 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2"
              >
                {state.message}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!input.trim()}
                className="flex-1 bg-green-700 text-white font-semibold py-3 rounded-xl hover:bg-green-800 transition-colors disabled:opacity-40"
              >
                Import
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                title="Import from file (.paprikarecipe, .json)"
                className="flex items-center gap-2 px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Upload size={18} />
                <span className="hidden sm:inline">File</span>
              </button>
            </div>
          </form>
          <input
            ref={fileRef}
            type="file"
            accept=".paprikarecipe,.json"
            className="hidden"
            onChange={handleFileChange}
          />
        </>
      )}

      {/* Loading */}
      {state.phase === 'loading' && (
        <div className="text-center py-12" role="status" aria-label={state.label}>
          <div
            className="inline-block w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mb-4"
            aria-hidden="true"
          />
          <p className="text-gray-500 dark:text-gray-400 text-sm" aria-hidden="true">
            {state.label}
          </p>
        </div>
      )}

      {/* Single review */}
      {(state.phase === 'review' || state.phase === 'saving') && (
        <RecipeReview
          recipe={state.recipe}
          onSave={handleSave}
          onReset={handleReset}
          saving={state.phase === 'saving'}
        />
      )}

      {/* Batch view */}
      {state.phase === 'batch' && (
        <BatchView
          items={state.items}
          onSave={saveBatchItem}
          onSaveAll={saveAllBatchItems}
          onReset={handleReset}
        />
      )}
    </div>
  )
}

// ── RecipeReview ──────────────────────────────────────────────────────────────

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
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
        <p className="text-sm text-green-700 dark:text-green-400 font-medium">
          Recipe extracted! Review before saving.
        </p>
      </div>

      {recipe.image && (
        <RecipeImage src={recipe.image} alt={recipe.name} className="w-full h-48 rounded-xl" />
      )}

      <div>
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">{recipe.name}</h3>
        {recipe.author && (
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">by {recipe.author}</p>
        )}
        {recipe.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{recipe.description}</p>
        )}
      </div>

      <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400">
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
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Ingredients
          </h4>
          <ul className="space-y-1">
            {recipe.recipeIngredient.map((ing, i) => (
              <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex gap-2">
                <span className="shrink-0 text-gray-400 dark:text-gray-500">
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
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Instructions
          </h4>
          <ol className="space-y-2">
            {recipe.recipeInstructions.map((step, i) => (
              <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex gap-3">
                <span className="shrink-0 w-5 h-5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
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
              className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs px-2 py-0.5 rounded-full"
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
          className="flex-1 bg-green-700 text-white font-semibold py-3 rounded-xl hover:bg-green-800 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Recipe'}
        </button>
        <button
          onClick={onReset}
          disabled={saving}
          className="px-5 py-3 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          Try another
        </button>
      </div>
    </div>
  )
}

// ── BatchView ─────────────────────────────────────────────────────────────────

function BatchView({
  items,
  onSave,
  onSaveAll,
  onReset,
}: {
  items: BatchItemState[]
  onSave: (index: number) => void
  onSaveAll: () => void
  onReset: () => void
}) {
  const isRunning = items.some((i) => i.status === 'pending' || i.status === 'loading')
  const unsavedDone = items.filter((i) => i.status === 'done' && !i.savedId).length
  const errorCount = items.filter((i) => i.status === 'error').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {isRunning ? (
            `Importing ${items.length} recipes…`
          ) : (
            <>
              {items.length - errorCount} of {items.length} extracted
              {errorCount > 0 && <span className="text-red-500 ml-1">({errorCount} failed)</span>}
            </>
          )}
        </p>
        {!isRunning && unsavedDone > 1 && (
          <button
            onClick={onSaveAll}
            className="text-sm font-semibold text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
          >
            Save all ({unsavedDone})
          </button>
        )}
      </div>

      <ul className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800">
            <div className="mt-0.5 shrink-0">
              {item.status === 'loading' && (
                <Loader2 size={18} className="text-green-500 animate-spin" />
              )}
              {item.status === 'pending' && (
                <Circle size={18} className="text-gray-300 dark:text-gray-600" />
              )}
              {item.status === 'done' && item.savedId && (
                <CheckCircle2 size={18} className="text-green-500" />
              )}
              {item.status === 'done' && !item.savedId && (
                <CheckCircle2 size={18} className="text-gray-400 dark:text-gray-500" />
              )}
              {item.status === 'error' && <XCircle size={18} className="text-red-500" />}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                {item.recipe?.name ?? item.label}
              </p>
              {item.recipe?.name && (
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{item.label}</p>
              )}
              {item.error && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">{item.error}</p>
              )}
            </div>

            {item.status === 'done' && !item.savedId && (
              <button
                onClick={() => onSave(i)}
                className="shrink-0 text-xs font-semibold text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 px-2 py-1 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
              >
                Save
              </button>
            )}
            {item.savedId && (
              <Link
                to={`/recipes/${item.savedId}`}
                className="shrink-0 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                View
              </Link>
            )}
          </li>
        ))}
      </ul>

      {!isRunning && (
        <button
          onClick={onReset}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          ← Import more
        </button>
      )}
    </div>
  )
}
