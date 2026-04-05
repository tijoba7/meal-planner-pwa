import type { Ingredient } from '../../types'

export interface RecipeFormValues {
  name: string
  description: string
  recipeYield: string
  prepTimeMinutes: string
  cookTimeMinutes: string
  ingredients: Ingredient[]
  instructions: { text: string }[]
  keywords: string[]
  suitableForDiet: string[]
  recipeCategory: string
  recipeCuisine: string
  nutritionCalories: string
  nutritionProtein: string
  nutritionFat: string
  nutritionCarbs: string
  nutritionFiber: string
}
