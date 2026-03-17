import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { extractRecipeFromUrl, _resetScraperCache } from './scraper'
import type { ExtractedRecipe } from './scraper'
import { getAppSettingString, getAppSettingNumber } from './appSettingsService'

// ─── Module mocks ─────────────────────────────────────────────────────────────

// Mock admin scraping config — return the fake API key so extractRecipeFromUrl works.
vi.mock('./appSettingsService', () => ({
  getAppSettingString: vi.fn().mockImplementation((key: string) => {
    if (key === 'scraping.api_key') return Promise.resolve('sk-ant-test-key')
    return Promise.resolve(null)
  }),
  getAppSettingNumber: vi.fn().mockResolvedValue(null),
  APP_SETTING_KEYS: {
    SCRAPING_API_KEY: 'scraping.api_key',
    SCRAPING_MODEL: 'scraping.model',
    SCRAPING_PROVIDER: 'scraping.provider',
    SCRAPING_RATE_LIMIT: 'scraping.rate_limit',
  },
}))

// ─── Constants ────────────────────────────────────────────────────────────────

const ADMIN_API_KEY = 'sk-ant-test-key'
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

function makeClaudeSuccess(text: string) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({ content: [{ type: 'text', text }] }),
  }
}

function makeClaudeError(message: string, status = 400) {
  return {
    ok: false,
    status,
    json: vi.fn().mockResolvedValue({ error: { message } }),
  }
}

// ─── extractRecipeFromUrl ─────────────────────────────────────────────────────

describe('extractRecipeFromUrl', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
    // Reset admin config cache so each test gets a fresh load from the mock.
    _resetScraperCache()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // ── Successful extraction ──────────────────────────────────────────────────

  describe('successful extraction', () => {
    it('returns a recipe with correct fields when page content and Claude response are valid', async () => {
      mockFetch
        .mockResolvedValueOnce(makePageResponse('<html><body>pasta recipe content</body></html>'))
        .mockResolvedValueOnce(makeClaudeSuccess(JSON.stringify(validRecipePayload)))

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

    it('sends the API key in the x-api-key header', async () => {
      mockFetch
        .mockResolvedValueOnce(makePageResponse('<html></html>'))
        .mockResolvedValueOnce(makeClaudeSuccess(JSON.stringify(validRecipePayload)))

      await extractRecipeFromUrl(RECIPE_URL)

      const [, claudeCall] = mockFetch.mock.calls
      expect(claudeCall[1].headers['x-api-key']).toBe(ADMIN_API_KEY)
    })

    it('uses the claude-haiku-4-5-20251001 model', async () => {
      mockFetch
        .mockResolvedValueOnce(makePageResponse('<html></html>'))
        .mockResolvedValueOnce(makeClaudeSuccess(JSON.stringify(validRecipePayload)))

      await extractRecipeFromUrl(RECIPE_URL)

      const [, claudeCall] = mockFetch.mock.calls
      const body = JSON.parse(claudeCall[1].body as string)
      expect(body.model).toBe('claude-haiku-4-5-20251001')
    })

    it('includes the URL in the user message sent to Claude', async () => {
      mockFetch
        .mockResolvedValueOnce(makePageResponse('<html><body>pasta</body></html>'))
        .mockResolvedValueOnce(makeClaudeSuccess(JSON.stringify(validRecipePayload)))

      await extractRecipeFromUrl(RECIPE_URL)

      const [, claudeCall] = mockFetch.mock.calls
      const body = JSON.parse(claudeCall[1].body as string)
      expect(body.messages[0].content).toContain(RECIPE_URL)
    })
  })

  // ── CORS fallback behaviour ────────────────────────────────────────────────

  describe('CORS fallback behaviour', () => {
    it('falls back to URL-only context when the page fetch throws', async () => {
      mockFetch
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(makeClaudeSuccess(JSON.stringify(validRecipePayload)))

      const result = await extractRecipeFromUrl(RECIPE_URL)
      expect(result.ok).toBe(true)

      const [, claudeCall] = mockFetch.mock.calls
      const body = JSON.parse(claudeCall[1].body as string)
      expect(body.messages[0].content).toContain('Page content could not be fetched')
    })

    it('falls back to URL-only context when the page returns a non-ok status', async () => {
      mockFetch
        .mockResolvedValueOnce(makePageResponse('', false))
        .mockResolvedValueOnce(makeClaudeSuccess(JSON.stringify(validRecipePayload)))

      const result = await extractRecipeFromUrl(RECIPE_URL)
      expect(result.ok).toBe(true)

      const [, claudeCall] = mockFetch.mock.calls
      const body = JSON.parse(claudeCall[1].body as string)
      expect(body.messages[0].content).toContain('Page content could not be fetched')
    })

    it('includes page text in the Claude prompt when the page fetch succeeds', async () => {
      mockFetch
        .mockResolvedValueOnce(
          makePageResponse('<html><body>pasta recipe content here</body></html>')
        )
        .mockResolvedValueOnce(makeClaudeSuccess(JSON.stringify(validRecipePayload)))

      await extractRecipeFromUrl(RECIPE_URL)

      const [, claudeCall] = mockFetch.mock.calls
      const body = JSON.parse(claudeCall[1].body as string)
      expect(body.messages[0].content).toContain('Page content:')
      expect(body.messages[0].content).toContain('pasta recipe content here')
    })

    it('still resolves successfully when a social-media page fetch is blocked by CORS', async () => {
      mockFetch
        .mockRejectedValueOnce(new TypeError('CORS error'))
        .mockResolvedValueOnce(makeClaudeSuccess(JSON.stringify(validRecipePayload)))

      const result = await extractRecipeFromUrl('https://instagram.com/p/abc123')
      expect(result.ok).toBe(true)
    })

    it('truncates very long page content before sending to Claude', async () => {
      const longHtml = '<html><body>' + 'x'.repeat(20000) + '</body></html>'

      mockFetch
        .mockResolvedValueOnce(makePageResponse(longHtml))
        .mockResolvedValueOnce(makeClaudeSuccess(JSON.stringify(validRecipePayload)))

      await extractRecipeFromUrl(RECIPE_URL)

      const [, claudeCall] = mockFetch.mock.calls
      const body = JSON.parse(claudeCall[1].body as string)
      // Content should be truncated (12000 chars + marker, not 20000)
      expect(body.messages[0].content).toContain('[truncated]')
    })
  })

  // ── Timeout handling ───────────────────────────────────────────────────────

  describe('timeout handling', () => {
    it('treats a page fetch AbortError as a CORS/timeout failure and falls back to URL context', async () => {
      const abortError = new DOMException('The operation was aborted.', 'AbortError')

      mockFetch
        .mockRejectedValueOnce(abortError)
        .mockResolvedValueOnce(makeClaudeSuccess(JSON.stringify(validRecipePayload)))

      const result = await extractRecipeFromUrl(RECIPE_URL)
      expect(result.ok).toBe(true)

      const [, claudeCall] = mockFetch.mock.calls
      const body = JSON.parse(claudeCall[1].body as string)
      expect(body.messages[0].content).toContain('Page content could not be fetched')
    })

    it('returns a network error when the Claude API fetch itself throws', async () => {
      mockFetch
        .mockResolvedValueOnce(makePageResponse('<html></html>'))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('Network error')
      expect(result.error).toContain('Failed to fetch')
    })
  })

  // ── Malformed response handling ────────────────────────────────────────────

  describe('malformed response handling', () => {
    it('returns an error when Claude responds with unparseable text', async () => {
      mockFetch.mockResolvedValueOnce(makePageResponse('<html></html>')).mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'Not JSON at all!' }] }),
      })

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('Could not parse AI response as JSON.')
    })

    it('strips markdown code fences before parsing the JSON', async () => {
      const withFences = '```json\n' + JSON.stringify(validRecipePayload) + '\n```'

      mockFetch.mockResolvedValueOnce(makePageResponse('<html></html>')).mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: withFences }] }),
      })

      const result = await extractRecipeFromUrl(RECIPE_URL)
      expect(result.ok).toBe(true)
    })

    it('returns an error when Claude responds with {"error": "..."}', async () => {
      mockFetch.mockResolvedValueOnce(makePageResponse('<html></html>')).mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: [
            { type: 'text', text: JSON.stringify({ error: 'No recipe found at this URL' }) },
          ],
        }),
      })

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toBe('No recipe found at this URL')
    })

    it('returns an error when the extracted recipe name is empty', async () => {
      const noName = { ...validRecipePayload, name: '' }

      mockFetch
        .mockResolvedValueOnce(makePageResponse('<html></html>'))
        .mockResolvedValueOnce(makeClaudeSuccess(JSON.stringify(noName)))

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('No recipe found')
    })

    it('returns an invalid key error when Claude responds with HTTP 401', async () => {
      mockFetch
        .mockResolvedValueOnce(makePageResponse('<html></html>'))
        .mockResolvedValueOnce(makeClaudeError('Invalid API key', 401))

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('Invalid AI API key')
      expect(result.error).toContain('Admin settings')
    })

    it('returns a generic HTTP error message when the API error body has no message', async () => {
      mockFetch.mockResolvedValueOnce(makePageResponse('<html></html>')).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({}),
      })

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('HTTP 500')
    })

    it('returns an error when the Claude response content array is empty', async () => {
      mockFetch.mockResolvedValueOnce(makePageResponse('<html></html>')).mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ content: [] }),
      })

      const result = await extractRecipeFromUrl(RECIPE_URL)
      // Empty text → empty string → JSON.parse('') throws → parse error
      expect(result.ok).toBe(false)
    })
  })

  // ── Data normalisation ─────────────────────────────────────────────────────

  describe('data normalisation', () => {
    it('drops ingredients with no name', async () => {
      const payload = {
        ...validRecipePayload,
        recipeIngredient: [
          { name: 'pasta', amount: 200, unit: 'g' },
          { name: '', amount: 1, unit: 'cup' },
          { name: '   ', amount: 0, unit: '' },
        ],
      }

      mockFetch
        .mockResolvedValueOnce(makePageResponse('<html></html>'))
        .mockResolvedValueOnce(makeClaudeSuccess(JSON.stringify(payload)))

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.recipe.recipeIngredient).toHaveLength(1)
      expect(result.recipe.recipeIngredient[0].name).toBe('pasta')
    })

    it('drops instruction steps with no text', async () => {
      const payload = {
        ...validRecipePayload,
        recipeInstructions: [
          { '@type': 'HowToStep', text: 'Boil water.' },
          { '@type': 'HowToStep', text: '' },
        ],
      }

      mockFetch
        .mockResolvedValueOnce(makePageResponse('<html></html>'))
        .mockResolvedValueOnce(makeClaudeSuccess(JSON.stringify(payload)))

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.recipe.recipeInstructions).toHaveLength(1)
      expect(result.recipe.recipeInstructions[0]['@type']).toBe('HowToStep')
    })

    it('normalises keywords to lowercase and trims whitespace', async () => {
      const payload = {
        ...validRecipePayload,
        keywords: ['  PASTA  ', 'Italian', '  easy   '],
      }

      mockFetch
        .mockResolvedValueOnce(makePageResponse('<html></html>'))
        .mockResolvedValueOnce(makeClaudeSuccess(JSON.stringify(payload)))

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.recipe.keywords).toEqual(['pasta', 'italian', 'easy'])
    })

    it('returns empty arrays when ingredients, instructions and keywords are not arrays', async () => {
      const payload = {
        ...validRecipePayload,
        recipeIngredient: 'not an array',
        recipeInstructions: null,
        keywords: 42,
      }

      mockFetch
        .mockResolvedValueOnce(makePageResponse('<html></html>'))
        .mockResolvedValueOnce(makeClaudeSuccess(JSON.stringify(payload)))

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.recipe.recipeIngredient).toEqual([])
      expect(result.recipe.recipeInstructions).toEqual([])
      expect(result.recipe.keywords).toEqual([])
    })

    it('uses fallback defaults for missing recipeYield, prepTime and cookTime', async () => {
      const { recipeYield: _y, prepTime: _p, cookTime: _c, ...minimal } = validRecipePayload

      mockFetch
        .mockResolvedValueOnce(makePageResponse('<html></html>'))
        .mockResolvedValueOnce(makeClaudeSuccess(JSON.stringify(minimal)))

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.recipe.recipeYield).toBe('2')
      expect(result.recipe.prepTime).toBe('PT0M')
      expect(result.recipe.cookTime).toBe('PT0M')
    })

    it('leaves optional fields undefined when absent from the response', async () => {
      const {
        image: _i,
        author: _a,
        recipeCategory: _rc,
        recipeCuisine: _rcu,
        ...minimal
      } = validRecipePayload

      mockFetch
        .mockResolvedValueOnce(makePageResponse('<html></html>'))
        .mockResolvedValueOnce(makeClaudeSuccess(JSON.stringify(minimal)))

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.recipe.image).toBeUndefined()
      expect(result.recipe.author).toBeUndefined()
      expect(result.recipe.recipeCategory).toBeUndefined()
      expect(result.recipe.recipeCuisine).toBeUndefined()
    })

    it('falls back to the input URL when the response omits the url field', async () => {
      const { url: _u, ...withoutUrl } = validRecipePayload

      mockFetch
        .mockResolvedValueOnce(makePageResponse('<html></html>'))
        .mockResolvedValueOnce(makeClaudeSuccess(JSON.stringify(withoutUrl)))

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.recipe.url).toBe(RECIPE_URL)
    })
  })

  // ── AI call timeout ────────────────────────────────────────────────────────

  describe('AI call timeout', () => {
    it('returns a timeout error when the Claude API call times out', async () => {
      const timeoutError = new DOMException('The operation timed out.', 'TimeoutError')

      mockFetch
        .mockResolvedValueOnce(makePageResponse('<html></html>'))
        .mockRejectedValueOnce(timeoutError)

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('timed out')
      expect(result.error).toContain('30 seconds')
    })

    it('returns a rate-limit error when the Claude API responds with HTTP 429', async () => {
      mockFetch
        .mockResolvedValueOnce(makePageResponse('<html></html>'))
        .mockResolvedValueOnce(makeClaudeError('Rate limit exceeded', 429))

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('rate limit exceeded')
    })
  })

  // ── OpenAI provider ────────────────────────────────────────────────────────

  describe('OpenAI provider', () => {
    beforeEach(() => {
      _resetScraperCache()
      vi.mocked(getAppSettingString).mockImplementation((key: string) => {
        if (key === 'scraping.api_key') return Promise.resolve('sk-openai-test-key')
        if (key === 'scraping.provider') return Promise.resolve('openai')
        return Promise.resolve(null)
      })
    })

    afterEach(() => {
      // Restore default mock
      vi.mocked(getAppSettingString).mockImplementation((key: string) => {
        if (key === 'scraping.api_key') return Promise.resolve('sk-ant-test-key')
        return Promise.resolve(null)
      })
      _resetScraperCache()
    })

    it('parses OpenAI response format (choices[0].message.content) correctly', async () => {
      mockFetch
        .mockResolvedValueOnce(makePageResponse('<html></html>'))
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(validRecipePayload) } }],
          }),
        })

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.recipe.name).toBe('Spaghetti Carbonara')
    })

    it('sends Authorization Bearer header for OpenAI', async () => {
      mockFetch
        .mockResolvedValueOnce(makePageResponse('<html></html>'))
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(validRecipePayload) } }],
          }),
        })

      await extractRecipeFromUrl(RECIPE_URL)

      const [, aiCall] = mockFetch.mock.calls
      expect(aiCall[1].headers['Authorization']).toBe('Bearer sk-openai-test-key')
    })

    it('returns a timeout error when the OpenAI call times out', async () => {
      const timeoutError = new DOMException('The operation timed out.', 'TimeoutError')

      mockFetch
        .mockResolvedValueOnce(makePageResponse('<html></html>'))
        .mockRejectedValueOnce(timeoutError)

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('timed out')
    })
  })

  // ── Gemini provider ────────────────────────────────────────────────────────

  describe('Gemini provider', () => {
    beforeEach(() => {
      _resetScraperCache()
      vi.mocked(getAppSettingString).mockImplementation((key: string) => {
        if (key === 'scraping.api_key') return Promise.resolve('gemini-test-key')
        if (key === 'scraping.provider') return Promise.resolve('gemini')
        return Promise.resolve(null)
      })
    })

    afterEach(() => {
      vi.mocked(getAppSettingString).mockImplementation((key: string) => {
        if (key === 'scraping.api_key') return Promise.resolve('sk-ant-test-key')
        return Promise.resolve(null)
      })
      _resetScraperCache()
    })

    it('parses Gemini response format (candidates[0].content.parts[0].text) correctly', async () => {
      mockFetch
        .mockResolvedValueOnce(makePageResponse('<html></html>'))
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            candidates: [
              { content: { parts: [{ text: JSON.stringify(validRecipePayload) }] } },
            ],
          }),
        })

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.recipe.name).toBe('Spaghetti Carbonara')
    })

    it('returns a timeout error when the Gemini call times out', async () => {
      const timeoutError = new DOMException('The operation timed out.', 'TimeoutError')

      mockFetch
        .mockResolvedValueOnce(makePageResponse('<html></html>'))
        .mockRejectedValueOnce(timeoutError)

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('timed out')
    })

    it('returns an invalid key error when Gemini responds with HTTP 403', async () => {
      mockFetch
        .mockResolvedValueOnce(makePageResponse('<html></html>'))
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          json: vi.fn().mockResolvedValue({ error: { message: 'API key not valid.' } }),
        })

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('Invalid AI API key')
    })
  })

  // ── Admin rate limit setting ───────────────────────────────────────────────

  describe('admin rate limit setting', () => {
    const STORAGE_KEY = 'mise_import_timestamps'

    afterEach(() => {
      localStorage.removeItem(STORAGE_KEY)
      vi.mocked(getAppSettingNumber).mockResolvedValue(null)
      _resetScraperCache()
    })

    it('blocks requests when admin rate limit is lower than the default', async () => {
      // Admin has set rate limit to 2
      vi.mocked(getAppSettingNumber).mockResolvedValue(2)
      _resetScraperCache()

      // Pre-fill storage with 2 recent timestamps (within the last hour)
      const now = Date.now()
      localStorage.setItem(STORAGE_KEY, JSON.stringify([now - 2000, now - 1000]))

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('Too many import requests')
    })

    it('allows requests when count is below admin rate limit', async () => {
      // Admin has set rate limit to 5; only 2 recent requests exist
      vi.mocked(getAppSettingNumber).mockResolvedValue(5)
      _resetScraperCache()

      const now = Date.now()
      localStorage.setItem(STORAGE_KEY, JSON.stringify([now - 2000, now - 1000]))

      mockFetch
        .mockResolvedValueOnce(makePageResponse('<html></html>'))
        .mockResolvedValueOnce(makeClaudeSuccess(JSON.stringify(validRecipePayload)))

      const result = await extractRecipeFromUrl(RECIPE_URL)
      expect(result.ok).toBe(true)
    })
  })
})

// ─── localStorage helpers ─────────────────────────────────────────────────────
// jsdom 29 + fake-indexeddb/auto can leave localStorage in a broken state.
// Stub it with a real Map-backed implementation for these tests.

