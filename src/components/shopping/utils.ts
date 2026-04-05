import { ALL_CATEGORIES } from '../../lib/ingredientCategories'
import type { ShoppingItem, IngredientCategory } from '../../types'
import type { ShoppingList } from '../../types'
import type { SuggestionEntry } from './types'
import type { Recipe } from '../../types'

export function groupByCategory(items: ShoppingItem[]): Array<[IngredientCategory, ShoppingItem[]]> {
  const map = new Map<IngredientCategory, ShoppingItem[]>()
  for (const cat of ALL_CATEGORIES) map.set(cat, [])
  for (const item of items) {
    const cat = item.category ?? 'Other'
    map.get(cat)!.push(item)
  }
  return Array.from(map.entries()).filter(([, list]) => list.length > 0)
}

export function buildSuggestions(lists: ShoppingList[], recipes: Recipe[]): SuggestionEntry[] {
  const counts = new Map<string, { unit: string; count: number }>()
  for (const list of lists) {
    for (const item of list.items) {
      const key = item.name.toLowerCase()
      const existing = counts.get(key)
      if (existing) existing.count++
      else counts.set(key, { unit: item.unit || '', count: 1 })
    }
  }
  for (const recipe of recipes) {
    for (const ing of recipe.recipeIngredient) {
      const key = ing.name.toLowerCase()
      if (!counts.has(key)) counts.set(key, { unit: ing.unit || '', count: 0 })
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .map(([name, { unit }]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), unit }))
}
