import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  validateImportUrl,
  checkImportRateLimit,
  formatRetryAfter,
  sanitizeText,
  sanitizeRecipeData,
  RECIPE_FIELD_LIMITS,
} from './validation'

// ─── validateImportUrl ────────────────────────────────────────────────────────

describe('validateImportUrl', () => {
  it('returns null for a valid http URL', () => {
    expect(validateImportUrl('http://example.com/recipe')).toBeNull()
  })

  it('returns null for a valid https URL', () => {
    expect(validateImportUrl('https://www.allrecipes.com/recipe/123')).toBeNull()
  })

  it('returns "too_long" when URL exceeds 2048 characters', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(2100)
    expect(validateImportUrl(longUrl)).toBe('too_long')
  })

  it('returns "invalid_url" for a non-URL string', () => {
    expect(validateImportUrl('not a url')).toBe('invalid_url')
  })

  it('returns "invalid_url" for an empty string', () => {
    expect(validateImportUrl('')).toBe('invalid_url')
  })

  it('returns "invalid_protocol" for ftp:// URLs', () => {
    expect(validateImportUrl('ftp://example.com/file')).toBe('invalid_protocol')
  })

  it('returns "invalid_protocol" for file:// URLs', () => {
    expect(validateImportUrl('file:///etc/passwd')).toBe('invalid_protocol')
  })

  it('returns "private_host" for localhost', () => {
    expect(validateImportUrl('http://localhost:3000/recipe')).toBe('private_host')
  })

  it('returns "private_host" for 127.0.0.1', () => {
    expect(validateImportUrl('http://127.0.0.1/recipe')).toBe('private_host')
  })

  it('returns "private_host" for 0.0.0.0', () => {
    expect(validateImportUrl('http://0.0.0.0/recipe')).toBe('private_host')
  })

  it('returns "private_host" for ::1 (IPv6 loopback)', () => {
    expect(validateImportUrl('http://[::1]/recipe')).toBe('private_host')
  })

  it('returns "private_host" for 10.x.x.x (private range)', () => {
    expect(validateImportUrl('http://10.0.0.1/recipe')).toBe('private_host')
  })

  it('returns "private_host" for 192.168.x.x (private range)', () => {
    expect(validateImportUrl('http://192.168.1.100/recipe')).toBe('private_host')
  })

  it('returns "private_host" for 172.16.x.x (private range)', () => {
    expect(validateImportUrl('http://172.16.0.1/recipe')).toBe('private_host')
  })

  it('returns "private_host" for 169.254.x.x (link-local)', () => {
    expect(validateImportUrl('http://169.254.1.1/recipe')).toBe('private_host')
  })

  it('accepts URLs with query strings and fragments', () => {
    expect(validateImportUrl('https://example.com/recipe?id=123#ingredients')).toBeNull()
  })
})

// ─── checkImportRateLimit ─────────────────────────────────────────────────────

describe('checkImportRateLimit', () => {
  const storageKey = 'mise_import_timestamps'

  // Provide a proper in-memory localStorage mock
  let store: Record<string, string> = {}
  const localStorageMock: Storage = {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = String(value) },
    removeItem: (key) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (index) => Object.keys(store)[index] ?? null,
  }

  beforeEach(() => {
    store = {}
    vi.stubGlobal('localStorage', localStorageMock)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('allows the first import', () => {
    const result = checkImportRateLimit()
    expect(result.allowed).toBe(true)
    expect(result.retryAfterMs).toBeUndefined()
  })

  it('records each attempt in localStorage', () => {
    checkImportRateLimit()
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
    expect(stored).toHaveLength(1)
  })

  it('allows up to 10 imports within an hour', () => {
    for (let i = 0; i < 10; i++) {
      vi.setSystemTime(Date.now() + i * 1000)
      expect(checkImportRateLimit().allowed).toBe(true)
    }
  })

  it('blocks the 11th import within an hour', () => {
    for (let i = 0; i < 10; i++) {
      vi.setSystemTime(Date.now() + i * 1000)
      checkImportRateLimit()
    }
    const result = checkImportRateLimit()
    expect(result.allowed).toBe(false)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it('allows imports again after the window expires', () => {
    const start = Date.now()
    vi.setSystemTime(start)
    for (let i = 0; i < 10; i++) {
      checkImportRateLimit()
    }
    // Advance past the 1-hour window
    vi.setSystemTime(start + 60 * 60 * 1000 + 1)
    const result = checkImportRateLimit()
    expect(result.allowed).toBe(true)
  })

  it('ignores invalid (non-number) timestamps in storage', () => {
    localStorage.setItem(storageKey, JSON.stringify(['bad', null, undefined, {}]))
    const result = checkImportRateLimit()
    expect(result.allowed).toBe(true)
  })

  it('handles corrupt JSON in storage gracefully', () => {
    localStorage.setItem(storageKey, 'not-json{{')
    expect(() => checkImportRateLimit()).not.toThrow()
    expect(checkImportRateLimit().allowed).toBe(true)
  })
})

// ─── formatRetryAfter ─────────────────────────────────────────────────────────

describe('formatRetryAfter', () => {
  it('returns "1 minute" for 60000ms', () => {
    expect(formatRetryAfter(60_000)).toBe('1 minute')
  })

  it('returns "5 minutes" for 5 minutes in ms', () => {
    expect(formatRetryAfter(5 * 60_000)).toBe('5 minutes')
  })

  it('returns "1 hour" for 60 or more minutes', () => {
    expect(formatRetryAfter(60 * 60_000)).toBe('1 hour')
    expect(formatRetryAfter(90 * 60_000)).toBe('1 hour')
  })

  it('rounds up to the nearest minute', () => {
    // 90 seconds → ceil(1.5) → 2 minutes
    expect(formatRetryAfter(90_000)).toBe('2 minutes')
  })

  it('returns "1 minute" for very small values (rounds up)', () => {
    expect(formatRetryAfter(1)).toBe('1 minute')
  })
})

// ─── sanitizeText ─────────────────────────────────────────────────────────────

describe('sanitizeText', () => {
  it('trims leading and trailing whitespace', () => {
    expect(sanitizeText('  hello  ', 100)).toBe('hello')
  })

  it('truncates to maxLength after trimming', () => {
    expect(sanitizeText('abcde', 3)).toBe('abc')
  })

  it('does not truncate when string is shorter than maxLength', () => {
    expect(sanitizeText('hello', 100)).toBe('hello')
  })

  it('returns empty string for whitespace-only input', () => {
    expect(sanitizeText('   ', 100)).toBe('')
  })
})

// ─── sanitizeRecipeData ───────────────────────────────────────────────────────

describe('sanitizeRecipeData', () => {
  const baseRecipe = {
    name: 'Test Recipe',
    description: 'A test',
    recipeYield: '4',
    recipeIngredient: [{ name: 'pasta', amount: 200, unit: 'g' }],
    recipeInstructions: [{ '@type': 'HowToStep' as const, text: 'Boil water.' }],
    keywords: ['test'],
  }

  it('trims and clamps name to 200 characters', () => {
    const long = 'a'.repeat(250)
    const result = sanitizeRecipeData({ ...baseRecipe, name: `  ${long}  ` })
    expect(result.name).toHaveLength(RECIPE_FIELD_LIMITS.name)
    expect(result.name).toBe('a'.repeat(200))
  })

  it('trims and clamps description to 2000 characters', () => {
    const long = 'b'.repeat(2100)
    const result = sanitizeRecipeData({ ...baseRecipe, description: long })
    expect(result.description).toHaveLength(RECIPE_FIELD_LIMITS.description)
  })

  it('drops ingredients beyond 200 items', () => {
    const manyIngredients = Array.from({ length: 250 }, (_, i) => ({
      name: `ingredient ${i}`,
      amount: 1,
      unit: 'cup',
    }))
    const result = sanitizeRecipeData({ ...baseRecipe, recipeIngredient: manyIngredients })
    expect(result.recipeIngredient).toHaveLength(200)
  })

  it('drops instructions beyond 100 items', () => {
    const manySteps = Array.from({ length: 120 }, (_, i) => ({
      '@type': 'HowToStep' as const,
      text: `Step ${i}`,
    }))
    const result = sanitizeRecipeData({ ...baseRecipe, recipeInstructions: manySteps })
    expect(result.recipeInstructions).toHaveLength(100)
  })

  it('drops keywords beyond 50 items', () => {
    const manyKeywords = Array.from({ length: 60 }, (_, i) => `keyword${i}`)
    const result = sanitizeRecipeData({ ...baseRecipe, keywords: manyKeywords })
    expect(result.keywords).toHaveLength(50)
  })

  it('trims ingredient names and units', () => {
    const result = sanitizeRecipeData({
      ...baseRecipe,
      recipeIngredient: [{ name: '  pasta  ', amount: 200, unit: '  grams  ' }],
    })
    expect(result.recipeIngredient[0].name).toBe('pasta')
    expect(result.recipeIngredient[0].unit).toBe('grams')
  })

  it('trims instruction text', () => {
    const result = sanitizeRecipeData({
      ...baseRecipe,
      recipeInstructions: [{ '@type': 'HowToStep', text: '  Boil water.  ' }],
    })
    expect(result.recipeInstructions[0].text).toBe('Boil water.')
  })

  it('sanitizes optional author field when present', () => {
    const result = sanitizeRecipeData({ ...baseRecipe, author: '  Chef A  ' })
    expect(result.author).toBe('Chef A')
  })

  it('sanitizes optional recipeCategory field when present', () => {
    const result = sanitizeRecipeData({ ...baseRecipe, recipeCategory: '  Dinner  ' })
    expect(result.recipeCategory).toBe('Dinner')
  })

  it('sanitizes optional recipeCuisine field when present', () => {
    const result = sanitizeRecipeData({ ...baseRecipe, recipeCuisine: '  Italian  ' })
    expect(result.recipeCuisine).toBe('Italian')
  })

  it('preserves extra fields from the original recipe object', () => {
    type Extended = ReturnType<typeof sanitizeRecipeData> & { id: string; dateCreated: string }
    const input = { ...baseRecipe, id: 'recipe-1', dateCreated: '2026-01-01' } as unknown as Parameters<
      typeof sanitizeRecipeData
    >[0]
    const result = sanitizeRecipeData(input) as Extended
    expect(result.id).toBe('recipe-1')
    expect(result.dateCreated).toBe('2026-01-01')
  })
})
