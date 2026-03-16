import { describe, it, expect } from 'vitest'
import { calculateNutrition, findNutritionEntry, nutritionResultToRecord } from './nutritionCalculator'
import type { Ingredient } from '../types'

// ─── findNutritionEntry ───────────────────────────────────────────────────────

describe('findNutritionEntry', () => {
  it('returns null for unknown ingredients', () => {
    expect(findNutritionEntry('unobtainium')).toBeNull()
    expect(findNutritionEntry('')).toBeNull()
  })

  it('matches exact alias', () => {
    const entry = findNutritionEntry('chicken breast')
    expect(entry).not.toBeNull()
    expect(entry!.name).toBe('Chicken breast')
  })

  it('matches when alias is a substring of the ingredient name', () => {
    const entry = findNutritionEntry('boneless chicken thigh')
    expect(entry).not.toBeNull()
    expect(entry!.name).toBe('Chicken thigh')
  })

  it('prefers longer alias (chicken breast over chicken)', () => {
    const entry = findNutritionEntry('chicken breast')
    expect(entry!.name).toBe('Chicken breast')
  })

  it('matches generic fallback when no specific entry', () => {
    const entry = findNutritionEntry('roasted chicken')
    expect(entry).not.toBeNull()
    // Should match "chicken" alias from generic entry
    expect(entry!.aliases).toContain('chicken')
  })

  it('is case-insensitive', () => {
    expect(findNutritionEntry('GARLIC')).not.toBeNull()
    expect(findNutritionEntry('Olive Oil')).not.toBeNull()
  })

  it('matches plural forms', () => {
    expect(findNutritionEntry('eggs')).not.toBeNull()
    expect(findNutritionEntry('carrots')).not.toBeNull()
  })
})

// ─── calculateNutrition ───────────────────────────────────────────────────────

describe('calculateNutrition', () => {
  it('returns null for empty ingredient list', () => {
    expect(calculateNutrition([], 4)).toBeNull()
  })

  it('returns null when no ingredients match the database', () => {
    const ingredients: Ingredient[] = [
      { name: 'unobtainium powder', amount: 100, unit: 'g' },
    ]
    expect(calculateNutrition(ingredients, 4)).toBeNull()
  })

  it('returns null for zero servings', () => {
    const ingredients: Ingredient[] = [{ name: 'chicken breast', amount: 100, unit: 'g' }]
    expect(calculateNutrition(ingredients, 0)).toBeNull()
  })

  it('calculates nutrition for a single weight-unit ingredient', () => {
    // 100g chicken breast = 165 kcal, 31g protein, 0g carbs, 3.6g fat, 0 fiber
    const ingredients: Ingredient[] = [
      { name: 'chicken breast', amount: 100, unit: 'g' },
    ]
    const result = calculateNutrition(ingredients, 1)
    expect(result).not.toBeNull()
    expect(result!.calories).toBe(165)
    expect(result!.protein).toBe(31)
    expect(result!.carbs).toBe(0)
    expect(result!.fat).toBe(3.6)
    expect(result!.matchedIngredients).toBe(1)
    expect(result!.totalIngredients).toBe(1)
  })

  it('divides totals by number of servings', () => {
    // 200g chicken breast total, 2 servings → 165 kcal / serving
    const ingredients: Ingredient[] = [
      { name: 'chicken breast', amount: 200, unit: 'g' },
    ]
    const result = calculateNutrition(ingredients, 2)
    expect(result!.calories).toBe(165)
  })

  it('converts oz to grams correctly', () => {
    // 1 oz chicken = 28.3495g → ~46.8 kcal → rounds to 47
    const ingredients: Ingredient[] = [
      { name: 'chicken breast', amount: 1, unit: 'oz' },
    ]
    const result = calculateNutrition(ingredients, 1)
    expect(result).not.toBeNull()
    expect(result!.calories).toBeGreaterThan(40)
    expect(result!.calories).toBeLessThan(55)
  })

  it('converts cups to grams using density for flour', () => {
    // 1 cup flour: 240ml * 0.6g/ml = 144g → 144 * (364/100) = 524.16 kcal → 524
    const ingredients: Ingredient[] = [
      { name: 'all-purpose flour', amount: 1, unit: 'cup' },
    ]
    const result = calculateNutrition(ingredients, 1)
    expect(result).not.toBeNull()
    // 144g * 3.64 kcal/g ≈ 524
    expect(result!.calories).toBeGreaterThan(500)
    expect(result!.calories).toBeLessThan(550)
  })

  it('converts tbsp to grams for olive oil', () => {
    // 1 tbsp oil: 14.787ml * 0.91g/ml = 13.46g → 13.46 * 8.84 ≈ 119 kcal
    const ingredients: Ingredient[] = [
      { name: 'olive oil', amount: 1, unit: 'tbsp' },
    ]
    const result = calculateNutrition(ingredients, 1)
    expect(result).not.toBeNull()
    expect(result!.calories).toBeGreaterThan(100)
    expect(result!.calories).toBeLessThan(135)
  })

  it('uses typicalWeightG for count units (eggs)', () => {
    // 2 eggs, no unit: 2 * 50g = 100g → 100 * 1.55 = 155 kcal
    const ingredients: Ingredient[] = [
      { name: 'eggs', amount: 2, unit: '' },
    ]
    const result = calculateNutrition(ingredients, 1)
    expect(result).not.toBeNull()
    expect(result!.calories).toBe(155)
  })

  it('uses typicalWeightG for "clove" unit (garlic)', () => {
    // 3 cloves garlic: 3 * 3g = 9g → 9 * 1.49 ≈ 13 kcal
    const ingredients: Ingredient[] = [
      { name: 'garlic', amount: 3, unit: 'clove' },
    ]
    const result = calculateNutrition(ingredients, 1)
    expect(result).not.toBeNull()
    expect(result!.calories).toBeGreaterThan(10)
    expect(result!.calories).toBeLessThan(20)
  })

  it('skips ingredients with unknown units and no typicalWeightG', () => {
    const ingredients: Ingredient[] = [
      { name: 'chicken breast', amount: 200, unit: 'g' },
      { name: 'some exotic spice', amount: 1, unit: 'pinch' },
    ]
    const result = calculateNutrition(ingredients, 1)
    expect(result).not.toBeNull()
    expect(result!.matchedIngredients).toBe(1)
    expect(result!.totalIngredients).toBe(2)
  })

  it('handles lb unit correctly', () => {
    // 1 lb chicken = 453.592g → 453.592 * 1.65 ≈ 748 kcal
    const ingredients: Ingredient[] = [
      { name: 'chicken breast', amount: 1, unit: 'lb' },
    ]
    const result = calculateNutrition(ingredients, 1)
    expect(result).not.toBeNull()
    expect(result!.calories).toBeGreaterThan(700)
    expect(result!.calories).toBeLessThan(800)
  })

  it('sums multiple ingredients', () => {
    // 100g chicken (165 kcal) + 1 tbsp olive oil (~119 kcal) ≈ 284 kcal
    const ingredients: Ingredient[] = [
      { name: 'chicken breast', amount: 100, unit: 'g' },
      { name: 'olive oil', amount: 1, unit: 'tbsp' },
    ]
    const result = calculateNutrition(ingredients, 1)
    expect(result).not.toBeNull()
    expect(result!.matchedIngredients).toBe(2)
    expect(result!.calories).toBeGreaterThan(270)
    expect(result!.calories).toBeLessThan(300)
  })

  it('tracks matched vs total ingredient counts', () => {
    const ingredients: Ingredient[] = [
      { name: 'chicken breast', amount: 200, unit: 'g' },
      { name: 'salt', amount: 1, unit: 'tsp' },
      { name: 'mystery ingredient xyz', amount: 1, unit: 'cup' },
    ]
    const result = calculateNutrition(ingredients, 1)
    expect(result).not.toBeNull()
    expect(result!.totalIngredients).toBe(3)
    expect(result!.matchedIngredients).toBe(2)
  })

  it('ignores ingredients with empty names', () => {
    const ingredients: Ingredient[] = [
      { name: '', amount: 100, unit: 'g' },
      { name: 'chicken breast', amount: 100, unit: 'g' },
    ]
    const result = calculateNutrition(ingredients, 1)
    expect(result!.totalIngredients).toBe(1)
  })

  it('handles kg unit', () => {
    const gResult = calculateNutrition([{ name: 'chicken breast', amount: 1000, unit: 'g' }], 1)
    const kgResult = calculateNutrition([{ name: 'chicken breast', amount: 1, unit: 'kg' }], 1)
    expect(gResult!.calories).toBe(kgResult!.calories)
  })
})

// ─── nutritionResultToRecord ─────────────────────────────────────────────────

describe('nutritionResultToRecord', () => {
  it('converts result to the Recipe.nutrition record format', () => {
    const result = calculateNutrition(
      [{ name: 'chicken breast', amount: 100, unit: 'g' }],
      1,
    )!
    const record = nutritionResultToRecord(result)
    expect(record).toHaveProperty('calories', 165)
    expect(record).toHaveProperty('proteinContent', 31)
    expect(record).toHaveProperty('carbohydrateContent', 0)
    expect(record).toHaveProperty('fatContent', 3.6)
    expect(record).toHaveProperty('fiberContent', 0)
    // sodium is intentionally excluded from the recipe record (not displayed)
    expect(record).not.toHaveProperty('sodium')
  })
})
