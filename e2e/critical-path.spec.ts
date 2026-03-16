import { test, expect } from './fixtures'

/**
 * Critical path E2E test — full user journey from recipe creation to shopping.
 *
 * This test chains the complete "happy path" that the app is built around:
 *   1. Create a recipe with an ingredient
 *   2. Assign it to a meal slot in the planner
 *   3. Generate a shopping list (aggregates ingredients from the plan)
 *   4. Check off an item
 *
 * This single test validates the cross-page data flow through IndexedDB and
 * is the primary gate for PR merges. If it fails, something fundamental
 * is broken.
 */

test('full critical path: create recipe → plan meal → generate shopping list → check item', async ({
  page,
  plannerPage,
  shoppingPage,
}) => {
  const RUN_ID = Date.now()
  const recipeName = `Critical Path Recipe ${RUN_ID}`
  const ingredient = `CriticalIngredient${RUN_ID}`
  const listName = `Critical Path List ${RUN_ID}`

  // ── Step 1: Create a recipe ─────────────────────────────────────────────
  await page.goto('/recipes/new')
  await page.getByPlaceholder('e.g. Spaghetti Bolognese').fill(recipeName)
  await page.getByPlaceholder('ingredient name').fill(ingredient)
  await page.getByPlaceholder('Step 1…').fill('Mix and cook for 20 minutes.')
  await page.getByRole('button', { name: 'Add Recipe' }).click()

  // Confirm we land on the detail page
  await expect(page).toHaveURL(/recipes\/[^/]+$/)
  await expect(page.getByRole('heading', { name: recipeName })).toBeVisible()

  // ── Step 2: Add the recipe to the meal planner ──────────────────────────
  await plannerPage.goto()
  await expect(plannerPage.heading).toBeVisible()

  // Use the second day's Breakfast slot to avoid UTC date-shift issues
  const breakfastSpan = page.locator('span', { hasText: 'Breakfast' }).nth(1)
  const addButton = breakfastSpan.locator('..').locator('..').getByText('Add recipe')
  await addButton.click()

  // Wait for IndexedDB to surface the recipe in the picker
  const recipeButton = page.getByRole('button', { name: new RegExp(recipeName) })
  await expect(recipeButton).toBeVisible({ timeout: 15000 })
  await recipeButton.click()

  // Picker closes; recipe link appears in the grid
  await expect(page.getByPlaceholder('Search recipes…')).not.toBeVisible()
  await expect(page.getByRole('link', { name: recipeName })).toBeVisible()

  // ── Step 3: Generate a shopping list from the plan ──────────────────────
  await shoppingPage.goto()
  await shoppingPage.createList(listName)

  // Detail view opens — the ingredient from our planned recipe should appear
  await expect(page.getByRole('heading', { name: listName })).toBeVisible()
  await expect(page.getByText(ingredient, { exact: true })).toBeVisible()

  // Progress counter starts at 0 checked
  await expect(page.getByText(/0 of \d+ items checked/)).toBeVisible()

  // ── Step 4: Check off the ingredient ───────────────────────────────────
  await shoppingPage.checkItem(ingredient)

  // Item moves to "Checked off" section and counter increments
  await expect(page.getByText('Checked off')).toBeVisible()
  await expect(page.getByText(/^[1-9]\d* of \d+ items checked$/)).toBeVisible()
})
