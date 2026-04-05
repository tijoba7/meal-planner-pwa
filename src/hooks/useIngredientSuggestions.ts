import { useMemo } from 'react'
import { useRecipes } from './useRecipes'
import type { IngredientSuggestion } from '../components/recipe/IngredientNameInput'

export type { IngredientSuggestion }

export function useIngredientSuggestions(): IngredientSuggestion[] {
  const { data: recipes = [] } = useRecipes()
  return useMemo(() => {
    const acc = new Map<string, { forms: Map<string, number>; units: Map<string, number> }>()
    for (const recipe of recipes) {
      for (const ing of recipe.recipeIngredient) {
        const key = ing.name.trim().toLowerCase()
        if (!key) continue
        if (!acc.has(key)) acc.set(key, { forms: new Map(), units: new Map() })
        const entry = acc.get(key)!
        const display = ing.name.trim()
        entry.forms.set(display, (entry.forms.get(display) ?? 0) + 1)
        if (ing.unit.trim()) {
          const u = ing.unit.trim()
          entry.units.set(u, (entry.units.get(u) ?? 0) + 1)
        }
      }
    }
    return Array.from(acc.entries()).map(([, entry]) => {
      const name = [...entry.forms.entries()].sort((a, b) => b[1] - a[1])[0][0]
      const unit = [...entry.units.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
      return { name, unit }
    })
  }, [recipes])
}
