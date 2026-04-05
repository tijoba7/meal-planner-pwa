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
import { getAppSettingString, getAppSettingNumber } from './appSettingsService'

// ─── Module mocks ─────────────────────────────────────────────────────────────

// Mock Supabase client — RPC calls for server-side rate limiting and config.
const mockRpc = vi.fn().mockImplementation((fn: string) => {
  if (fn === 'get_scraping_config') {
    return Promise.resolve({
      data: { api_key: 'sk-ant-test-key', provider: 'anthropic', model: null },
      error: null,
    })
  }
  if (fn === 'check_scrape_rate_limit') {
    return Promise.resolve({
      data: { allowed: true, remaining: 9, retry_after_sec: 0 },
      error: null,
    })
  }
  return Promise.resolve({ data: null, error: { message: 'Unknown function' } })
})

// By default the edge function proxy returns null (unavailable), so tests fall through
// to the direct browser fetch mock and the existing fetch-ordering assumptions hold.
export const mockFunctionsInvoke = vi.fn().mockResolvedValue({ data: { text: null }, error: null })

vi.mock('./supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    functions: { invoke: (...args: unknown[]) => mockFunctionsInvoke(...args) },
  },
}))

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
      mockRpc.mockImplementation((fn: string) => {
        if (fn === 'get_scraping_config') {
          return Promise.resolve({
            data: { api_key: 'sk-openai-test-key', provider: 'openai', model: null },
            error: null,
          })
        }
        if (fn === 'check_scrape_rate_limit') {
          return Promise.resolve({ data: { allowed: true, remaining: 9, retry_after_sec: 0 }, error: null })
        }
        return Promise.resolve({ data: null, error: { message: 'Unknown function' } })
      })
      vi.mocked(getAppSettingString).mockImplementation((key: string) => {
        if (key === 'scraping.api_key') return Promise.resolve('sk-openai-test-key')
        if (key === 'scraping.provider') return Promise.resolve('openai')
        return Promise.resolve(null)
      })
    })

    afterEach(() => {
      // Restore default mock
      mockRpc.mockImplementation((fn: string) => {
        if (fn === 'get_scraping_config') {
          return Promise.resolve({ data: { api_key: 'sk-ant-test-key', provider: 'anthropic', model: null }, error: null })
        }
        if (fn === 'check_scrape_rate_limit') {
          return Promise.resolve({ data: { allowed: true, remaining: 9, retry_after_sec: 0 }, error: null })
        }
        return Promise.resolve({ data: null, error: { message: 'Unknown function' } })
      })
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
      mockRpc.mockImplementation((fn: string) => {
        if (fn === 'get_scraping_config') {
          return Promise.resolve({
            data: { api_key: 'gemini-test-key', provider: 'gemini', model: null },
            error: null,
          })
        }
        if (fn === 'check_scrape_rate_limit') {
          return Promise.resolve({ data: { allowed: true, remaining: 9, retry_after_sec: 0 }, error: null })
        }
        return Promise.resolve({ data: null, error: { message: 'Unknown function' } })
      })
      vi.mocked(getAppSettingString).mockImplementation((key: string) => {
        if (key === 'scraping.api_key') return Promise.resolve('gemini-test-key')
        if (key === 'scraping.provider') return Promise.resolve('gemini')
        return Promise.resolve(null)
      })
    })

    afterEach(() => {
      mockRpc.mockImplementation((fn: string) => {
        if (fn === 'get_scraping_config') {
          return Promise.resolve({ data: { api_key: 'sk-ant-test-key', provider: 'anthropic', model: null }, error: null })
        }
        if (fn === 'check_scrape_rate_limit') {
          return Promise.resolve({ data: { allowed: true, remaining: 9, retry_after_sec: 0 }, error: null })
        }
        return Promise.resolve({ data: null, error: { message: 'Unknown function' } })
      })
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
      _resetScraperCache()
      // Server-side rate limit returns blocked
      mockRpc.mockImplementation((fn: string) => {
        if (fn === 'get_scraping_config') {
          return Promise.resolve({ data: { api_key: 'sk-ant-test-key', provider: 'anthropic', model: null }, error: null })
        }
        if (fn === 'check_scrape_rate_limit') {
          return Promise.resolve({ data: { allowed: false, remaining: 0, retry_after_sec: 2700 }, error: null })
        }
        return Promise.resolve({ data: null, error: { message: 'Unknown function' } })
      })

      const result = await extractRecipeFromUrl(RECIPE_URL)

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('Too many import requests')

      // Restore default mock
      mockRpc.mockImplementation((fn: string) => {
        if (fn === 'get_scraping_config') {
          return Promise.resolve({ data: { api_key: 'sk-ant-test-key', provider: 'anthropic', model: null }, error: null })
        }
        if (fn === 'check_scrape_rate_limit') {
          return Promise.resolve({ data: { allowed: true, remaining: 9, retry_after_sec: 0 }, error: null })
        }
        return Promise.resolve({ data: null, error: { message: 'Unknown function' } })
      })
    })

    it('allows requests when count is below admin rate limit', async () => {
      _resetScraperCache()

      mockFetch
        .mockResolvedValueOnce(makePageResponse('<html></html>'))
        .mockResolvedValueOnce(makeClaudeSuccess(JSON.stringify(validRecipePayload)))

      const result = await extractRecipeFromUrl(RECIPE_URL)
      expect(result.ok).toBe(true)
    })
  })
})

// ─── extractRecipeFromText ─────────────────────────────────────────────────────

describe('extractRecipeFromText', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
    _resetScraperCache()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    _resetScraperCache()
  })

  it('returns a recipe when the AI successfully extracts from text', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify(validRecipePayload) }] }),
    })

    const result = await extractRecipeFromText('Spaghetti Carbonara recipe: 400g pasta, 3 eggs...')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.recipe.name).toBe('Spaghetti Carbonara')
  })

  it('sends the text to the AI without fetching a URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify(validRecipePayload) }] }),
    })

    await extractRecipeFromText('some recipe text')

    // Only one fetch call — no page fetch, only AI call
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url] = mockFetch.mock.calls[0] as [string]
    expect(url).toContain('anthropic.com')
  })

  it('truncates very long text before sending to the AI', async () => {
    const longText = 'x'.repeat(20000)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify(validRecipePayload) }] }),
    })

    await extractRecipeFromText(longText)

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(body.messages[0].content).toContain('[truncated]')
  })

  it('returns an error when no API key is configured', async () => {
    _resetScraperCache()
    // Mock RPC to return no API key
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'get_scraping_config') {
        return Promise.resolve({ data: { error: 'AI scraping not configured' }, error: null })
      }
      if (fn === 'check_scrape_rate_limit') {
        return Promise.resolve({ data: { allowed: true, remaining: 9, retry_after_sec: 0 }, error: null })
      }
      return Promise.resolve({ data: null, error: { message: 'Unknown function' } })
    })
    vi.mocked(getAppSettingString).mockResolvedValue(null)

    const result = await extractRecipeFromText('some text')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('API key not configured')

    // Restore default mocks
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'get_scraping_config') {
        return Promise.resolve({ data: { api_key: 'sk-ant-test-key', provider: 'anthropic', model: null }, error: null })
      }
      if (fn === 'check_scrape_rate_limit') {
        return Promise.resolve({ data: { allowed: true, remaining: 9, retry_after_sec: 0 }, error: null })
      }
      return Promise.resolve({ data: null, error: { message: 'Unknown function' } })
    })
    vi.mocked(getAppSettingString).mockImplementation((key: string) => {
      if (key === 'scraping.api_key') return Promise.resolve('sk-ant-test-key')
      return Promise.resolve(null)
    })
  })

  it('returns an error when the AI cannot find a recipe in the text', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({ error: 'No recipe found in this text' }) }],
      }),
    })

    const result = await extractRecipeFromText('This is not a recipe.')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('No recipe found in this text')
  })
})

// ─── extractRecipesFromUrls ────────────────────────────────────────────────────

describe('extractRecipesFromUrls', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
    _resetScraperCache()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    _resetScraperCache()
  })

  it('processes each URL and returns a BatchItemState array', async () => {
    const urls = [
      'https://example.com/recipe/pasta',
      'https://example.com/recipe/soup',
    ]

    // Each URL: page fetch + AI call
    mockFetch
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('<html></html>') })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify({ ...validRecipePayload, name: 'Pasta' }) }] }) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('<html></html>') })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify({ ...validRecipePayload, name: 'Soup' }) }] }) })

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

  it('calls onProgress with initial pending state, then loading, then done/error', async () => {
    const urls = ['https://example.com/recipe/pasta']

    mockFetch
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('<html></html>') })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify(validRecipePayload) }] }) })

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

    mockFetch
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('<html></html>') })
      .mockResolvedValueOnce({ ok: false, status: 500, json: vi.fn().mockResolvedValue({}) })

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
        return Promise.resolve({ ok: true, text: vi.fn().mockResolvedValue('<html></html>') })
      })
      .mockImplementationOnce(() => {
        callOrder.push(2)
        return Promise.resolve({ ok: true, json: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify(validRecipePayload) }] }) })
      })
      .mockImplementationOnce(() => {
        callOrder.push(3)
        return Promise.resolve({ ok: true, text: vi.fn().mockResolvedValue('<html></html>') })
      })
      .mockImplementationOnce(() => {
        callOrder.push(4)
        return Promise.resolve({ ok: true, json: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify(validRecipePayload) }] }) })
      })

    await extractRecipesFromUrls(urls, () => {})

    // First URL's fetches (1, 2) must complete before second URL's fetches (3, 4)
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

// ─── localStorage helpers ─────────────────────────────────────────────────────
// jsdom 29 + fake-indexeddb/auto can leave localStorage in a broken state.
// Stub it with a real Map-backed implementation for these tests.

