import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * Accessibility audit tests — WCAG 2.1 AA compliance.
 *
 * Uses @axe-core/playwright to run automated accessibility checks on each
 * key page. These tests catch:
 *  - Missing accessible names (buttons, inputs, images)
 *  - Colour contrast violations (requires a live browser)
 *  - Missing form labels and landmarks
 *  - ARIA misuse
 *  - Focus management and keyboard navigation gaps
 *
 * Automated checks cover ~30% of WCAG success criteria; the remaining
 * issues require manual testing (screen reader, keyboard-only navigation).
 * See the "Known limitations" section at the bottom of this file.
 */

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

test.beforeEach(async ({ page }) => {
  const session = buildFakeSession()

  // Inject authenticated session and dismiss the onboarding wizard so they
  // don't block or distort the axe scan results.
  const userId = session.user.id
  await page.addInitScript(
    ({ key, sessionJson, userId }) => {
      localStorage.setItem('braisely_onboarding_done', '1')
      localStorage.setItem(key, sessionJson)
      localStorage.setItem(
        `braisely:migration:${userId}`,
        JSON.stringify({ skipped: true, skippedAt: new Date().toISOString() }),
      )
    },
    { key: SUPABASE_STORAGE_KEY, sessionJson: JSON.stringify(session), userId },
  )

  // Mock Supabase API calls — the fake server at localhost:54321 is not running.
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
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run an axe scan on the current page and assert no violations.
 * Tags: wcag2a, wcag2aa, wcag21aa (WCAG 2.1 Level AA).
 */
async function assertNoViolations(page: import('@playwright/test').Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()

  if (results.violations.length > 0) {
    const summary = results.violations
      .map(
        (v) =>
          `[${v.impact?.toUpperCase()}] ${v.id}: ${v.description}\n` +
          v.nodes.slice(0, 2).map((n) => `  → ${n.html}`).join('\n'),
      )
      .join('\n\n')
    throw new Error(`${label} — ${results.violations.length} axe violation(s):\n\n${summary}`)
  }

  expect(results.violations).toHaveLength(0)
}

// ---------------------------------------------------------------------------
// Recipes page
// ---------------------------------------------------------------------------

test.describe('Accessibility — Recipes page', () => {
  test('empty state has no violations', async ({ page }) => {
    await page.goto('/recipes')
    await page.waitForSelector('h2', { timeout: 15000 })
    await assertNoViolations(page, 'Recipes page (empty state)')
  })
})

// ---------------------------------------------------------------------------
// Meal Planner page
// ---------------------------------------------------------------------------

test.describe('Accessibility — Meal Planner page', () => {
  test('planner grid has no violations', async ({ page }) => {
    await page.goto('/meal-plan')
    await page.waitForSelector('h2', { timeout: 15000 })
    await assertNoViolations(page, 'Meal Planner page')
  })
})

// ---------------------------------------------------------------------------
// Shopping Lists page
// ---------------------------------------------------------------------------

test.describe('Accessibility — Shopping Lists page', () => {
  test('empty state has no violations', async ({ page }) => {
    await page.goto('/shopping')
    await page.waitForSelector('h2', { timeout: 15000 })
    await assertNoViolations(page, 'Shopping Lists page (empty state)')
  })

  test('new list dialog has no violations', async ({ page }) => {
    await page.goto('/shopping')
    await page.getByRole('button', { name: /new shopping list/i }).click()
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 })
    await assertNoViolations(page, 'Shopping Lists — new list dialog')
  })
})

// ---------------------------------------------------------------------------
// Recipe Form page
// ---------------------------------------------------------------------------

test.describe('Accessibility — Recipe Form page', () => {
  test('new recipe form has no violations', async ({ page }) => {
    await page.goto('/recipes/new')
    await page.waitForSelector('form', { timeout: 15000 })
    await assertNoViolations(page, 'Recipe Form page (new)')
  })
})

// ---------------------------------------------------------------------------
// Discover page
// ---------------------------------------------------------------------------

test.describe('Accessibility — Discover page', () => {
  test('discover page has no violations', async ({ page }) => {
    await page.goto('/discover')
    // When Supabase is not configured the page shows a "Connect to Supabase" message
    // instead of the h2/tablist; wait for either state to be ready.
    // Scope to main to avoid matching the sidebar tagline <p> that is CSS-hidden on mobile.
    await page.waitForSelector('main h2, [role="tablist"], main p', { timeout: 15000 })
    await assertNoViolations(page, 'Discover page')
  })
})

/*
 * Known limitations — issues that require manual testing:
 *
 * 1. Colour contrast in dark mode: axe runs in light mode only. Dark mode
 *    contrast ratios should be checked manually or with a separate dark-mode
 *    Playwright project.
 *
 * 2. Focus trap in modals: axe does not verify that Tab stays inside an open
 *    dialog. Manual keyboard testing required for the recipe picker, create
 *    list, and export modals.
 *
 * 3. Live region announcements: axe cannot test that toast messages and
 *    loading states are announced by screen readers. Use NVDA/VoiceOver
 *    manual testing for this.
 *
 * 4. Drag-and-drop in Planner: the meal slot drag-and-drop has no keyboard
 *    equivalent. This is a WCAG 2.1 SC 2.1.1 failure to address separately.
 *
 * 5. Recipe Import page: requires network access to a URL scraper and is
 *    excluded from this automated suite.
 */
