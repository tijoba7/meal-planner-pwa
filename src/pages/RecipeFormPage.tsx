import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Camera, X } from 'lucide-react'
import { getRecipe, createRecipe, updateRecipe, minutesToDuration, durationToMinutes } from '../lib/db'
import {
  uploadRecipeImage,
  resizeToDataUrl,
  deleteRecipeImages,
  isStorageUrl,
  MAX_INPUT_BYTES,
} from '../lib/imageService'
import { isSupabaseAvailable } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import type { Ingredient } from '../types'

interface FormState {
  name: string
  description: string
  recipeYield: string
  prepTimeMinutes: string
  cookTimeMinutes: string
  ingredients: Ingredient[]
  instructions: string[]
  keywords: string
  nutritionCalories: string
  nutritionProtein: string
  nutritionFat: string
  nutritionCarbs: string
  nutritionFiber: string
}

const emptyForm: FormState = {
  name: '',
  description: '',
  recipeYield: '2',
  prepTimeMinutes: '0',
  cookTimeMinutes: '0',
  ingredients: [{ name: '', amount: 1, unit: '' }],
  instructions: [''],
  keywords: '',
  nutritionCalories: '',
  nutritionProtein: '',
  nutritionFat: '',
  nutritionCarbs: '',
  nutritionFiber: '',
}

function parseNutritionFormValue(val: string | number | undefined): string {
  if (val === undefined || val === null || val === '') return ''
  if (typeof val === 'number') return val > 0 ? String(val) : ''
  const match = String(val).match(/[\d.]+/)
  return match && parseFloat(match[0]) > 0 ? match[0] : ''
}

interface FormErrors {
  name?: string
  ingredients?: string
  instructions?: string
}

export default function RecipeFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const isEdit = Boolean(id)

  const [form, setForm] = useState<FormState>(emptyForm)
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)
  const [notFound, setNotFound] = useState(false)

  // ── Image state ─────────────────────────────────────────────────────────────
  // `pendingFile`    – file selected by the user, not yet uploaded
  // `previewUrl`     – object URL for preview (or existing recipe.image)
  // `existingImage`  – saved image URL from the recipe (edit mode)
  // `existingThumb`  – saved thumbnail URL from the recipe (edit mode)
  // `imageCleared`   – user explicitly removed the image
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [existingImage, setExistingImage] = useState<string | null>(null)
  const [existingThumb, setExistingThumb] = useState<string | null>(null)
  const [imageCleared, setImageCleared] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) return
    getRecipe(id).then((recipe) => {
      if (!recipe) {
        setNotFound(true)
        return
      }
      setForm({
        name: recipe.name,
        description: recipe.description,
        recipeYield: recipe.recipeYield,
        prepTimeMinutes: String(durationToMinutes(recipe.prepTime)),
        cookTimeMinutes: String(durationToMinutes(recipe.cookTime)),
        ingredients: recipe.recipeIngredient.length > 0 ? recipe.recipeIngredient : [{ name: '', amount: 1, unit: '' }],
        instructions: recipe.recipeInstructions.length > 0 ? recipe.recipeInstructions.map((s) => s.text) : [''],
        keywords: recipe.keywords.join(', '),
        nutritionCalories: parseNutritionFormValue(recipe.nutrition?.calories),
        nutritionProtein: parseNutritionFormValue(recipe.nutrition?.proteinContent),
        nutritionFat: parseNutritionFormValue(recipe.nutrition?.fatContent),
        nutritionCarbs: parseNutritionFormValue(recipe.nutrition?.carbohydrateContent),
        nutritionFiber: parseNutritionFormValue(recipe.nutrition?.fiberContent),
      })
      if (recipe.image) {
        setExistingImage(recipe.image)
        setPreviewUrl(recipe.image)
      }
      if (recipe.imageThumbnailUrl) {
        setExistingThumb(recipe.imageThumbnailUrl)
      }
    })
  }, [id])

  // Revoke object URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  // ── Image handlers ──────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_INPUT_BYTES) {
      toast.error('Image is too large. Please choose a file under 20 MB.')
      e.target.value = ''
      return
    }

    // Revoke previous blob URL if any
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl)
    }

    setPendingFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setImageCleared(false)
    e.target.value = ''
  }

  function handleClearImage() {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl)
    }
    setPendingFile(null)
    setPreviewUrl(null)
    setImageCleared(true)
  }

  // ── Form helpers ────────────────────────────────────────────────────────────

  function validate(): FormErrors {
    const e: FormErrors = {}
    if (!form.name.trim()) e.name = 'Name is required.'
    if (!form.ingredients.some((ing) => ing.name.trim())) {
      e.ingredients = 'Add at least one ingredient.'
    }
    if (!form.instructions.some((step) => step.trim())) {
      e.instructions = 'Add at least one instruction step.'
    }
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    setSaving(true)

    const nutritionEntries: [string, number][] = [
      ['calories', parseFloat(form.nutritionCalories)],
      ['proteinContent', parseFloat(form.nutritionProtein)],
      ['fatContent', parseFloat(form.nutritionFat)],
      ['carbohydrateContent', parseFloat(form.nutritionCarbs)],
      ['fiberContent', parseFloat(form.nutritionFiber)],
    ].filter(([, v]) => !isNaN(v as number) && (v as number) > 0) as [string, number][]
    const nutrition: Record<string, number> | undefined =
      nutritionEntries.length > 0 ? Object.fromEntries(nutritionEntries) : undefined

    // ── Resolve image URL ────────────────────────────────────────────────────
    let imageUrl: string | undefined
    let thumbnailUrl: string | undefined

    const targetRecipeId = isEdit ? id! : crypto.randomUUID()

    if (pendingFile) {
      try {
        if (isSupabaseAvailable() && user) {
          // Upload to Supabase Storage
          const uploaded = await uploadRecipeImage(user.id, targetRecipeId, pendingFile)
          imageUrl = uploaded.url
          thumbnailUrl = uploaded.thumbnailUrl
        } else {
          // Local fallback: encode as data URLs (offline / not signed in)
          imageUrl = await resizeToDataUrl(pendingFile, 1200)
          thumbnailUrl = await resizeToDataUrl(pendingFile, 400)
        }
      } catch (err) {
        console.error('Image upload failed:', err)
        toast.error('Image upload failed — recipe saved without image.')
        // Don't abort the save; just omit the image
      }
    } else if (!imageCleared) {
      // Keep existing image unchanged
      imageUrl = existingImage ?? undefined
      thumbnailUrl = existingThumb ?? undefined
    }
    // If imageCleared and no pendingFile: both remain undefined → image removed

    const data = {
      name: form.name.trim(),
      description: form.description.trim(),
      recipeYield: form.recipeYield.trim() || '1',
      prepTime: minutesToDuration(Math.max(0, parseInt(form.prepTimeMinutes) || 0)),
      cookTime: minutesToDuration(Math.max(0, parseInt(form.cookTimeMinutes) || 0)),
      recipeIngredient: form.ingredients.filter((ing) => ing.name.trim()),
      recipeInstructions: form.instructions
        .filter((s) => s.trim())
        .map((text) => ({ '@type': 'HowToStep' as const, text })),
      keywords: form.keywords
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      nutrition,
      image: imageUrl,
      imageThumbnailUrl: thumbnailUrl,
    }

    try {
      if (isEdit && id) {
        await updateRecipe(id, data)
        // Clean up old storage image if it was replaced or removed
        if (imageCleared && existingImage && isStorageUrl(existingImage) && user) {
          deleteRecipeImages(user.id, id).catch(console.error)
        }
        toast.success('Recipe saved.')
        navigate(`/recipes/${id}`)
      } else {
        await createRecipe(data, targetRecipeId)
        toast.success('Recipe added.')
        navigate(`/recipes/${targetRecipeId}`)
      }
    } catch {
      toast.error('Failed to save recipe. Please try again.')
      setSaving(false)
    }
  }

  // ── Ingredient helpers ──────────────────────────────────────────────────────

  function updateIngredient(index: number, field: keyof Ingredient, value: string | number) {
    setForm((f) => {
      const ingredients = f.ingredients.map((ing, i) =>
        i === index ? { ...ing, [field]: field === 'amount' ? Number(value) : value } : ing
      )
      return { ...f, ingredients }
    })
  }

  function addIngredient() {
    setForm((f) => ({ ...f, ingredients: [...f.ingredients, { name: '', amount: 1, unit: '' }] }))
  }

  function removeIngredient(index: number) {
    setForm((f) => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== index) }))
  }

  // ── Instruction helpers ─────────────────────────────────────────────────────

  function updateInstruction(index: number, value: string) {
    setForm((f) => {
      const instructions = f.instructions.map((step, i) => (i === index ? value : step))
      return { ...f, instructions }
    })
  }

  function addInstruction() {
    setForm((f) => ({ ...f, instructions: [...f.instructions, ''] }))
  }

  function removeInstruction(index: number) {
    setForm((f) => ({ ...f, instructions: f.instructions.filter((_, i) => i !== index) }))
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

  return (
    <div className="p-4 max-w-2xl mx-auto pb-10">
      <Link to={isEdit && id ? `/recipes/${id}` : '/'} className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 inline-block mb-4">
        ← {isEdit ? 'Back to recipe' : 'Recipes'}
      </Link>

      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
        {isEdit ? 'Edit Recipe' : 'New Recipe'}
      </h2>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Spaghetti Bolognese"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="A short description of the dish…"
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
          />
        </div>

        {/* Photo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Photo</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="sr-only"
            aria-label="Upload recipe photo"
          />

          {previewUrl ? (
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700">
              <img
                src={previewUrl}
                alt="Recipe photo preview"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={handleClearImage}
                className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors"
                aria-label="Remove photo"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Camera size={12} strokeWidth={2} />
                Change
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl py-8 flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500 hover:border-green-500 dark:hover:border-green-500 hover:text-green-600 dark:hover:text-green-400 transition-colors"
            >
              <Camera size={24} strokeWidth={1.5} />
              <span className="text-sm">Add a photo</span>
              <span className="text-xs">JPEG, PNG, WebP · up to 20 MB</span>
            </button>
          )}
        </div>

        {/* Times + Servings */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Prep (min)</label>
            <input
              type="number"
              min="0"
              value={form.prepTimeMinutes}
              onChange={(e) => setForm((f) => ({ ...f, prepTimeMinutes: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Cook (min)</label>
            <input
              type="number"
              min="0"
              value={form.cookTimeMinutes}
              onChange={(e) => setForm((f) => ({ ...f, cookTimeMinutes: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Servings</label>
            <input
              type="text"
              value={form.recipeYield}
              onChange={(e) => setForm((f) => ({ ...f, recipeYield: e.target.value }))}
              placeholder="e.g. 4"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>
        </div>

        {/* Keywords */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Keywords</label>
          <input
            type="text"
            value={form.keywords}
            onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
            placeholder="italian, pasta, dinner"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Comma-separated</p>
        </div>

        {/* Nutrition */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            Nutrition <span className="text-xs font-normal text-gray-400">(per serving, optional)</span>
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { field: 'nutritionCalories' as const, label: 'Calories', unit: 'kcal' },
              { field: 'nutritionProtein' as const, label: 'Protein', unit: 'g' },
              { field: 'nutritionFat' as const, label: 'Fat', unit: 'g' },
              { field: 'nutritionCarbs' as const, label: 'Carbs', unit: 'g' },
              { field: 'nutritionFiber' as const, label: 'Fiber', unit: 'g' },
            ].map(({ field, label, unit }) => (
              <div key={field}>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {label} <span className="text-gray-400">({unit})</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form[field]}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Ingredients */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
            Ingredients <span className="text-red-500">*</span>
          </label>
          <div className="space-y-2">
            {form.ingredients.map((ing, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={ing.amount}
                  onChange={(e) => updateIngredient(i, 'amount', e.target.value)}
                  placeholder="Amt"
                  className="w-16 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                />
                <input
                  type="text"
                  value={ing.unit}
                  onChange={(e) => updateIngredient(i, 'unit', e.target.value)}
                  placeholder="unit"
                  className="w-20 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                />
                <input
                  type="text"
                  value={ing.name}
                  onChange={(e) => updateIngredient(i, 'name', e.target.value)}
                  placeholder="ingredient name"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                />
                {form.ingredients.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeIngredient(i)}
                    className="text-gray-400 hover:text-red-400 transition-colors p-1"
                    aria-label="Remove ingredient"
                  >
                    <X size={14} strokeWidth={2} aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {errors.ingredients && (
            <p className="text-red-500 text-xs mt-1">{errors.ingredients}</p>
          )}
          <button
            type="button"
            onClick={addIngredient}
            className="mt-2 text-sm text-green-600 hover:text-green-700 font-medium"
          >
            + Add ingredient
          </button>
        </div>

        {/* Instructions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
            Instructions <span className="text-red-500">*</span>
          </label>
          <div className="space-y-2">
            {form.instructions.map((step, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="mt-2 shrink-0 w-6 h-6 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </span>
                <textarea
                  value={step}
                  onChange={(e) => updateInstruction(i, e.target.value)}
                  placeholder={`Step ${i + 1}…`}
                  rows={2}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                />
                {form.instructions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeInstruction(i)}
                    className="mt-2 text-gray-400 hover:text-red-400 transition-colors p-1"
                    aria-label="Remove step"
                  >
                    <X size={14} strokeWidth={2} aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {errors.instructions && (
            <p className="text-red-500 text-xs mt-1">{errors.instructions}</p>
          )}
          <button
            type="button"
            onClick={addInstruction}
            className="mt-2 text-sm text-green-600 hover:text-green-700 font-medium"
          >
            + Add step
          </button>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Recipe'}
        </button>
      </form>
    </div>
  )
}
