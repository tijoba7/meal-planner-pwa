import { test, expect, type Page } from '@playwright/test'

/**
 * E2E tests for recipe import from URL.
 *
 * The import flow calls https://api.anthropic.com/v1/messages directly from
 * the browser. In E2E tests we:
 *   1. Inject a fake Supabase session so ProtectedRoute renders the app.
 *   2. Mock the app_settings Supabase endpoint to return an admin API key.
 *   3. Intercept the Anthropic API with page.route() and return a fixed recipe.
 *   4. Optionally block the page-fetch (CORS preflight) to keep tests hermetic.
 *
 * Tests that don't need the mocked API (e.g. no-key gate, JSON-LD import)
 * skip the route intercept.
 */

const RUN_ID = Date.now()

// Supabase JS v2 storage key — derived from VITE_SUPABASE_URL='http://localhost:54321'
const SUPABASE_STORAGE_KEY = 'sb-localhost-auth-token'

function buildFakeSession(email = 'e2e@test.local') {
  return {
    access_token: 'fake-e2e-access-token',
    refresh_token: 'fake-e2e-refresh-token',
    token_type: 'bearer',
    expires_in: 365 * 24 * 3600,
    expires_at: Math.floor(Date.now() / 1000) + 365 * 24 * 3600,
    user: {
      id: 'e2e00000-0000-0000-0000-000000000001',
      aud: 'authenticated',
      role: 'authenticated',
      email,
      email_confirmed_at: '2024-01-01T00:00:00.000Z',
      phone: '',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
    },
  }
}

// ── Mock data ────────────────────────────────────────────────────────────────

const MOCK_RECIPE = {
  name: `E2E Imported Recipe ${RUN_ID}`,
  description: 'A test recipe extracted by the mock Claude API.',
  recipeYield: '4',
  prepTime: 'PT10M',
  cookTime: 'PT30M',
  recipeIngredient: [
    { name: 'Flour', amount: 2, unit: 'cups' },
    { name: 'Eggs', amount: 3, unit: '' },
  ],
  recipeInstructions: [
    { '@type': 'HowToStep', text: 'Mix flour and eggs.' },
    { '@type': 'HowToStep', text: 'Bake at 180°C for 30 minutes.' },
  ],
  keywords: ['baking', 'easy'],
  url: 'https://example.com/recipe/test',
  author: 'Test Chef',
  recipeCategory: 'Dessert',
  recipeCuisine: 'French',
}

/** Mock the Anthropic messages API to return MOCK_RECIPE as the Claude response. */
async function mockAnthropicApi(page: Page) {
  await page.route('https://api.anthropic.com/v1/messages', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'msg_mock',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: JSON.stringify(MOCK_RECIPE) }],
        model: 'claude-haiku-4-5-20251001',
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 200 },
      }),
    })
  })
}

/** Inject a fake Supabase session, admin API key config, and dismiss onboarding. */
async function setApiKey(page: Page) {
  const session = buildFakeSession()
  await page.addInitScript(
    ({ key, sessionJson }) => {
      localStorage.setItem('mise_onboarding_done', '1')
      localStorage.setItem(key, sessionJson)
    },
    { key: SUPABASE_STORAGE_KEY, sessionJson: JSON.stringify(session) },
  )
  await page.route('**/auth/v1/user**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session.user),
    }),
  )
  await page.route('**/auth/v1/token**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session),
    }),
  )
  // Mock admin scraping API key from app_settings table
  await page.route('**/rest/v1/app_settings*', (route) => {
    const url = route.request().url()
    if (url.includes('scraping.api_key')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ value: 'test-key-e2e-do-not-use' }),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(null),
    })
  })
}

// ── Tests: No API key gate ────────────────────────────────────────────────────

test.describe('Recipe Import — no admin key', () => {
  test.beforeEach(async ({ page }) => {
    const session = buildFakeSession()
    // Inject session but do NOT configure an admin API key — tests the no-key gate
    await page.addInitScript(
      ({ key, sessionJson }) => {
        localStorage.setItem('mise_onboarding_done', '1')
        localStorage.setItem(key, sessionJson)
      },
      { key: SUPABASE_STORAGE_KEY, sessionJson: JSON.stringify(session) },
    )
    await page.route('**/auth/v1/user**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(session.user),
      }),
    )
    await page.route('**/auth/v1/token**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(session),
      }),
    )
    // Mock app_settings to return no admin key
    await page.route('**/rest/v1/app_settings*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(null),
      }),
    )
  })

  test('shows API key not configured message when no admin key exists', async ({ page }) => {
    await page.goto('/recipes/import')
    await expect(page.getByText(/AI API key not configured/i)).toBeVisible()
  })

  test('import form textarea is not shown without an admin key', async ({ page }) => {
    await page.goto('/recipes/import')
    await expect(page.getByRole('textbox', { name: /Recipe URL or text/i })).not.toBeVisible()
  })
})

// ── Tests: URL import with mocked Claude ─────────────────────────────────────

test.describe('Recipe Import — URL import', () => {
  test.beforeEach(async ({ page }) => {
    await setApiKey(page)
  })

  test('shows import form when an API key is present', async ({ page }) => {
    await page.goto('/recipes/import')
    await expect(page.getByRole('textbox', { name: /Recipe URL or text/i })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Import', exact: true })).toBeVisible()
  })

  test('Import button is disabled when input is empty', async ({ page }) => {
    await page.goto('/recipes/import')
    await expect(page.getByRole('button', { name: 'Import', exact: true })).toBeDisabled()
  })

  test('shows loading state while extracting', async ({ page }) => {
    // Use a never-resolving route to catch the loading UI
    await page.route('https://api.anthropic.com/v1/messages', () => {
      // intentionally never fulfilled — test only checks loading state appears
    })
    // Block the page-fetch too so only the mock controls timing
    await page.route('https://example.com/recipe/loading-test', (route) => route.abort())

    await page.goto('/recipes/import')
    await page.getByRole('textbox', { name: /Recipe URL or text/i }).fill('https://example.com/recipe/loading-test')
    await page.getByRole('button', { name: 'Import', exact: true }).click()

    await expect(page.getByRole('status', { name: /Extracting recipe/i })).toBeVisible()
  })

  test('shows extracted recipe for review after successful extraction', async ({ page }) => {
    await mockAnthropicApi(page)
    await page.route('https://example.com/recipe/test', (route) => route.abort())

    await page.goto('/recipes/import')
    await page.getByRole('textbox', { name: /Recipe URL or text/i }).fill('https://example.com/recipe/test')
    await page.getByRole('button', { name: 'Import', exact: true }).click()

    await expect(page.getByText('Recipe extracted! Review before saving.')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('heading', { level: 3, name: MOCK_RECIPE.name })).toBeVisible()
    await expect(page.getByText('Flour', { exact: true })).toBeVisible()
    await expect(page.getByText('Mix flour and eggs.')).toBeVisible()
  })

  test('shows author and metadata in the review panel', async ({ page }) => {
    await mockAnthropicApi(page)
    await page.route('https://example.com/recipe/test', (route) => route.abort())

    await page.goto('/recipes/import')
    await page.getByRole('textbox', { name: /Recipe URL or text/i }).fill('https://example.com/recipe/test')
    await page.getByRole('button', { name: 'Import', exact: true }).click()

    await expect(page.getByText(/by Test Chef/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Serves 4/i)).toBeVisible()
  })

  test('saving an imported recipe navigates to the detail page', async ({ page }) => {
    await mockAnthropicApi(page)
    await page.route('https://example.com/recipe/test', (route) => route.abort())

    await page.goto('/recipes/import')
    await page.getByRole('textbox', { name: /Recipe URL or text/i }).fill('https://example.com/recipe/test')
    await page.getByRole('button', { name: 'Import', exact: true }).click()

    await expect(page.getByText('Recipe extracted! Review before saving.')).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: 'Save Recipe' }).click()

    // Should redirect to the recipe detail page
    await expect(page).toHaveURL(/recipes\/[^/]+$/)
    await expect(page.getByRole('heading', { name: MOCK_RECIPE.name })).toBeVisible()
  })

  test('saved imported recipe appears in the recipes list', async ({ page }) => {
    await mockAnthropicApi(page)
    await page.route('https://example.com/recipe/test', (route) => route.abort())

    await page.goto('/recipes/import')
    await page.getByRole('textbox', { name: /Recipe URL or text/i }).fill('https://example.com/recipe/test')
    await page.getByRole('button', { name: 'Import', exact: true }).click()

    await expect(page.getByText('Recipe extracted! Review before saving.')).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: 'Save Recipe' }).click()
    await expect(page).toHaveURL(/recipes\/[^/]+$/)

    // Navigate to the recipes list and verify it appears
    await page.goto('/recipes')
    await expect(page.getByRole('link', { name: new RegExp(MOCK_RECIPE.name) })).toBeVisible()
  })

  test('"Try another" resets the form after extraction', async ({ page }) => {
    await mockAnthropicApi(page)
    await page.route('https://example.com/recipe/test', (route) => route.abort())

    await page.goto('/recipes/import')
    await page.getByRole('textbox', { name: /Recipe URL or text/i }).fill('https://example.com/recipe/test')
    await page.getByRole('button', { name: 'Import', exact: true }).click()

    await expect(page.getByText('Recipe extracted! Review before saving.')).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: 'Try another' }).click()

    // Form is reset — textarea is visible again and empty
    const input = page.getByRole('textbox', { name: /Recipe URL or text/i })
    await expect(input).toBeVisible()
    await expect(input).toHaveValue('')
  })

  test('shows error message when API returns an error', async ({ page }) => {
    await page.route('https://api.anthropic.com/v1/messages', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { type: 'authentication_error', message: 'Invalid API key' } }),
      })
    })
    await page.route('https://example.com/recipe/test', (route) => route.abort())

    await page.goto('/recipes/import')
    await page.getByRole('textbox', { name: /Recipe URL or text/i }).fill('https://example.com/recipe/test')
    await page.getByRole('button', { name: 'Import', exact: true }).click()

    // An error message should appear (either inline or as a toast)
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10000 })
  })
})

// ── Tests: JSON-LD import ────────────────────────────────────────────────────

test.describe('Recipe Import — JSON-LD', () => {
  test.beforeEach(async ({ page }) => {
    await setApiKey(page)
  })

  test('can import a recipe from JSON-LD pasted as text', async ({ page }) => {
    const jsonLdName = `JSON-LD Recipe ${RUN_ID}`
    const jsonLd = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Recipe',
      name: jsonLdName,
      description: 'A test JSON-LD recipe.',
      recipeYield: '2',
      prepTime: 'PT5M',
      cookTime: 'PT20M',
      recipeIngredient: ['200g pasta', '50g cheese'],
      recipeInstructions: [
        { '@type': 'HowToStep', text: 'Boil the pasta.' },
        { '@type': 'HowToStep', text: 'Add cheese and serve.' },
      ],
    })

    await page.goto('/recipes/import')

    await page.getByRole('textbox', { name: /Recipe URL or text/i }).fill(jsonLd)
    await page.getByRole('button', { name: 'Import', exact: true }).click()

    await expect(page.getByText('Recipe extracted! Review before saving.')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('heading', { level: 3, name: jsonLdName })).toBeVisible()

    await page.getByRole('button', { name: 'Save Recipe' }).click()
    await expect(page).toHaveURL(/recipes\/[^/]+$/)
    await expect(page.getByRole('heading', { name: jsonLdName })).toBeVisible()
  })
})
