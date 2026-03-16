export interface Ingredient {
  name: string
  amount: number
  unit: string
}

export interface HowToStep {
  '@type': 'HowToStep'
  text: string
}

export interface Recipe {
  id: string
  name: string
  description: string
  recipeYield: string
  prepTime: string // ISO 8601 duration, e.g. "PT15M"
  cookTime: string // ISO 8601 duration, e.g. "PT45M"
  recipeIngredient: Ingredient[]
  recipeInstructions: HowToStep[]
  keywords: string[]
  image?: string
  imageThumbnailUrl?: string
  dateCreated: string
  dateModified: string
  isFavorite?: boolean
  // Optional Schema.org fields (no UI yet)
  author?: string
  url?: string
  recipeCategory?: string
  recipeCuisine?: string
  cookingMethod?: string
  totalTime?: string
  suitableForDiet?: string[]
  nutrition?: Record<string, string | number>
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface MealRecipe {
  recipeId: string
  servings: number
}

export interface MealSlot {
  recipes: MealRecipe[]
}

/** Normalize a slot that may have been written in the old single-recipe format. */
export function normalizeMealSlot(slot: MealSlot | Record<string, unknown>): MealSlot {
  if ('recipeId' in slot && !Array.isArray((slot as unknown as MealSlot).recipes)) {
    return { recipes: [{ recipeId: slot['recipeId'] as string, servings: (slot['servings'] as number) ?? 2 }] }
  }
  return slot as unknown as MealSlot
}

export type DayPlan = Partial<Record<MealType, MealSlot>>

export interface MealPlan {
  id: string
  weekStartDate: string // ISO date string (Monday)
  days: Record<string, DayPlan> // key: ISO date string
  createdAt: string
  updatedAt: string
  /** Set when this plan is shared with a household; absent for personal plans. */
  householdId?: string
}

export interface ShoppingItem {
  id: string
  name: string
  amount: number
  unit: string
  checked: boolean
}

export interface ShoppingList {
  id: string
  name: string
  mealPlanId?: string
  items: ShoppingItem[]
  createdAt: string
  updatedAt: string
}

export interface MealPlanTemplate {
  id: string
  name: string
  /** Days keyed by offset from Monday: "0" = Mon, "1" = Tue, …, "6" = Sun */
  days: Record<string, DayPlan>
  createdAt: string
  updatedAt: string
}
