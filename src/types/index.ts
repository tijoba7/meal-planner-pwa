export interface Ingredient {
  name: string
  amount: number
  unit: string
}

export interface Recipe {
  id: string
  title: string
  description: string
  servings: number
  prepTimeMinutes: number
  cookTimeMinutes: number
  ingredients: Ingredient[]
  instructions: string[]
  tags: string[]
  imageUrl?: string
  createdAt: string
  updatedAt: string
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
