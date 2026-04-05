import type { Recipe, MealPlan, PantryItem, MealType } from '../types'
import { normalizeMealSlot } from '../types'

export interface ScoredRecipe {
  recipe: Recipe
  score: number
  /** Why this recipe was surfaced */
  reason: 'pantry' | 'favorite' | 'random'
  /** Number of recipe ingredients found in pantry */
  pantryMatches: number
}

/**
 * Scores and ranks recipes for the "What should I cook?" suggestion feature.
 *
 * Scoring weights:
 *  - Pantry ingredient match: +3 per matched ingredient (capped at 5 matches)
 *  - Favorite: +4
 *  - Recently cooked (in last N plans): -6 per recent plan it appears in
 *  - Random jitter: ±1 (so ties are broken and the list feels fresh)
 */
export function scoreRecipes(
  recipes: Recipe[],
  pantryItems: PantryItem[],
  recentPlans: MealPlan[],
  _mealType?: MealType
): ScoredRecipe[] {
  if (recipes.length === 0) return []

  // Build a set of normalised pantry item names for fuzzy matching
  const pantryNames = pantryItems.map((p) => p.name.toLowerCase().trim())

  // Count how many recent plans each recipe appears in (recency penalty)
  const recentPlanCount = new Map<string, number>()
  for (const plan of recentPlans) {
    const seenInThisPlan = new Set<string>()
    for (const dayPlan of Object.values(plan.days)) {
      for (const meal of Object.keys(dayPlan) as MealType[]) {
        const rawSlot = dayPlan[meal]
        if (!rawSlot) continue
        for (const { recipeId } of normalizeMealSlot(rawSlot).recipes) {
          if (!seenInThisPlan.has(recipeId)) {
            seenInThisPlan.add(recipeId)
            recentPlanCount.set(recipeId, (recentPlanCount.get(recipeId) ?? 0) + 1)
          }
        }
      }
    }
  }

  const scored: ScoredRecipe[] = []

  for (const recipe of recipes) {
    let score = 0

    // Pantry match: count ingredients that appear in the pantry
    let pantryMatches = 0
    if (pantryNames.length > 0) {
      for (const ingredient of recipe.recipeIngredient) {
        const name = ingredient.name.toLowerCase().trim()
        if (pantryNames.some((p) => name.includes(p) || p.includes(name))) {
          pantryMatches++
        }
      }
      score += Math.min(pantryMatches, 5) * 3
    }

    // Favorite boost
    if (recipe.isFavorite) score += 4

    // Recency penalty
    const timesCooked = recentPlanCount.get(recipe.id) ?? 0
    score -= timesCooked * 6

    // Slight random jitter so repeated opens feel fresh
    score += (Math.random() * 2 - 1)

    // Determine primary reason label for display
    const reason: ScoredRecipe['reason'] =
      pantryMatches > 0 ? 'pantry' : recipe.isFavorite ? 'favorite' : 'random'

    scored.push({ recipe, score, reason, pantryMatches })
  }

  return scored.sort((a, b) => b.score - a.score)
}

/**
 * Returns the top N suggestions for a given meal type.
 * If mealType is undefined, uses all recipes.
 */
export function getSuggestions(
  recipes: Recipe[],
  pantryItems: PantryItem[],
  recentPlans: MealPlan[],
  mealType: MealType | undefined,
  count = 5
): ScoredRecipe[] {
  return scoreRecipes(recipes, pantryItems, recentPlans, mealType).slice(0, count)
}
