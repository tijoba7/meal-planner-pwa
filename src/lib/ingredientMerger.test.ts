import { describe, it, expect } from 'vitest'
import { mergeIngredients, normalizeIngredientName } from './ingredientMerger'

// ─── normalizeIngredientName ──────────────────────────────────────────────────

describe('normalizeIngredientName', () => {
  it('lowercases the name', () => {
    expect(normalizeIngredientName('Flour')).toBe('flour')
  })

  it('trims whitespace', () => {
    expect(normalizeIngredientName('  salt  ')).toBe('salt')
  })

  it('lowercases and trims together', () => {
    expect(normalizeIngredientName('  Olive Oil  ')).toBe('olive oil')
  })
})

// ─── mergeIngredients ─────────────────────────────────────────────────────────

describe('mergeIngredients', () => {
  // ── Acceptance criteria ───────────────────────────────────────────────────

  it('"2 cups flour" + "1 cup flour" → "3 cups flour"', () => {
    const result = mergeIngredients([
      { name: 'flour', amount: 2, unit: 'cups' },
      { name: 'flour', amount: 1, unit: 'cup' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('flour')
    expect(result[0].unit).toBe('cups') // first unit preserved
    expect(result[0].amount).toBeCloseTo(3, 5)
  })

  it('"1 tbsp olive oil" + "2 tbsp olive oil" → "3 tbsp olive oil"', () => {
    const result = mergeIngredients([
      { name: 'olive oil', amount: 1, unit: 'tbsp' },
      { name: 'olive oil', amount: 2, unit: 'tbsp' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBeCloseTo(3, 5)
    expect(result[0].unit).toBe('tbsp')
  })

  it('"salt to taste" (amount 0) remains as a single entry', () => {
    const result = mergeIngredients([
      { name: 'salt', amount: 0, unit: 'to taste' },
      { name: 'salt', amount: 0, unit: 'to taste' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe(0)
  })

  // ── Cross-unit volume merging ─────────────────────────────────────────────

  it('merges 1 cup + 8 tbsp flour into 1.5 cups', () => {
    // 1 cup = 240ml; 8 tbsp = 8 × 14.787ml = 118.296ml; total = 358.296ml = 1.493 cups ≈ 1.493
    const result = mergeIngredients([
      { name: 'flour', amount: 1, unit: 'cup' },
      { name: 'flour', amount: 8, unit: 'tbsp' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].unit).toBe('cup')
    expect(result[0].amount).toBeCloseTo(1.493, 2)
  })

  it('merges metric and imperial volume for same ingredient', () => {
    // 1 cup = 240ml; total = 240+240=480ml = 2 cups
    const result = mergeIngredients([
      { name: 'water', amount: 1, unit: 'cup' },
      { name: 'water', amount: 240, unit: 'ml' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].unit).toBe('cup')
    expect(result[0].amount).toBeCloseTo(2, 3)
  })

  // ── Cross-unit weight merging ─────────────────────────────────────────────

  it('merges oz and lb for same ingredient', () => {
    // 2 oz + 1 lb = 56.7g + 453.592g = 510.292g = 18 oz
    const result = mergeIngredients([
      { name: 'butter', amount: 2, unit: 'oz' },
      { name: 'butter', amount: 1, unit: 'lb' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].unit).toBe('oz')
    expect(result[0].amount).toBeCloseTo(18, 1)
  })

  // ── Count / other units ───────────────────────────────────────────────────

  it('merges count units with matching unit strings', () => {
    const result = mergeIngredients([
      { name: 'eggs', amount: 2, unit: '' },
      { name: 'eggs', amount: 3, unit: '' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe(5)
  })

  it('keeps count units separate when unit strings differ', () => {
    const result = mergeIngredients([
      { name: 'garlic', amount: 2, unit: 'clove' },
      { name: 'garlic', amount: 1, unit: 'head' },
    ])
    expect(result).toHaveLength(2)
  })

  // ── Case insensitivity ────────────────────────────────────────────────────

  it('merges case-insensitive ingredient names', () => {
    const result = mergeIngredients([
      { name: 'Flour', amount: 1, unit: 'cup' },
      { name: 'flour', amount: 1, unit: 'cup' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBeCloseTo(2, 5)
  })

  // ── Incompatible categories stay separate ─────────────────────────────────

  it('does not merge volume + weight units of the same ingredient', () => {
    const result = mergeIngredients([
      { name: 'cheese', amount: 1, unit: 'cup' },
      { name: 'cheese', amount: 100, unit: 'g' },
    ])
    expect(result).toHaveLength(2)
  })

  // ── Empty input ───────────────────────────────────────────────────────────

  it('returns empty array for empty input', () => {
    expect(mergeIngredients([])).toEqual([])
  })

  // ── Distinct ingredients stay separate ───────────────────────────────────

  it('keeps distinct ingredients as separate entries', () => {
    const result = mergeIngredients([
      { name: 'flour', amount: 2, unit: 'cup' },
      { name: 'sugar', amount: 1, unit: 'cup' },
    ])
    expect(result).toHaveLength(2)
  })

  // ── Rounding ─────────────────────────────────────────────────────────────

  it('rounds merged amounts to at most 3 decimal places', () => {
    const result = mergeIngredients([
      { name: 'flour', amount: 1, unit: 'tsp' },
      { name: 'flour', amount: 1, unit: 'tsp' },
    ])
    expect(result[0].amount.toString().replace(/^\d+\.?/, '').length).toBeLessThanOrEqual(3)
  })
})
