import { db } from './db'
import type { Recipe, MealPlan, ShoppingList } from '../types'

export type SearchResultType = 'recipe' | 'meal-plan' | 'shopping-list'

export interface SearchResult {
  type: SearchResultType
  id: string
  title: string
  subtitle?: string
  href: string
}

function formatWeekDate(weekStartDate: string): string {
  const date = new Date(weekStartDate + 'T00:00:00')
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function recipeMatchesQuery(recipe: Recipe, lower: string): boolean {
  if (recipe.name.toLowerCase().includes(lower)) return true
  if (recipe.description?.toLowerCase().includes(lower)) return true
  if (recipe.keywords.some((k) => k.toLowerCase().includes(lower))) return true
  if (recipe.recipeIngredient.some((ing) => ing.name.toLowerCase().includes(lower))) return true
  return false
}

function mealPlanMatchesQuery(plan: MealPlan, lower: string): boolean {
  if (plan.weekStartDate.includes(lower)) return true
  const formatted = formatWeekDate(plan.weekStartDate).toLowerCase()
  if (formatted.includes(lower)) return true
  return false
}

function shoppingListMatchesQuery(list: ShoppingList, lower: string): boolean {
  if (list.name.toLowerCase().includes(lower)) return true
  if (list.items.some((item) => item.name.toLowerCase().includes(lower))) return true
  return false
}

export interface SearchResults {
  recipes: SearchResult[]
  mealPlans: SearchResult[]
  shoppingLists: SearchResult[]
}

export async function searchAll(query: string): Promise<SearchResults> {
  const lower = query.trim().toLowerCase()
  if (!lower) return { recipes: [], mealPlans: [], shoppingLists: [] }

  const [recipes, mealPlans, shoppingLists] = await Promise.all([
    db.recipes.toArray(),
    db.mealPlans.toArray(),
    db.shoppingLists.toArray(),
  ])

  const matchedRecipes: SearchResult[] = recipes
    .filter((r) => recipeMatchesQuery(r, lower))
    .slice(0, 5)
    .map((r) => ({
      type: 'recipe',
      id: r.id,
      title: r.name,
      subtitle: r.keywords.slice(0, 2).join(', ') || undefined,
      href: `/recipes/${r.id}`,
    }))

  const matchedPlans: SearchResult[] = mealPlans
    .filter((p) => mealPlanMatchesQuery(p, lower))
    .sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate))
    .slice(0, 3)
    .map((p) => ({
      type: 'meal-plan',
      id: p.id,
      title: `Week of ${formatWeekDate(p.weekStartDate)}`,
      href: `/meal-plan`,
    }))

  const matchedLists: SearchResult[] = shoppingLists
    .filter((s) => shoppingListMatchesQuery(s, lower))
    .slice(0, 3)
    .map((s) => ({
      type: 'shopping-list',
      id: s.id,
      title: s.name,
      subtitle: `${s.items.length} item${s.items.length !== 1 ? 's' : ''}`,
      href: `/shopping`,
    }))

  return {
    recipes: matchedRecipes,
    mealPlans: matchedPlans,
    shoppingLists: matchedLists,
  }
}
