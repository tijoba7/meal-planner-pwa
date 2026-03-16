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

test.beforeEach(async ({ page }) => {
  // Dismiss the onboarding wizard so it doesn't block the audit
  await page.addInitScript(() => {
    localStorage.setItem('mise_onboarding_done', '1')
  })
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
    await page.goto('/')
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
    await page.waitForSelector('h2, [role="tablist"], p', { timeout: 15000 })
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
