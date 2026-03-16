import type { Ingredient } from '../types'
import { NUTRITION_DB, type NutritionEntry } from './nutritionData'

// ─── Unit → grams conversion tables ─────────────────────────────────────────

/** Volume units → ml */
const VOL_TO_ML: Record<string, number> = {
  cup: 240, cups: 240, c: 240,
  tbsp: 14.787, tablespoon: 14.787, tablespoons: 14.787, tbs: 14.787,
  tsp: 4.929, teaspoon: 4.929, teaspoons: 4.929,
  'fl oz': 29.574, floz: 29.574,
  pint: 473.176, pints: 473.176, pt: 473.176, pts: 473.176,
  quart: 946.353, quarts: 946.353, qt: 946.353, qts: 946.353,
  gallon: 3785.41, gallons: 3785.41, gal: 3785.41,
  ml: 1, milliliter: 1, milliliters: 1, millilitre: 1, millilitres: 1,
  l: 1000, liter: 1000, liters: 1000, litre: 1000, litres: 1000,
  dl: 100, cl: 10,
}

/** Weight units → grams */
const WT_TO_G: Record<string, number> = {
  g: 1, gram: 1, grams: 1, gramme: 1, grammes: 1,
  kg: 1000, kilogram: 1000, kilograms: 1000, kilogramme: 1000, kilogrammes: 1000,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
  lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592,
  mg: 0.001,
}

/**
 * Count-like units — weight comes from `typicalWeightG` on the nutrition entry.
 * Empty string covers bare-count ingredients like "3 eggs" with no unit.
 */
const COUNT_UNITS = new Set([
  '', 'whole', 'large', 'medium', 'small', 'piece', 'pieces',
  'clove', 'cloves', 'can', 'cans', 'stalk', 'stalks',
  'bunch', 'bunches', 'sprig', 'sprigs', 'slice', 'slices',
  'head', 'heads', 'ear', 'ears', 'package', 'packages', 'pkg',
  'stick', 'sticks', 'fillet', 'fillets', 'breast', 'breasts',
  'thigh', 'thighs', 'leg', 'legs', 'strip', 'strips',
  'rasher', 'rashers', 'leaf', 'leaves',
])

// ─── Public result type ───────────────────────────────────────────────────────

export interface NutritionResult {
  /** kcal per serving */
  calories: number
  /** g per serving */
  protein: number
  /** g per serving */
  carbs: number
  /** g per serving */
  fat: number
  /** g per serving */
  fiber: number
  /** mg per serving */
  sodium: number
  /** Number of ingredients successfully matched to the database */
  matchedIngredients: number
  /** Total ingredients with a non-empty name */
  totalIngredients: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert ingredient amount + unit to grams.
 * Returns null when the unit is not recognised and no typical weight is available.
 */
function toGrams(amount: number, unit: string, entry: NutritionEntry): number | null {
  if (amount <= 0) return null
  const key = unit.toLowerCase().trim()

  if (key in WT_TO_G) {
    return amount * WT_TO_G[key]
  }

  if (key in VOL_TO_ML) {
    const ml = amount * VOL_TO_ML[key]
    return ml * (entry.densityGml ?? 1.0)
  }

  if (COUNT_UNITS.has(key)) {
    if (entry.typicalWeightG != null) {
      return amount * entry.typicalWeightG
    }
    return null
  }

  return null
}

/**
 * Find the best-matching nutrition entry for an ingredient name.
 * Uses longest-alias-match to prefer "chicken breast" over "chicken".
 */
export function findNutritionEntry(name: string): NutritionEntry | null {
  const lower = name.toLowerCase()
  let best: NutritionEntry | null = null
  let bestLen = 0

  for (const entry of NUTRITION_DB) {
    for (const alias of entry.aliases) {
      if (alias.length > bestLen && lower.includes(alias)) {
        best = entry
        bestLen = alias.length
      }
    }
  }

  return best
}

// ─── Main calculation ─────────────────────────────────────────────────────────

/**
 * Calculate per-serving nutrition totals from a list of ingredients.
 *
 * - Manual nutrition data on the recipe takes precedence — callers should
 *   check `recipe.nutrition` before calling this.
 * - Returns null when no ingredients could be matched.
 */
export function calculateNutrition(
  ingredients: Ingredient[],
  servings: number,
): NutritionResult | null {
  if (ingredients.length === 0 || servings <= 0) return null

  let calories = 0
  let protein = 0
  let carbs = 0
  let fat = 0
  let fiber = 0
  let sodium = 0
  let matched = 0

  for (const ing of ingredients) {
    if (!ing.name) continue
    const entry = findNutritionEntry(ing.name)
    if (!entry) continue

    const grams = toGrams(ing.amount, ing.unit, entry)
    if (grams === null || grams <= 0) continue

    const ratio = grams / 100
    calories += entry.per100g.calories * ratio
    protein += entry.per100g.protein * ratio
    carbs += entry.per100g.carbs * ratio
    fat += entry.per100g.fat * ratio
    fiber += entry.per100g.fiber * ratio
    sodium += entry.per100g.sodium * ratio
    matched++
  }

  if (matched === 0) return null

  const s = Math.max(1, servings)
  const totalIngredients = ingredients.filter((i) => i.name).length

  return {
    calories: Math.round(calories / s),
    protein: Math.round((protein / s) * 10) / 10,
    carbs: Math.round((carbs / s) * 10) / 10,
    fat: Math.round((fat / s) * 10) / 10,
    fiber: Math.round((fiber / s) * 10) / 10,
    sodium: Math.round(sodium / s),
    matchedIngredients: matched,
    totalIngredients,
  }
}

/**
 * Convert a NutritionResult to the `Recipe.nutrition` record format
 * used by RecipeDetailPage.
 */
export function nutritionResultToRecord(result: NutritionResult): Record<string, number> {
  return {
    calories: result.calories,
    proteinContent: result.protein,
    carbohydrateContent: result.carbs,
    fatContent: result.fat,
    fiberContent: result.fiber,
  }
}
