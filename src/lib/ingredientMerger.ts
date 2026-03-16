// ─── Smart ingredient merging ─────────────────────────────────────────────────
//
// Combines duplicate ingredients from meal-plan shopping lists.
// Volume units (cup, tbsp, tsp, ml, …) are normalised to ml before summing,
// then converted back to the display unit of the first occurrence.
// Weight units (oz, lb, g, kg, …) are normalised to grams similarly.
// Count/other units are merged only when the unit string matches exactly.
// Zero-amount items ("to taste", "as needed") are deduplicated but never summed.

import type { Ingredient } from '../types'
import { volumeToMl, weightToG, mlToDisplayUnit, gToDisplayUnit } from './units'

// ─── Internal types ───────────────────────────────────────────────────────────

interface MergeEntry {
  name: string
  unit: string
  rawAmount: number  // count/other units
  mlBase?: number    // accumulated volume (ml)
  gBase?: number     // accumulated weight (grams)
}

// ─── Name normalisation ───────────────────────────────────────────────────────

/**
 * Return a canonical key for matching ingredient names.
 * Currently: lowercase + trim (case-insensitive dedup).
 */
export function normalizeIngredientName(name: string): string {
  return name.toLowerCase().trim()
}

// ─── Merge function ───────────────────────────────────────────────────────────

/**
 * Merge an array of structured ingredients, summing amounts when compatible.
 *
 * Rules:
 * - Volume units → normalise to ml, sum, convert back to the first unit seen.
 * - Weight units → normalise to grams, sum, convert back to the first unit seen.
 * - Count/other  → merge only when the unit string matches exactly.
 * - amount === 0 → deduplicated by (name + unit) but never summed.
 *
 * The display unit is taken from the *first* occurrence of each ingredient group.
 */
export function mergeIngredients(ingredients: Ingredient[]): Ingredient[] {
  const map = new Map<string, MergeEntry>()

  for (const ing of ingredients) {
    const normalName = normalizeIngredientName(ing.name)

    // Zero-amount items ("to taste", "as needed") — dedup but never sum
    if (!ing.amount) {
      const key = `${normalName}|noqty|${ing.unit.toLowerCase().trim()}`
      if (!map.has(key)) {
        map.set(key, { name: ing.name, unit: ing.unit, rawAmount: 0 })
      }
      continue
    }

    const ml = volumeToMl(ing.amount, ing.unit)
    const g = weightToG(ing.amount, ing.unit)

    if (ml !== null) {
      const key = `${normalName}|vol`
      const existing = map.get(key)
      if (existing) {
        existing.mlBase = (existing.mlBase ?? 0) + ml
      } else {
        map.set(key, { name: ing.name, unit: ing.unit, rawAmount: 0, mlBase: ml })
      }
    } else if (g !== null) {
      const key = `${normalName}|wt`
      const existing = map.get(key)
      if (existing) {
        existing.gBase = (existing.gBase ?? 0) + g
      } else {
        map.set(key, { name: ing.name, unit: ing.unit, rawAmount: 0, gBase: g })
      }
    } else {
      // Count or unknown unit — only merge when unit matches exactly
      const key = `${normalName}|${ing.unit.toLowerCase().trim()}`
      const existing = map.get(key)
      if (existing) {
        existing.rawAmount += ing.amount
      } else {
        map.set(key, { name: ing.name, unit: ing.unit, rawAmount: ing.amount })
      }
    }
  }

  // Convert base units back to display units
  const result: Ingredient[] = []
  for (const entry of map.values()) {
    if (entry.mlBase !== undefined) {
      const amount = mlToDisplayUnit(entry.mlBase, entry.unit)
      result.push({ name: entry.name, amount: Math.round(amount * 1000) / 1000, unit: entry.unit })
    } else if (entry.gBase !== undefined) {
      const amount = gToDisplayUnit(entry.gBase, entry.unit)
      result.push({ name: entry.name, amount: Math.round(amount * 1000) / 1000, unit: entry.unit })
    } else {
      result.push({ name: entry.name, amount: entry.rawAmount, unit: entry.unit })
    }
  }

  return result
}
