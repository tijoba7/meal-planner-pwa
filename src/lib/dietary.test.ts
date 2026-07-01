import { describe, it, expect, beforeEach } from 'vitest'
import {
  detectAllergenIngredients,
  getDietaryPrefs,
  saveDietaryPrefs,
  DIETARY_PREFERENCES,
  ALLERGEN_INGREDIENT_KEYWORDS,
} from './dietary'

describe('detectAllergenIngredients', () => {
  it('returns an empty set when no diets are active', () => {
    expect(detectAllergenIngredients(['wheat flour', 'milk'], []).size).toBe(0)
  })

  it('flags ingredients that match an active diet keyword', () => {
    const flagged = detectAllergenIngredients(
      ['whole wheat flour', 'olive oil', 'pasta'],
      ['gluten-free']
    )
    expect(flagged.has(0)).toBe(true)
    expect(flagged.has(1)).toBe(false)
    expect(flagged.has(2)).toBe(true)
  })

  it('is case-insensitive', () => {
    const flagged = detectAllergenIngredients(['WHEAT Bread'], ['gluten-free'])
    expect(flagged.has(0)).toBe(true)
  })

  it('flags an ingredient once even when multiple diets match', () => {
    const flagged = detectAllergenIngredients(
      ['wheat flour'],
      ['gluten-free', 'gluten-free']
    )
    expect(flagged.size).toBe(1)
  })

  it('ignores unknown diet ids', () => {
    expect(detectAllergenIngredients(['wheat'], ['made-up-diet']).size).toBe(0)
  })

  it('returns no flags when nothing matches', () => {
    expect(
      detectAllergenIngredients(['carrot', 'onion'], ['gluten-free']).size
    ).toBe(0)
  })
})

describe('DIETARY_PREFERENCES and keyword map', () => {
  it('exposes a non-empty, uniquely-keyed preference list', () => {
    expect(DIETARY_PREFERENCES.length).toBeGreaterThan(0)
    const ids = DIETARY_PREFERENCES.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('only defines allergen keywords for known preference ids', () => {
    const knownIds = new Set(DIETARY_PREFERENCES.map((p) => p.id))
    for (const id of Object.keys(ALLERGEN_INGREDIENT_KEYWORDS)) {
      expect(knownIds.has(id)).toBe(true)
    }
  })
})

describe('dietary preference persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns an empty array when nothing is stored', () => {
    expect(getDietaryPrefs()).toEqual([])
  })

  it('round-trips saved preferences', () => {
    saveDietaryPrefs(['vegan', 'gluten-free'])
    expect(getDietaryPrefs()).toEqual(['vegan', 'gluten-free'])
  })

  it('returns an empty array when stored value is malformed JSON', () => {
    localStorage.setItem('braisely-dietary-prefs', '{not json')
    expect(getDietaryPrefs()).toEqual([])
  })

  it('returns an empty array when stored value is not an array', () => {
    localStorage.setItem('braisely-dietary-prefs', '{"a":1}')
    expect(getDietaryPrefs()).toEqual([])
  })
})
