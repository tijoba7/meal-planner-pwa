import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  extractRecipeFromUrl,
  extractRecipeFromText,
  extractRecipesFromUrls,
  parsePaprikaRecipe,
  parseCroutonExport,
  _resetScraperCache,
  isSocialMediaUrl,
  extractLinkedUrls,
} from './scraper'
import type { ExtractedRecipe, BatchItemState } from './scraper'

// ─── Module mocks ─────────────────────────────────────────────────────────────

// AI calls are now handled server-side in the extract-recipe edge function.
// The frontend only calls supabase.functions.invoke — no direct AI API calls.
export const mockFunctionsInvoke = vi.fn()

vi.mock('./supabase', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockFunctionsInvoke(...args) },
  },
}))

// ─── Constants ────────────────────────────────────────────────────────────────

const RECIPE_URL = 'https://example.com/recipe/pasta'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const validRecipePayload: ExtractedRecipe = {
  name: 'Spaghetti Carbonara',
  description: 'A classic Roman pasta dish.',
  recipeYield: '4',
  prepTime: 'PT10M',
  cookTime: 'PT20M',
  recipeIngredient: [
    { name: 'spaghetti', amount: 400, unit: 'g' },
    { name: 'eggs', amount: 3, unit: '' },
  ],
  recipeInstructions: [
    { '@type': 'HowToStep', text: 'Boil pasta in salted water.' },
    { '@type': 'HowToStep', text: 'Mix eggs and cheese.' },
  ],
  keywords: ['pasta', 'italian'],
  image: 'https://example.com/image.jpg',
  author: 'Chef Test',
  url: RECIPE_URL,
  recipeCategory: 'Dinner',
  recipeCuisine: 'Italian',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePageResponse(html: string, ok = true) {
  return { ok, text: vi.fn().mockResolvedValue(html) }
}

/** Default functions.invoke implementation: scrape-url unavailable, extract-recipe succeeds. */
function defaultFunctionsInvoke(fn: string) {
  if (fn === 'scrape-url') {
    return Promise.resolve({ data: { text: null, sourceType: null }, error: null })
  }
  // extract-recipe
  return Promise.resolve({ data: { ok: true, recipe: validRecipePayload }, error: null })
}

/** Make extract-recipe return a custom recipe. scrape-url still returns null. */
function makeExtractSuccess(recipe: ExtractedRecipe) {
  return (fn: string) => {
    if (fn === 'scrape-url') return Promise.resolve({ data: { text: null, sourceType: null }, error: null })
    return Promise.resolve({ data: { ok: true, recipe }, error: null })
  }
}

/** Make extract-recipe return an error. scrape-url still returns null. */
function makeExtractError(error: string) {
  return (fn: string) => {
    if (fn === 'scrape-url') return Promise.resolve({ data: { text: null, sourceType: null }, error: null })
    return Promise.resolve({ data: { ok: false, error }, error: null })
  }
}

/** Make extract-recipe itself fail (network/service error). */
function makeExtractServiceError() {
  return (fn: string) => {
    if (fn === 'scrape-url') return Promise.resolve({ data: { text: null, sourceType: null }, error: null })
    return Promise.resolve({ data: null, error: new Error('Edge Function returned a non-2xx status code') })
  }
}

// ─── extractRecipeFromUrl ─────────────────────────────────────────────────────

describe('extractRecipeFromUrl', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
    _resetScraperCache()
    mockFunctionsInvoke.mockClear()
    mockFunctionsInvoke.mockImplementation(defaultFunctionsInvoke)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // ── Successful extraction ──────────────────────────────────────────────────

  describe('successful extraction', () => {
    it('returns a recipe with correct fields when page content and edge function succeed', async () => {
      mockFetch.mockResolvedValueOnce(makePageResponse('<html><body>pasta recipe content</body></html>'))

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.recipe.name).toBe('Spaghetti Carbonara')
      expect(result.recipe.description).toBe('A classic Roman pasta dish.')
      expect(result.recipe.recipeYield).toBe('4')
      expect(result.recipe.prepTime).toBe('PT10M')
      expect(result.recipe.cookTime).toBe('PT20M')
      expect(result.recipe.recipeIngredient).toHaveLength(2)
      expect(result.recipe.recipeInstructions).toHaveLength(2)
      expect(result.recipe.keywords).toEqual(['pasta', 'italian'])
      expect(result.recipe.image).toBe('https://example.com/image.jpg')
      expect(result.recipe.author).toBe('Chef Test')
      expect(result.recipe.url).toBe(RECIPE_URL)
      expect(result.recipe.recipeCategory).toBe('Dinner')
      expect(result.recipe.recipeCuisine).toBe('Italian')
    })

    it('calls extract-recipe edge function with systemPrompt and userMessage', async () => {
      mockFetch.mockResolvedValueOnce(makePageResponse('<html><body>pasta</body></html>'))

      await extractRecipeFromUrl(RECIPE_URL)

      const extractCall = mockFunctionsInvoke.mock.calls.find(([fn]) => fn === 'extract-recipe')
      expect(extractCall).toBeDefined()
      const body = extractCall![1].body as { systemPrompt: string; userMessage: string }
      expect(typeof body.systemPrompt).toBe('string')
      expect(body.systemPrompt.length).toBeGreaterThan(0)
      expect(body.userMessage).toContain(RECIPE_URL)
    })

    it('includes page text in the userMessage sent to extract-recipe', async () => {
      mockFetch.mockResolvedValueOnce(
        makePageResponse('<html><body>pasta recipe content here</body></html>')
      )

      await extractRecipeFromUrl(RECIPE_URL)

      const extractCall = mockFunctionsInvoke.mock.calls.find(([fn]) => fn === 'extract-recipe')!
      const body = extractCall[1].body as { userMessage: string }
      expect(body.userMessage).toContain('Page content:')
      expect(body.userMessage).toContain('pasta recipe content here')
    })

    it('marks extractionSource as structured_data when page text is available', async () => {
      mockFetch.mockResolvedValueOnce(makePageResponse('<html><body>recipe content</body></html>'))

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.recipe.extractionSource).toBe('structured_data')
    })
  })

  // ── Page text proxy + CORS fallback ───────────────────────────────────────

  describe('CORS fallback behaviour', () => {
    it('falls back to URL-only context when the page fetch throws', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

      const result = await extractRecipeFromUrl(RECIPE_URL)
      expect(result.ok).toBe(true)

      const extractCall = mockFunctionsInvoke.mock.calls.find(([fn]) => fn === 'extract-recipe')!
      const body = extractCall[1].body as { userMessage: string }
      expect(body.userMessage).toContain('Page content could not be fetched')
    })

    it('falls back to URL-only context when the page returns a non-ok status', async () => {
      mockFetch.mockResolvedValueOnce(makePageResponse('', false))

      const result = await extractRecipeFromUrl(RECIPE_URL)
      expect(result.ok).toBe(true)

      const extractCall = mockFunctionsInvoke.mock.calls.find(([fn]) => fn === 'extract-recipe')!
      const body = extractCall[1].body as { userMessage: string }
      expect(body.userMessage).toContain('Page content could not be fetched')
    })

    it('still resolves successfully when a social-media page fetch is blocked by CORS', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('CORS error'))

      const result = await extractRecipeFromUrl('https://instagram.com/p/abc123')
      expect(result.ok).toBe(true)
    })

    it('truncates very long page content before sending to the edge function', async () => {
      const longHtml = '<html><body>' + 'x'.repeat(20000) + '</body></html>'
      mockFetch.mockResolvedValueOnce(makePageResponse(longHtml))

      await extractRecipeFromUrl(RECIPE_URL)

      const extractCall = mockFunctionsInvoke.mock.calls.find(([fn]) => fn === 'extract-recipe')!
      const body = extractCall[1].body as { userMessage: string }
      expect(body.userMessage).toContain('[truncated]')
    })

    it('treats a page fetch AbortError as a failure and falls back to URL context', async () => {
      const abortError = new DOMException('The operation was aborted.', 'AbortError')
      mockFetch.mockRejectedValueOnce(abortError)

      const result = await extractRecipeFromUrl(RECIPE_URL)
      expect(result.ok).toBe(true)

      const extractCall = mockFunctionsInvoke.mock.calls.find(([fn]) => fn === 'extract-recipe')!
      const body = extractCall[1].body as { userMessage: string }
      expect(body.userMessage).toContain('Page content could not be fetched')
    })
  })

  // ── Social video handling ──────────────────────────────────────────────────

  describe('social video handling', () => {
    it('uses the social-video system prompt when scrape-url returns sourceType=social_video', async () => {
      // Mock the proxy to return social video content (real behavior when Reels can be fetched)
      mockFunctionsInvoke.mockImplementation((fn: string) => {
        if (fn === 'scrape-url') {
          return Promise.resolve({
            data: { text: 'Social Media Metadata\nog:title: Pasta Carbonara\n...', sourceType: 'social_video' },
            error: null,
          })
        }
        return Promise.resolve({ data: { ok: true, recipe: validRecipePayload }, error: null })
      })

      await extractRecipeFromUrl('https://instagram.com/reel/abc123')

      const extractCall = mockFunctionsInvoke.mock.calls.find(([fn]) => fn === 'extract-recipe')!
      const body = extractCall[1].body as { systemPrompt: string; userMessage: string }
      // Social video prompt is different from the regular recipe prompt
      expect(body.systemPrompt).toContain('social media video')
    })

    it('marks extractionSource as social_metadata when sourceType is social_video', async () => {
      mockFunctionsInvoke.mockImplementation((fn: string) => {
        if (fn === 'scrape-url') {
          return Promise.resolve({
            data: { text: 'video metadata content', sourceType: 'social_video' },
            error: null,
          })
        }
        return Promise.resolve({ data: { ok: true, recipe: validRecipePayload }, error: null })
      })

      const result = await extractRecipeFromUrl('https://instagram.com/reel/abc123')

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.recipe.extractionSource).toBe('social_metadata')
    })

    it('marks extractionSource as ai_inferred when page text could not be fetched', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('CORS'))

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.recipe.extractionSource).toBe('ai_inferred')
    })
  })

  // ── Error handling ─────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns an error when the extract-recipe service is unavailable', async () => {
      mockFetch.mockResolvedValueOnce(makePageResponse('<html></html>'))
      mockFunctionsInvoke.mockImplementation(makeExtractServiceError())

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('unavailable')
    })

    it('returns the error message from the edge function on failure', async () => {
      mockFetch.mockResolvedValueOnce(makePageResponse('<html></html>'))
      mockFunctionsInvoke.mockImplementation(makeExtractError('No recipe found at this URL'))

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toBe('No recipe found at this URL')
    })

    it('returns a rate limit error when the edge function responds with rate limit exceeded', async () => {
      mockFetch.mockResolvedValueOnce(makePageResponse('<html></html>'))
      mockFunctionsInvoke.mockImplementation(
        makeExtractError('Too many import requests. Please wait 2700 seconds before trying again.')
      )

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('Too many import requests')
    })

    it('returns an error when the edge function indicates API key not configured', async () => {
      mockFetch.mockResolvedValueOnce(makePageResponse('<html></html>'))
      mockFunctionsInvoke.mockImplementation(
        makeExtractError('AI scraping not configured — ask your admin to set up an API key.')
      )

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('API key')
    })

    it('returns an error when the edge function returns no recipe object', async () => {
      mockFetch.mockResolvedValueOnce(makePageResponse('<html></html>'))
      mockFunctionsInvoke.mockImplementation((fn: string) => {
        if (fn === 'scrape-url') return Promise.resolve({ data: { text: null }, error: null })
        // ok: true but no recipe field
        return Promise.resolve({ data: { ok: true }, error: null })
      })

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('No recipe returned')
    })
  })

  // ── URL validation ─────────────────────────────────────────────────────────

  describe('URL validation', () => {
    it('rejects non-HTTP URLs', async () => {
      const result = await extractRecipeFromUrl('ftp://example.com/recipe')
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toBeDefined()
    })

    it('rejects empty strings', async () => {
      const result = await extractRecipeFromUrl('')
      expect(result.ok).toBe(false)
    })
  })

  // ── URL and extractionSource in result ─────────────────────────────────────

  describe('result metadata', () => {
    it('falls back to the input URL when the recipe omits the url field', async () => {
      const { url: _u, ...withoutUrl } = validRecipePayload
      mockFetch.mockResolvedValueOnce(makePageResponse('<html></html>'))
      mockFunctionsInvoke.mockImplementation(makeExtractSuccess(withoutUrl as ExtractedRecipe))

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.recipe.url).toBe(RECIPE_URL)
    })
  })
})

// ─── extractRecipeFromText ─────────────────────────────────────────────────────

describe('extractRecipeFromText', () => {
  beforeEach(() => {
    _resetScraperCache()
    mockFunctionsInvoke.mockClear()
    mockFunctionsInvoke.mockImplementation(defaultFunctionsInvoke)
  })

  it('returns a recipe when the edge function successfully extracts from text', async () => {
    const result = await extractRecipeFromText('Spaghetti Carbonara recipe: 400g pasta, 3 eggs...')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.recipe.name).toBe('Spaghetti Carbonara')
  })

  it('calls extract-recipe with systemPrompt and the text as userMessage', async () => {
    await extractRecipeFromText('some recipe text')

    const extractCall = mockFunctionsInvoke.mock.calls.find(([fn]) => fn === 'extract-recipe')!
    expect(extractCall).toBeDefined()
    const body = extractCall[1].body as { systemPrompt: string; userMessage: string }
    expect(typeof body.systemPrompt).toBe('string')
    expect(body.userMessage).toContain('some recipe text')
  })

  it('truncates very long text before sending to the edge function', async () => {
    const longText = 'x'.repeat(20000)
    await extractRecipeFromText(longText)

    const extractCall = mockFunctionsInvoke.mock.calls.find(([fn]) => fn === 'extract-recipe')!
    const body = extractCall[1].body as { userMessage: string }
    expect(body.userMessage).toContain('[truncated]')
  })

  it('returns an error when the edge function reports no recipe found', async () => {
    mockFunctionsInvoke.mockImplementation(makeExtractError('No recipe found in this text'))

    const result = await extractRecipeFromText('This is not a recipe.')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('No recipe found in this text')
  })

  it('returns an error when the edge function service is unavailable', async () => {
    mockFunctionsInvoke.mockImplementation(makeExtractServiceError())

    const result = await extractRecipeFromText('some text')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('unavailable')
  })

  it('returns an error when the edge function indicates API key not configured', async () => {
    mockFunctionsInvoke.mockImplementation(
      makeExtractError('AI scraping not configured — ask your admin to set up an API key.')
    )

    const result = await extractRecipeFromText('some text')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('API key')
  })
})

// ─── extractRecipesFromUrls ────────────────────────────────────────────────────

describe('extractRecipesFromUrls', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
    _resetScraperCache()
    mockFunctionsInvoke.mockClear()
    mockFunctionsInvoke.mockImplementation(defaultFunctionsInvoke)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('processes each URL and returns a BatchItemState array', async () => {
    const urls = [
      'https://example.com/recipe/pasta',
      'https://example.com/recipe/soup',
    ]

    // Page text for each URL (scrape-url returns null, direct fetch is used)
    mockFetch
      .mockResolvedValueOnce(makePageResponse('<html></html>'))
      .mockResolvedValueOnce(makePageResponse('<html></html>'))

    // extract-recipe returns different names for each URL
    let callCount = 0
    mockFunctionsInvoke.mockImplementation((fn: string) => {
      if (fn === 'scrape-url') return Promise.resolve({ data: { text: null }, error: null })
      callCount++
      const name = callCount === 1 ? 'Pasta' : 'Soup'
      return Promise.resolve({ data: { ok: true, recipe: { ...validRecipePayload, name } }, error: null })
    })

    const progressUpdates: BatchItemState[][] = []
    const results = await extractRecipesFromUrls(urls, (items) => {
      progressUpdates.push([...items])
    })

    expect(results).toHaveLength(2)
    expect(results[0].status).toBe('done')
    expect(results[0].recipe?.name).toBe('Pasta')
    expect(results[1].status).toBe('done')
    expect(results[1].recipe?.name).toBe('Soup')
  })

  it('calls onProgress with initial pending state, then loading, then done', async () => {
    const urls = ['https://example.com/recipe/pasta']
    mockFetch.mockResolvedValueOnce(makePageResponse('<html></html>'))

    const statuses: string[] = []
    await extractRecipesFromUrls(urls, (items) => {
      statuses.push(items[0].status)
    })

    expect(statuses[0]).toBe('pending')
    expect(statuses[1]).toBe('loading')
    expect(statuses[statuses.length - 1]).toBe('done')
  })

  it('marks a URL as error when extraction fails', async () => {
    const urls = ['https://example.com/bad-url']
    mockFetch.mockResolvedValueOnce(makePageResponse('<html></html>'))
    mockFunctionsInvoke.mockImplementation(makeExtractError('No recipe found'))

    const results = await extractRecipesFromUrls(urls, () => {})

    expect(results[0].status).toBe('error')
    expect(results[0].error).toBeDefined()
  })

  it('processes URLs sequentially — does not start the next until the first is done', async () => {
    const callOrder: number[] = []
    const urls = [
      'https://example.com/recipe/first',
      'https://example.com/recipe/second',
    ]

    mockFetch
      .mockImplementationOnce(() => {
        callOrder.push(1)
        return Promise.resolve(makePageResponse('<html></html>'))
      })
      .mockImplementationOnce(() => {
        callOrder.push(3)
        return Promise.resolve(makePageResponse('<html></html>'))
      })

    let extractCount = 0
    mockFunctionsInvoke.mockImplementation((fn: string) => {
      if (fn === 'scrape-url') return Promise.resolve({ data: { text: null }, error: null })
      extractCount++
      callOrder.push(extractCount === 1 ? 2 : 4)
      return Promise.resolve({ data: { ok: true, recipe: validRecipePayload }, error: null })
    })

    await extractRecipesFromUrls(urls, () => {})

    // First URL's fetches (1, 2) must complete before second URL's (3, 4)
    expect(callOrder).toEqual([1, 2, 3, 4])
  })
})

// ─── parsePaprikaRecipe ────────────────────────────────────────────────────────

describe('parsePaprikaRecipe', () => {
  it('parses a valid Paprika recipe object', () => {
    const data = {
      name: 'Chicken Soup',
      description: 'A classic comfort food.',
      servings: '4',
      prepTime: '15 min',
      cookTime: '1 hour',
      ingredients: 'Chicken\n2 cups Broth\n1 Carrot',
      directions: 'Combine all ingredients.\n\nSimmer for 1 hour.',
      categories: ['Soup', 'Comfort Food'],
      imageUrl: 'https://example.com/chicken.jpg',
      sourceUrl: 'https://example.com/chicken-soup',
    }

    const result = parsePaprikaRecipe(data)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.recipe.name).toBe('Chicken Soup')
    expect(result.recipe.recipeYield).toBe('4')
    expect(result.recipe.prepTime).toBe('PT15M')
    expect(result.recipe.cookTime).toBe('PT1H')
    expect(result.recipe.recipeIngredient.length).toBeGreaterThan(0)
    expect(result.recipe.recipeInstructions).toHaveLength(2)
    expect(result.recipe.keywords).toContain('soup')
    expect(result.recipe.image).toBe('https://example.com/chicken.jpg')
    expect(result.recipe.url).toBe('https://example.com/chicken-soup')
  })

  it('returns an error when the recipe has no name', () => {
    const result = parsePaprikaRecipe({ name: '', ingredients: '' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('no name')
  })

  it('returns an error for non-object inputs', () => {
    expect(parsePaprikaRecipe(null).ok).toBe(false)
    expect(parsePaprikaRecipe('string').ok).toBe(false)
    expect(parsePaprikaRecipe([]).ok).toBe(false)
  })

  it('parses time strings with hours and minutes', () => {
    const result = parsePaprikaRecipe({
      name: 'Stew',
      prepTime: '1 hour 30 min',
      cookTime: '2 hours',
      ingredients: '',
      directions: '',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.recipe.prepTime).toBe('PT1H30M')
    expect(result.recipe.cookTime).toBe('PT2H')
  })

  it('accepts snake_case time fields (prep_time, cook_time)', () => {
    const result = parsePaprikaRecipe({
      name: 'Test Recipe',
      prep_time: '10 min',
      cook_time: '30 min',
      ingredients: '',
      directions: '',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.recipe.prepTime).toBe('PT10M')
    expect(result.recipe.cookTime).toBe('PT30M')
  })

  it('uses description field before notes for recipe description', () => {
    const result = parsePaprikaRecipe({
      name: 'Recipe',
      description: 'Primary description',
      notes: 'Some notes',
      ingredients: '',
      directions: '',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.recipe.description).toBe('Primary description')
  })

  it('falls back to notes when description is absent', () => {
    const result = parsePaprikaRecipe({
      name: 'Recipe',
      notes: 'Fall-back notes',
      ingredients: '',
      directions: '',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.recipe.description).toBe('Fall-back notes')
  })
})

// ─── parseCroutonExport ────────────────────────────────────────────────────────

describe('parseCroutonExport', () => {
  const croutonRecipe = {
    name: 'Avocado Toast',
    description: 'Simple and delicious.',
    yield: '2',
    prepTime: 5,
    cookTime: 0,
    ingredients: [
      { name: 'Avocado', quantity: '1' },
      { name: 'Bread', quantity: '2 slices' },
    ],
    steps: ['Toast the bread.', 'Mash the avocado and spread.'],
    tags: ['Breakfast', 'Quick'],
    image: 'https://example.com/avocado.jpg',
    source: 'https://example.com/avocado-toast',
  }

  it('parses a Crouton export array with one recipe', () => {
    const results = parseCroutonExport([croutonRecipe])

    expect(results).toHaveLength(1)
    expect(results[0].ok).toBe(true)
    if (!results[0].ok) return
    expect(results[0].recipe.name).toBe('Avocado Toast')
    expect(results[0].recipe.prepTime).toBe('PT5M')
    expect(results[0].recipe.cookTime).toBe('PT0M')
    expect(results[0].recipe.recipeInstructions).toHaveLength(2)
    expect(results[0].recipe.keywords).toContain('breakfast')
    expect(results[0].recipe.image).toBe('https://example.com/avocado.jpg')
    expect(results[0].recipe.url).toBe('https://example.com/avocado-toast')
  })

  it('parses a Crouton export wrapped in { recipes: [...] }', () => {
    const results = parseCroutonExport({ recipes: [croutonRecipe] })

    expect(results).toHaveLength(1)
    expect(results[0].ok).toBe(true)
  })

  it('returns multiple results when multiple recipes are in the array', () => {
    const second = { ...croutonRecipe, name: 'Scrambled Eggs' }
    const results = parseCroutonExport([croutonRecipe, second])

    expect(results).toHaveLength(2)
    const r0 = results[0]
    const r1 = results[1]
    expect(r0.ok).toBe(true)
    if (r0.ok) expect(r0.recipe.name).toBe('Avocado Toast')
    expect(r1.ok).toBe(true)
    if (r1.ok) expect(r1.recipe.name).toBe('Scrambled Eggs')
  })

  it('returns an error for a recipe missing a name', () => {
    const results = parseCroutonExport([{ ...croutonRecipe, name: '' }])

    expect(results[0].ok).toBe(false)
    if (results[0].ok) return
    expect(results[0].error).toContain('no name')
  })

  it('returns an error when given a non-array, non-object input', () => {
    const results = parseCroutonExport('not an export')

    expect(results).toHaveLength(1)
    expect(results[0].ok).toBe(false)
  })

  it('returns an error when the recipes array is empty', () => {
    const results = parseCroutonExport([])

    expect(results).toHaveLength(1)
    expect(results[0].ok).toBe(false)
    if (results[0].ok) return
    expect(results[0].error).toContain('No recipes found')
  })

  it('parses string ingredients as well as object ingredients', () => {
    const results = parseCroutonExport([{ ...croutonRecipe, ingredients: ['2 cups flour', '1 egg'] }])

    expect(results[0].ok).toBe(true)
    if (!results[0].ok) return
    expect(results[0].recipe.recipeIngredient.length).toBeGreaterThan(0)
  })

  it('uses the servings field as a fallback for yield', () => {
    const { yield: _y, ...withoutYield } = croutonRecipe
    const results = parseCroutonExport([{ ...withoutYield, servings: '4' }])

    expect(results[0].ok).toBe(true)
    if (!results[0].ok) return
    expect(results[0].recipe.recipeYield).toBe('4')
  })
})

// ─── isSocialMediaUrl ─────────────────────────────────────────────────────────

describe('isSocialMediaUrl', () => {
  it.each([
    'https://instagram.com/p/abc123',
    'https://www.instagram.com/rhi.scran/reel/DWCJi_niLuv/',
    'https://tiktok.com/@user/video/123',
    'https://pinterest.com/pin/123',
    'https://twitter.com/user/status/123',
    'https://x.com/user/status/123',
    'https://facebook.com/video/123',
    'https://threads.net/@user',
    'https://youtube.com/watch?v=abc',
    'https://youtu.be/abc',
  ])('returns true for %s', (url) => {
    expect(isSocialMediaUrl(url)).toBe(true)
  })

  it.each([
    'https://example.com/recipe/pasta',
    'https://allrecipes.com/recipe/123',
    'https://myrecipeblog.com/carbonara',
  ])('returns false for %s', (url) => {
    expect(isSocialMediaUrl(url)).toBe(false)
  })
})

// ─── extractLinkedUrls ────────────────────────────────────────────────────────

describe('extractLinkedUrls', () => {
  it('extracts non-social HTTP(S) URLs from page text', () => {
    const text =
      'Check out my recipe at https://myrecipeblog.com/carbonara or visit https://allrecipes.com/recipe/123'
    const result = extractLinkedUrls(text, 'instagram.com')
    expect(result).toContain('https://myrecipeblog.com/carbonara')
    expect(result).toContain('https://allrecipes.com/recipe/123')
  })

  it('excludes the source domain', () => {
    const text = 'More at https://instagram.com/p/other and https://myrecipeblog.com/pasta'
    const result = extractLinkedUrls(text, 'instagram.com')
    expect(result).not.toContain('https://instagram.com/p/other')
    expect(result).toContain('https://myrecipeblog.com/pasta')
  })

  it('excludes other social media domains', () => {
    const text = 'See https://tiktok.com/@user/video/123 and https://myrecipeblog.com/pasta'
    const result = extractLinkedUrls(text, 'instagram.com')
    expect(result).not.toContain('https://tiktok.com/@user/video/123')
    expect(result).toContain('https://myrecipeblog.com/pasta')
  })

  it('strips trailing punctuation from URLs', () => {
    const text = 'Recipe at https://example.com/pasta.'
    const result = extractLinkedUrls(text, 'instagram.com')
    expect(result).toContain('https://example.com/pasta')
    expect(result).not.toContain('https://example.com/pasta.')
  })

  it('returns at most 3 URLs', () => {
    const text = [
      'https://a.com/1',
      'https://b.com/2',
      'https://c.com/3',
      'https://d.com/4',
    ].join(' ')
    const result = extractLinkedUrls(text, 'instagram.com')
    expect(result.length).toBeLessThanOrEqual(3)
  })

  it('returns empty array when no matching URLs found', () => {
    const result = extractLinkedUrls('No URLs here!', 'instagram.com')
    expect(result).toEqual([])
  })
})
