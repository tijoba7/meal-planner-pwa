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

export type WeekPlan = {
  weekStartDate: string // ISO date string (Monday)
  days: Record<string, DayPlan> // key: ISO date string
}

export interface ShoppingItem {
  name: string
  amount: number
  unit: string
  checked: boolean
}
