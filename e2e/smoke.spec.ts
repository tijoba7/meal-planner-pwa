import { test, expect } from './fixtures'

/**
 * Smoke tests — verify the app loads and key pages are reachable.
 *
 * These tests run against the live dev server and don't manipulate IndexedDB.
 * They serve as a fast gate: if any of these fail, something fundamental is broken.
 */

test.describe('App smoke tests', () => {
  test('recipes page loads', async ({ recipesPage }) => {
    await recipesPage.goto()
    await expect(recipesPage.heading).toBeVisible()
  })

  test('planner page loads', async ({ plannerPage }) => {
    await plannerPage.goto()
    await expect(plannerPage.heading).toBeVisible()
  })

  test('shopping list page loads', async ({ shoppingPage }) => {
    await shoppingPage.goto()
    await expect(shoppingPage.heading).toBeVisible()
  })

  test('navigation between pages works', async ({ page }) => {
    await page.goto('/')

    // Navigate to Planner via nav link
    await page.getByRole('link', { name: /Plan/i }).click()
    await expect(page).toHaveURL(/meal-plan/)

    // Navigate to Shopping via nav link
    await page.getByRole('link', { name: /Shop/i }).click()
    await expect(page).toHaveURL(/shopping/)

    // Navigate back to Recipes via the nav sidebar link (exact match)
    await page.getByRole('link', { name: 'Recipes', exact: true }).click()
    await expect(page).toHaveURL('/recipes')
  })

  test('404 page renders for unknown routes', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-xyz')
    await expect(page.getByText('404')).toBeVisible()
  })
})
