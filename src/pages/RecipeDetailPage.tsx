import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  AlertTriangle,
  Check,
  ChefHat,
  Copy,
  Heart,
  Library,
  MoreHorizontal,
  Pencil,
  Printer,
  Send,
  Share2,
  Trash2,
  Globe,
  Users,
  Lock,
  X,
} from 'lucide-react'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useUnitPreference } from '../hooks/useUnitPreference'
import { getDietaryPrefs, detectAllergenIngredients, DIETARY_PREFERENCES } from '../lib/dietary'
import {
  useRecipe,
  useDeleteRecipe,
  useDuplicateRecipe,
  useToggleFavorite,
} from '../hooks/useRecipes'
import {
  useCollections,
  useAddRecipeToCollection,
  useRemoveRecipeFromCollection,
} from '../hooks/useCollections'
import { durationToMinutes } from '../lib/db'
import { convertUnit } from '../lib/units'
import CookingMode from '../components/CookingMode'
import RecipeImage from '../components/RecipeImage'
import Skeleton from '../components/Skeleton'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import {
  publishRecipe,
  updateVisibility,
  getCloudRecipeMeta,
  type RecipeCloudMeta,
} from '../lib/recipeShareService'
import type { RecipeVisibility } from '../types/supabase'
import {
  getMyGroups,
  getGroupRecipeIds,
  shareRecipeToGroup,
  removeRecipeFromGroup,
  type GroupWithMeta,
} from '../lib/groupService'
import { calculateNutrition, nutritionResultToRecord } from '../lib/nutritionCalculator'
import PostComposer from '../components/social/PostComposer'

// ─── Nutrition helpers ────────────────────────────────────────────────────────

const NUTRITION_FIELDS: { key: string; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'proteinContent', label: 'Protein', unit: 'g' },
  { key: 'fatContent', label: 'Fat', unit: 'g' },
  { key: 'carbohydrateContent', label: 'Carbs', unit: 'g' },
  { key: 'fiberContent', label: 'Fiber', unit: 'g' },
]

function parseNutritionValue(val: string | number | undefined): number {
  if (val === undefined || val === null || val === '') return 0
  if (typeof val === 'number') return val
  const match = String(val).match(/[\d.]+/)
  return match ? parseFloat(match[0]) : 0
}

function hasNutrition(nutrition: Record<string, string | number> | undefined): boolean {
  if (!nutrition) return false
  return NUTRITION_FIELDS.some((f) => parseNutritionValue(nutrition[f.key]) > 0)
}

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
  const toast = useToast()
  const { user } = useAuth()

  const { data: recipe, isLoading: recipeLoading } = useRecipe(id ?? '')
  const deleteRecipeMutation = useDeleteRecipe()
  const duplicateRecipeMutation = useDuplicateRecipe()
  const toggleFavoriteMutation = useToggleFavorite()

  // Collections
  const { data: collections = [] } = useCollections()
  const addToCollectionMutation = useAddRecipeToCollection()
  const removeFromCollectionMutation = useRemoveRecipeFromCollection()

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [scaledServings, setScaledServings] = useState(1)
  const [cookingMode, setCookingMode] = useState(false)

  // Mobile "more options" sheet
  const [showMoreSheet, setShowMoreSheet] = useState(false)

  // Collection panel state
  const [showCollectionPanel, setShowCollectionPanel] = useState(false)
  const [collectionTogglingId, setCollectionTogglingId] = useState<string | null>(null)

  // Share panel state
  const [showSharePanel, setShowSharePanel] = useState(false)
  const [showPostComposer, setShowPostComposer] = useState(false)
  const [cloudMeta, setCloudMeta] = useState<RecipeCloudMeta | null>(null)
  const [selectedVisibility, setSelectedVisibility] = useState<RecipeVisibility>('public')
  const [sharing, setSharing] = useState(false)
  // Group sharing state
  const [userGroups, setUserGroups] = useState<GroupWithMeta[]>([])
  const [sharedGroupIds, setSharedGroupIds] = useState<Set<string>>(new Set())
  const [groupTogglingId, setGroupTogglingId] = useState<string | null>(null)

  const [unitSystem] = useUnitPreference()

  // Sync scaledServings when recipe loads
  useEffect(() => {
    if (recipe) setScaledServings(parseServings(recipe.recipeYield))
  }, [recipe])

  // Allergen detection based on user dietary prefs
  const userDietaryPrefs = getDietaryPrefs()
  const allergenIngredientIndices = recipe
    ? detectAllergenIngredients(
        recipe.recipeIngredient.map((i) => i.name),
        userDietaryPrefs
      )
    : new Set<number>()
  const flaggedDietLabels = userDietaryPrefs
    .filter(
      (id) => allergenIngredientIndices.size > 0 && DIETARY_PREFERENCES.find((p) => p.id === id)
    )
    .map((id) => DIETARY_PREFERENCES.find((p) => p.id === id)!.label)

  useKeyboardShortcuts({
    Escape: () => {
      if (cookingMode) return // CookingMode handles its own Escape
      if (showMoreSheet) setShowMoreSheet(false)
      else if (showDeleteConfirm) setShowDeleteConfirm(false)
      else if (showSharePanel) setShowSharePanel(false)
      else navigate(-1)
    },
  })

  useEffect(() => {
    if (!id || !user) return
    getCloudRecipeMeta(id).then((meta) => {
      if (meta) {
        setCloudMeta(meta)
        setSelectedVisibility(meta.visibility)
      }
    })
  }, [id, user])

  // Estimated nutrition — computed before early returns to satisfy the Rules of Hooks.
  // Only used when manual nutrition data is absent from the recipe.
  const estimatedNutrition = useMemo(() => {
    if (!recipe || hasNutrition(recipe.nutrition)) return null
    const servings = parseServings(recipe.recipeYield)
    const result = calculateNutrition(recipe.recipeIngredient, servings)
    return result ? nutritionResultToRecord(result) : null
  }, [recipe])

  async function handleCollectionToggle(collectionId: string) {
    if (!id) return
    const col = collections.find((c) => c.id === collectionId)
    if (!col) return
    setCollectionTogglingId(collectionId)
    try {
      if (col.recipeIds.includes(id)) {
        await removeFromCollectionMutation.mutateAsync({ collectionId, recipeId: id })
      } else {
        await addToCollectionMutation.mutateAsync({ collectionId, recipeId: id })
      }
    } catch {
      toast.error('Failed to update collection.')
    }
    setCollectionTogglingId(null)
  }

  useEffect(() => {
    if (!user || !showSharePanel) return
    Promise.all([
      getMyGroups(user.id),
      id ? getGroupRecipeIds(id) : Promise.resolve(new Set<string>()),
    ]).then(([groups, sharedIds]) => {
      setUserGroups(groups)
      setSharedGroupIds(sharedIds)
    })
  }, [id, user, showSharePanel])

  async function handleGroupToggle(groupId: string, currentlyShared: boolean) {
    if (!id || !user) return
    setGroupTogglingId(groupId)
    if (currentlyShared) {
      await removeRecipeFromGroup(groupId, id)
      setSharedGroupIds((prev) => {
        const next = new Set(prev)
        next.delete(groupId)
        return next
      })
    } else {
      await shareRecipeToGroup(groupId, id, user.id)
      setSharedGroupIds((prev) => new Set([...prev, groupId]))
    }
    setGroupTogglingId(null)
  }

  async function handleToggleFavorite() {
    if (!id || !recipe) return
    try {
      await toggleFavoriteMutation.mutateAsync(id)
    } catch {
      toast.error('Failed to update favorite.')
    }
  }

  async function handleDuplicate() {
    if (!id) return
    try {
      const copy = await duplicateRecipeMutation.mutateAsync(id)
      toast.success(`"${copy.name}" created.`)
      navigate(`/recipes/${copy.id}/edit`)
    } catch {
      toast.error('Failed to duplicate recipe.')
    }
  }

  async function handleDelete() {
    if (!id || !recipe) return
    const deletedName = recipe.name
    try {
      await deleteRecipeMutation.mutateAsync(id)
      navigate('/')
      toast.success(`"${deletedName}" deleted.`)
    } catch {
      toast.error('Failed to delete recipe.')
    }
  }

  async function handleShare() {
    if (!recipe || !user) return
    setSharing(true)
    const { error } = cloudMeta
      ? await updateVisibility(recipe.id, selectedVisibility)
      : await publishRecipe(recipe, user.id, selectedVisibility)
    if (error) {
      toast.error('Failed to update sharing settings.')
    } else {
      const newMeta: RecipeCloudMeta = {
        visibility: selectedVisibility,
        published: selectedVisibility !== 'private',
      }
      setCloudMeta(newMeta)
      const msg =
        selectedVisibility === 'private' ? 'Recipe set to private.' : 'Recipe sharing updated!'
      toast.success(msg)
      setShowSharePanel(false)
    }
    setSharing(false)
  }

  if (!recipeLoading && !recipe) {
    return (
      <div className="p-4 max-w-2xl mx-auto text-center py-16">
        <p className="text-gray-500 dark:text-gray-400">Recipe not found.</p>
        <Link to="/" className="text-green-600 dark:text-green-400 text-sm mt-2 inline-block">
          ← Back to recipes
        </Link>
      </div>
    )
  }

  if (recipeLoading || !recipe) {
    return (
      <div className="p-4 max-w-2xl mx-auto pb-8" role="status" aria-busy="true" aria-label="Loading recipe">
        <Skeleton className="h-4 w-20 mb-4" />
        <div className="flex items-start justify-between gap-3 mb-4">
          <Skeleton className="h-8 w-2/3" />
          <div className="flex gap-2 shrink-0">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-12" />
          </div>
        </div>
        <div className="flex gap-4 mb-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="w-full h-48 md:h-64 rounded-xl mb-4" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-4/5 mb-6" />
        <Skeleton className="h-6 w-28 mb-3" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full mb-2" />
        ))}
      </div>
    )
  }

  const prepMins = durationToMinutes(recipe.prepTime)
  const cookMins = durationToMinutes(recipe.cookTime)
  const totalTime = prepMins + cookMins

  const originalServings = parseServings(recipe.recipeYield)
  const scale = originalServings > 0 ? scaledServings / originalServings : 1
  const isScaled = scaledServings !== originalServings

  const displayNutrition = hasNutrition(recipe.nutrition) ? recipe.nutrition : estimatedNutrition
  const isEstimatedNutrition = !hasNutrition(recipe.nutrition) && estimatedNutrition !== null

  return (
    <div className="p-4 max-w-2xl mx-auto pb-8">
      {cookingMode && createPortal(<CookingMode recipe={recipe} onClose={() => setCookingMode(false)} />, document.body)}

      {/* Back link */}
      <Link
        to="/"
        className="print:hidden text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 inline-block mb-4"
      >
        ← Recipes
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{recipe.name}</h2>

        {/* Mobile: favorite + cook + "more" overflow button */}
        <div className="print:hidden flex items-center gap-2 shrink-0 md:hidden">
          <button
            onClick={handleToggleFavorite}
            aria-label={recipe.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Heart
              size={16}
              aria-hidden="true"
              className={
                recipe.isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400 dark:text-gray-500'
              }
            />
          </button>
          {recipe.recipeInstructions.length > 0 && (
            <button
              onClick={() => setCookingMode(true)}
              className="min-h-[44px] flex items-center gap-1.5 text-sm font-medium bg-green-700 text-white px-3 rounded-lg hover:bg-green-800 transition-colors"
            >
              <ChefHat size={14} strokeWidth={2} aria-hidden="true" />
              Cook
            </button>
          )}
          <button
            onClick={() => setShowMoreSheet(true)}
            aria-label="More options"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <MoreHorizontal
              size={16}
              aria-hidden="true"
              className="text-gray-500 dark:text-gray-400"
            />
          </button>
        </div>

        {/* Desktop: all action buttons inline */}
        <div className="print:hidden hidden md:flex items-center gap-2 shrink-0">
          <button
            onClick={handleToggleFavorite}
            aria-label={recipe.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            className="flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Heart
              size={16}
              aria-hidden="true"
              className={
                recipe.isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400 dark:text-gray-500'
              }
            />
          </button>
          {recipe.recipeInstructions.length > 0 && (
            <button
              onClick={() => setCookingMode(true)}
              className="flex items-center gap-1.5 text-sm font-medium bg-green-700 text-white px-3 py-1.5 rounded-lg hover:bg-green-800 transition-colors"
            >
              <ChefHat size={14} strokeWidth={2} aria-hidden="true" />
              Cook
            </button>
          )}
          {user && (
            <>
              <button
                onClick={() => setShowPostComposer(true)}
                aria-label="Post recipe to feed"
                className="flex items-center gap-1.5 text-sm font-medium bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors"
              >
                <Send size={14} strokeWidth={2} aria-hidden="true" />
                Post
              </button>
              <button
                onClick={() => setShowSharePanel(true)}
                aria-label="Share recipe"
                className="flex items-center gap-1.5 text-sm font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Share2 size={14} strokeWidth={2} aria-hidden="true" />
                {cloudMeta && cloudMeta.visibility !== 'private' ? 'Shared' : 'Share'}
              </button>
            </>
          )}
          <button
            onClick={() => setShowCollectionPanel(true)}
            aria-label="Add to collection"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Library size={14} strokeWidth={2} aria-hidden="true" />
            Collect
          </button>
          <button
            onClick={() => window.print()}
            aria-label="Print recipe"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Printer size={14} strokeWidth={2} aria-hidden="true" />
            Print
          </button>
          <Link
            to={`/recipes/${recipe.id}/edit`}
            className="text-sm font-medium text-green-600 dark:text-green-400 border border-green-600 dark:border-green-500 px-3 py-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
          >
            Edit
          </Link>
          <button
            onClick={handleDuplicate}
            disabled={duplicateRecipeMutation.isPending}
            aria-label="Duplicate recipe"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <Copy size={14} strokeWidth={2} aria-hidden="true" />
            {duplicateRecipeMutation.isPending ? 'Copying…' : 'Duplicate'}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-sm font-medium text-red-500 dark:text-red-400 border border-red-300 dark:border-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mb-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setScaledServings((s) => Math.max(1, s - 1))}
            disabled={scaledServings <= 1}
            aria-label="Decrease servings"
            className="print:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors leading-none select-none"
          >
            −
          </button>
          <span className="text-center">
            <span className="font-medium text-gray-700 dark:text-gray-200">{scaledServings}</span>
            {' servings'}
          </span>
          <button
            onClick={() => setScaledServings((s) => s + 1)}
            aria-label="Increase servings"
            className="print:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors leading-none select-none"
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

      {/* Keywords & Dietary tags */}
      {(recipe.keywords.length > 0 || (recipe.suitableForDiet?.length ?? 0) > 0) && (
        <div className="flex flex-wrap gap-1 mb-4">
          {recipe.keywords.map((tag) => (
            <span
              key={tag}
              className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs px-2 py-0.5 rounded-full"
            >
              {tag}
            </span>
          ))}
          {recipe.suitableForDiet?.map((dietId) => {
            const pref = DIETARY_PREFERENCES.find((p) => p.id === dietId)
            if (!pref) return null
            return (
              <span
                key={dietId}
                title={pref.description}
                className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs px-2 py-0.5 rounded-full"
              >
                {pref.label}
              </span>
            )
          })}
        </div>
      )}

      {/* Hero image */}
      {recipe.image && (
        <RecipeImage
          src={recipe.image}
          alt={recipe.name}
          className="w-full h-48 md:h-64 rounded-xl mb-4"
        />
      )}

      {/* Description */}
      {recipe.description && (
        <p className="text-gray-600 dark:text-gray-300 mb-6">{recipe.description}</p>
      )}

      {/* Ingredients */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Ingredients</h3>
          {isScaled && (
            <button
              onClick={() => setScaledServings(originalServings)}
              className="print:hidden text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:underline"
            >
              Reset to {originalServings}
            </button>
          )}
        </div>
        {allergenIngredientIndices.size > 0 && (
          <div className="print:hidden flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 mb-3 text-sm text-amber-800 dark:text-amber-200">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
            <p>
              Contains ingredients that may not suit your dietary preferences
              {flaggedDietLabels.length > 0 && (
                <span className="font-medium"> ({flaggedDietLabels.join(', ')})</span>
              )}
              . Flagged ingredients are highlighted below.
            </p>
          </div>
        )}
        <ul className="space-y-2 print:columns-2 print:[column-gap:1.5rem]">
          {recipe.recipeIngredient.map((ing, i) => {
            const scaledAmount = ing.amount * scale
            const { amount: displayAmount, unit: displayUnit } = convertUnit(
              scaledAmount,
              ing.unit,
              unitSystem
            )
            const showOriginal = isScaled && ing.amount > 0
            const isFlagged = allergenIngredientIndices.has(i)
            return (
              <li key={i} className="flex items-baseline gap-2 text-sm">
                <span
                  className={
                    isFlagged
                      ? 'text-amber-500 dark:text-amber-400'
                      : 'text-gray-400 dark:text-gray-500'
                  }
                >
                  ·
                </span>
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {formatAmount(displayAmount)} {displayUnit}
                  {showOriginal && (
                    <span className="font-normal text-gray-400 dark:text-gray-500 ml-1">
                      (was {formatAmount(ing.amount)} {ing.unit})
                    </span>
                  )}
                </span>
                <span
                  className={
                    isFlagged
                      ? 'text-amber-700 dark:text-amber-300 font-medium'
                      : 'text-gray-600 dark:text-gray-300'
                  }
                >
                  {ing.name}
                  {isFlagged && (
                    <AlertTriangle
                      size={12}
                      className="inline ml-1 mb-0.5 text-amber-500"
                      aria-label="allergen warning"
                    />
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Instructions */}
      <section className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">
          Instructions
        </h3>
        <ol className="space-y-3">
          {recipe.recipeInstructions.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm print:[break-inside:avoid]">
              <span className="shrink-0 w-6 h-6 bg-green-700 text-white rounded-full flex items-center justify-center text-xs font-bold">
                {i + 1}
              </span>
              <p className="text-gray-700 dark:text-gray-200 leading-relaxed pt-0.5">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Nutrition */}
      {displayNutrition && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Nutrition</h3>
            {isEstimatedNutrition && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                Estimated
              </span>
            )}
            <span className="text-xs text-gray-400 dark:text-gray-500">
              per {scaledServings} serving{scaledServings !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="grid grid-cols-5 gap-2 text-center">
              {NUTRITION_FIELDS.map(({ key, label, unit }) => {
                const base = parseNutritionValue(displayNutrition[key])
                if (!base) return null
                const scaled = base * scale
                const display = scaled % 1 === 0 ? String(Math.round(scaled)) : scaled.toFixed(1)
                return (
                  <div key={key}>
                    <p className="text-base font-bold text-gray-800 dark:text-gray-100 leading-tight">
                      {display}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{unit}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{label}</p>
                  </div>
                )
              })}
            </div>
            {isEstimatedNutrition && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 text-center">
                Auto-calculated from ingredients · Manually entered values take precedence
              </p>
            )}
          </div>
        </section>
      )}

      {/* Post to feed composer */}
      {showPostComposer && user && recipe && (
        <PostComposer
          recipe={recipe}
          cloudMeta={cloudMeta}
          onClose={() => setShowPostComposer(false)}
          onSuccess={(visibility) => {
            setCloudMeta({ visibility, published: visibility !== 'private' })
            setSelectedVisibility(visibility)
          }}
        />
      )}

      {/* Share panel */}
      {showSharePanel && (
        <div className="print:hidden fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-4 z-50 animate-fade-in">
          <div
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-sm shadow-xl animate-slide-up sm:animate-scale-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-panel-title"
          >
            <div className="flex items-center justify-between mb-4">
              <h4
                id="share-panel-title"
                className="text-base font-semibold text-gray-800 dark:text-gray-100"
              >
                Share recipe
              </h4>
              <button
                onClick={() => setShowSharePanel(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Choose who can see this recipe.
            </p>
            <div className="space-y-2 mb-5">
              {(
                [
                  { value: 'public', label: 'Public', desc: 'Anyone can discover it', Icon: Globe },
                  {
                    value: 'friends',
                    label: 'Friends only',
                    desc: 'Only your accepted friends',
                    Icon: Users,
                  },
                  { value: 'private', label: 'Private', desc: 'Only you', Icon: Lock },
                ] as { value: RecipeVisibility; label: string; desc: string; Icon: typeof Globe }[]
              ).map(({ value, label, desc, Icon }) => (
                <button
                  key={value}
                  onClick={() => setSelectedVisibility(value)}
                  aria-pressed={selectedVisibility === value}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                    selectedVisibility === value
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon
                    size={18}
                    className={
                      selectedVisibility === value
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-400 dark:text-gray-500'
                    }
                    aria-hidden="true"
                  />
                  <div>
                    <p
                      className={`text-sm font-medium ${selectedVisibility === value ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-200'}`}
                    >
                      {label}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
            {/* Groups section — visible when non-private and user has groups */}
            {selectedVisibility !== 'private' && userGroups.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Also share to groups
                </p>
                <div className="space-y-1.5">
                  {userGroups.map((group) => {
                    const shared = sharedGroupIds.has(group.id)
                    const busy = groupTogglingId === group.id
                    return (
                      <button
                        key={group.id}
                        onClick={() => handleGroupToggle(group.id, shared)}
                        disabled={busy || sharing}
                        aria-pressed={shared}
                        aria-label={`${shared ? 'Remove from' : 'Share to'} ${group.name}`}
                        className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-colors disabled:opacity-50 ${
                          shared
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                            : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            shared
                              ? 'bg-green-700 border-green-600'
                              : 'border-gray-300 dark:border-gray-500'
                          }`}
                        >
                          {shared && <Check size={10} strokeWidth={3} aria-hidden="true" />}
                        </div>
                        <span
                          className={`text-sm truncate ${shared ? 'text-green-700 dark:text-green-300 font-medium' : 'text-gray-700 dark:text-gray-200'}`}
                        >
                          {group.name}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto shrink-0">
                          {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowSharePanel(false)}
                className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                disabled={sharing}
              >
                Cancel
              </button>
              <button
                onClick={handleShare}
                disabled={sharing}
                className="flex-1 bg-green-700 text-white text-sm font-medium py-2 rounded-lg hover:bg-green-800 transition-colors disabled:opacity-50"
              >
                {sharing ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collections panel */}
      {showCollectionPanel && (
        <div className="print:hidden fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in">
          <div
            className="bg-white dark:bg-gray-800 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[80vh] shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="collections-panel-title"
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h4
                id="collections-panel-title"
                className="font-bold text-gray-800 dark:text-gray-100"
              >
                Add to Collection
              </h4>
              <button
                onClick={() => setShowCollectionPanel(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                aria-label="Close"
              >
                <X size={20} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              {collections.length === 0 ? (
                <div className="text-center py-6">
                  <Library
                    size={36}
                    strokeWidth={1.5}
                    className="mx-auto mb-3 text-gray-300 dark:text-gray-600"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                    No collections yet
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                    Create a collection to organize your recipes.
                  </p>
                  <Link
                    to="/collections"
                    onClick={() => setShowCollectionPanel(false)}
                    className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 font-medium"
                  >
                    Go to Collections →
                  </Link>
                </div>
              ) : (
                <ul className="space-y-2">
                  {collections.map((col) => {
                    const inCollection = id ? col.recipeIds.includes(id) : false
                    const busy = collectionTogglingId === col.id
                    return (
                      <li key={col.id}>
                        <button
                          onClick={() => handleCollectionToggle(col.id)}
                          disabled={busy}
                          aria-pressed={inCollection}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors disabled:opacity-50 ${
                            inCollection
                              ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                              : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                              inCollection
                                ? 'bg-green-700 border-green-600'
                                : 'border-gray-300 dark:border-gray-500'
                            }`}
                          >
                            {inCollection && <Check size={12} strokeWidth={3} aria-hidden="true" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-medium truncate ${inCollection ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-200'}`}
                            >
                              {col.name}
                            </p>
                            {col.description && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                {col.description}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                            {col.recipeIds.length} recipe{col.recipeIds.length !== 1 ? 's' : ''}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setShowCollectionPanel(false)}
                className="w-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile "more options" bottom sheet — portal to document.body to escape flex stacking context */}
      {showMoreSheet && createPortal(
        <div
          className="print:hidden fixed inset-0 bg-black/50 z-50 flex items-end justify-center animate-fade-in md:hidden"
          onClick={() => setShowMoreSheet(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 w-full rounded-t-2xl shadow-xl animate-slide-up"
            role="dialog"
            aria-modal="true"
            aria-label="Recipe options"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 space-y-1">
              <Link
                to={`/recipes/${recipe.id}/edit`}
                onClick={() => setShowMoreSheet(false)}
                className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <Pencil
                  size={18}
                  strokeWidth={2}
                  className="text-gray-500 dark:text-gray-400 shrink-0"
                  aria-hidden="true"
                />
                Edit recipe
              </Link>
              {user && (
                <>
                  <button
                    onClick={() => {
                      setShowMoreSheet(false)
                      setShowPostComposer(true)
                    }}
                    className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-left text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Send
                      size={18}
                      strokeWidth={2}
                      className="text-green-600 dark:text-green-400 shrink-0"
                      aria-hidden="true"
                    />
                    Post to feed
                  </button>
                  <button
                    onClick={() => {
                      setShowMoreSheet(false)
                      setShowSharePanel(true)
                    }}
                    className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-left text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Share2
                      size={18}
                      strokeWidth={2}
                      className="text-gray-500 dark:text-gray-400 shrink-0"
                      aria-hidden="true"
                    />
                    {cloudMeta && cloudMeta.visibility !== 'private'
                      ? 'Sharing settings'
                      : 'Share recipe'}
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  setShowMoreSheet(false)
                  setShowCollectionPanel(true)
                }}
                className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-left text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <Library
                  size={18}
                  strokeWidth={2}
                  className="text-gray-500 dark:text-gray-400 shrink-0"
                  aria-hidden="true"
                />
                Add to collection
              </button>
              <button
                onClick={() => {
                  setShowMoreSheet(false)
                  window.print()
                }}
                className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-left text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <Printer
                  size={18}
                  strokeWidth={2}
                  className="text-gray-500 dark:text-gray-400 shrink-0"
                  aria-hidden="true"
                />
                Print recipe
              </button>
              <button
                onClick={() => {
                  setShowMoreSheet(false)
                  handleDuplicate()
                }}
                disabled={duplicateRecipeMutation.isPending}
                className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-left text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                <Copy
                  size={18}
                  strokeWidth={2}
                  className="text-gray-500 dark:text-gray-400 shrink-0"
                  aria-hidden="true"
                />
                {duplicateRecipeMutation.isPending ? 'Duplicating…' : 'Duplicate recipe'}
              </button>
              <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
              <button
                onClick={() => {
                  setShowMoreSheet(false)
                  setShowDeleteConfirm(true)
                }}
                className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-left text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 size={18} strokeWidth={2} className="shrink-0" aria-hidden="true" />
                Delete recipe
              </button>
            </div>
            <div className="pb-[env(safe-area-inset-bottom)]" />
          </div>
        </div>,
        document.body
      )}

      {/* Delete confirm dialog — portal to document.body to escape flex stacking context */}
      {showDeleteConfirm && createPortal(
        <div className="print:hidden fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-sm w-full shadow-xl animate-scale-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-recipe-dialog-title"
          >
            <h4
              id="delete-recipe-dialog-title"
              className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2"
            >
              Delete recipe?
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              "{recipe.name}" will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                disabled={deleteRecipeMutation.isPending}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteRecipeMutation.isPending}
                className="flex-1 bg-red-500 text-white text-sm font-medium py-2 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleteRecipeMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
