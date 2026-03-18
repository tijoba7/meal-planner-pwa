import { test, expect } from './fixtures'

/**
 * E2E tests for the recipe CRUD lifecycle.
 *
 * Covers: create → list → detail → edit → delete → search.
 * Each test uses a unique recipe name (timestamped) to avoid cross-test
 * pollution in IndexedDB.
 */

// Unique suffix per test run so parallel runs don't collide.
const RUN_ID = Date.now()

/**
 * On mobile, Edit and Delete are hidden behind the "More options" sheet.
 * Opens the sheet if the button is present.
 */
async function openMoreOptionsIfMobile(page: import('@playwright/test').Page) {
  const moreBtn = page.getByRole('button', { name: 'More options' })
  // On desktop the button is CSS-hidden (md:hidden), so isVisible returns false immediately.
  // On mobile the page may still be rendering — use a longer timeout so we catch it once
  // the RecipeDetailPage component has mounted.
  const isVisible = await moreBtn.isVisible({ timeout: 8000 }).catch(() => false)
  if (isVisible) {
    await moreBtn.click()
    // Wait for the sheet to be present in the DOM
    await page.locator('[aria-label="Recipe options"]').waitFor({ state: 'visible', timeout: 5000 })
  }
}

/**
 * Helper: fill in and submit the recipe form.
 * Assumes the page is already on /recipes/new or /recipes/:id/edit.
 */
async function fillRecipeForm(
  page: import('@playwright/test').Page,
  opts: {
    name: string
    ingredient?: string
    step?: string
  },
) {
  await page.getByPlaceholder('e.g. Spaghetti Bolognese').fill(opts.name)

  const ingredient = opts.ingredient ?? 'Olive oil'
  await page.getByPlaceholder('ingredient name').fill(ingredient)

  const step = opts.step ?? 'Mix all ingredients and cook for 10 minutes.'
  await page.getByPlaceholder('Step 1…').fill(step)
}

test.describe('Recipe CRUD', () => {
  test('can create a new recipe', async ({ page, recipesPage }) => {
    const name = `E2E Create ${RUN_ID}`

    await recipesPage.goto()
    await recipesPage.clickAddRecipe()

    await expect(page).toHaveURL(/recipes\/new/)
    await expect(page.getByRole('heading', { name: /new recipe/i })).toBeVisible()

    await fillRecipeForm(page, { name })
    await page.getByRole('button', { name: 'Add Recipe' }).click()

    // After creation, should land on the detail page
    await expect(page).toHaveURL(/recipes\/[^/]+$/)
    await expect(page.getByRole('heading', { name })).toBeVisible()
  })

  test('created recipe appears in the list', async ({ page, recipesPage }) => {
    const name = `E2E List ${RUN_ID}`

    // Create it first
    await page.goto('/recipes/new')
    await fillRecipeForm(page, { name })
    await page.getByRole('button', { name: 'Add Recipe' }).click()
    await expect(page).toHaveURL(/recipes\/[^/]+$/)

    // Then verify it shows in the list
    await recipesPage.goto()
    await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible()
  })

  test('can view recipe detail page', async ({ page, recipesPage }) => {
    const name = `E2E Detail ${RUN_ID}`
    const ingredient = 'Garlic'
    const step = 'Chop the garlic finely.'

    // Create recipe
    await page.goto('/recipes/new')
    await fillRecipeForm(page, { name, ingredient, step })
    await page.getByRole('button', { name: 'Add Recipe' }).click()
    await expect(page).toHaveURL(/recipes\/[^/]+$/)

    // Check detail page contents
    await expect(page.getByRole('heading', { name })).toBeVisible()
    await expect(page.getByText(ingredient, { exact: true })).toBeVisible()
    await expect(page.getByText(step)).toBeVisible()

    // Edit and Delete actions should be accessible (behind "More options" on mobile)
    const moreOptionsBtn = page.getByRole('button', { name: 'More options' })
    if (await moreOptionsBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(moreOptionsBtn).toBeVisible()
    } else {
      await expect(page.getByRole('link', { name: /edit/i })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible()
    }
  })

  test('can edit a recipe', async ({ page }) => {
    const originalName = `E2E Edit Original ${RUN_ID}`
    const updatedName = `E2E Edit Updated ${RUN_ID}`

    // Create original
    await page.goto('/recipes/new')
    await fillRecipeForm(page, { name: originalName })
    await page.getByRole('button', { name: 'Add Recipe' }).click()
    await expect(page).toHaveURL(/recipes\/[^/]+$/)
    // Wait for the detail page to fully render before interacting with action buttons
    await expect(page.getByRole('heading', { name: originalName })).toBeVisible()

    // Navigate to edit — open "More options" first on mobile
    await openMoreOptionsIfMobile(page)
    await page.getByRole('link', { name: /edit( recipe)?/i }).click()
    await expect(page).toHaveURL(/recipes\/.+\/edit/)
    await expect(page.getByRole('heading', { name: /edit recipe/i })).toBeVisible()

    // Update name
    const nameInput = page.getByPlaceholder('e.g. Spaghetti Bolognese')
    await nameInput.clear()
    await nameInput.fill(updatedName)
    await page.getByRole('button', { name: 'Save Changes' }).click()

    // Should land back on detail page with updated name
    await expect(page).toHaveURL(/recipes\/[^/]+$/)
    await expect(page.getByRole('heading', { name: updatedName })).toBeVisible()
  })

  test('can delete a recipe', async ({ page, recipesPage }) => {
    const name = `E2E Delete ${RUN_ID}`

    // Create recipe
    await page.goto('/recipes/new')
    await fillRecipeForm(page, { name })
    await page.getByRole('button', { name: 'Add Recipe' }).click()
    await expect(page).toHaveURL(/recipes\/[^/]+$/)
    // Wait for the detail page to fully render before interacting with action buttons
    await expect(page.getByRole('heading', { name })).toBeVisible()

    // Delete it via confirm dialog — open "More options" first on mobile
    await openMoreOptionsIfMobile(page)
    await page.getByRole('button', { name: /^delete( recipe)?$/i }).first().click()
    await expect(page.getByText('Delete recipe?')).toBeVisible()
    // Confirm delete in the dialog
    await page.getByRole('button', { name: /^delete$/i }).last().click()

    // Should redirect to recipes list
    await expect(page).toHaveURL('/')

    // Recipe should no longer appear in the list
    await expect(page.getByRole('link', { name: new RegExp(name) })).not.toBeVisible()
  })

  test('delete confirmation dialog can be cancelled', async ({ page }) => {
    const name = `E2E DeleteCancel ${RUN_ID}`

    await page.goto('/recipes/new')
    await fillRecipeForm(page, { name })
    await page.getByRole('button', { name: 'Add Recipe' }).click()
    await expect(page).toHaveURL(/recipes\/[^/]+$/)
    // Wait for the detail page to fully render before interacting with action buttons
    await expect(page.getByRole('heading', { name })).toBeVisible()

    // Open delete dialog then cancel — open "More options" first on mobile
    await openMoreOptionsIfMobile(page)
    await page.getByRole('button', { name: /^delete( recipe)?$/i }).first().click()
    await expect(page.getByText('Delete recipe?')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Dialog dismissed; still on detail page with recipe intact
    await expect(page.getByText('Delete recipe?')).not.toBeVisible()
    await expect(page.getByRole('heading', { name })).toBeVisible()
  })
})

test.describe('Recipe search', () => {
  test('search filters recipes by name', async ({ page, recipesPage }) => {
    const uniquePart = `SearchTest${RUN_ID}`
    const recipeName = `${uniquePart} Pasta`
    const otherName = `UnrelatedDish${RUN_ID}`

    // Create two recipes
    for (const name of [recipeName, otherName]) {
      await page.goto('/recipes/new')
      await fillRecipeForm(page, { name })
      await page.getByRole('button', { name: 'Add Recipe' }).click()
      await expect(page).toHaveURL(/recipes\/[^/]+$/)
    }

    await recipesPage.goto()
    await recipesPage.search(uniquePart)

    await expect(page.getByRole('link', { name: new RegExp(recipeName) })).toBeVisible()
    await expect(page.getByRole('link', { name: new RegExp(otherName) })).not.toBeVisible()
  })

  test('shows empty state when search has no matches', async ({ page, recipesPage }) => {
    await recipesPage.goto()
    await recipesPage.search('zzznomatchxyz99999')
    await expect(page.getByText(/no recipes match/i)).toBeVisible()
  })

  test('clearing search restores full list', async ({ page, recipesPage }) => {
    const name = `E2E ClearSearch ${RUN_ID}`

    await page.goto('/recipes/new')
    await fillRecipeForm(page, { name })
    await page.getByRole('button', { name: 'Add Recipe' }).click()
    await expect(page).toHaveURL(/recipes\/[^/]+$/)

    await recipesPage.goto()
    await recipesPage.search('zzznomatchxyz99999')
    await expect(page.getByRole('link', { name: new RegExp(name) })).not.toBeVisible()

    await recipesPage.clearSearch()
    await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible()
  })
})
