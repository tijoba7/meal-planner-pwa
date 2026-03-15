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
  dateCreated: string
  dateModified: string
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

export interface MealSlot {
  recipeId: string
  servings: number
}

export type DayPlan = Partial<Record<MealType, MealSlot>>

export interface MealPlan {
  id: string
  weekStartDate: string // ISO date string (Monday)
  days: Record<string, DayPlan> // key: ISO date string
  createdAt: string
  updatedAt: string
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
