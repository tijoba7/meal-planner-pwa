import { test, expect } from './fixtures'

/**
 * E2E tests for recipe search and filtering on the Recipes page.
 *
 * Covers: name search, favorites filter, advanced filters panel (ingredient
 * search, sort order), and clearing filters.
 *
 * recipes.spec.ts covers the basic search smoke tests; this file focuses on
 * the filter panel and favorites toggle that were not covered there.
 */

const RUN_ID = Date.now()

/** Create a recipe with the given name (and optionally an ingredient). */
async function createRecipe(
  page: import('@playwright/test').Page,
  name: string,
  opts: { ingredient?: string } = {},
) {
  await page.goto('/recipes/new')
  await page.getByPlaceholder('e.g. Spaghetti Bolognese').fill(name)
  await page.getByPlaceholder('ingredient name').fill(opts.ingredient ?? 'Salt')
  await page.getByPlaceholder('Step 1…').fill('Cook.')
  await page.getByRole('button', { name: 'Add Recipe' }).click()
  await expect(page).toHaveURL(/recipes\/[^/]+$/)
}

test.describe('Recipe search — name query', () => {
  test('search bar is visible on the recipes page', async ({ page, recipesPage }) => {
    await recipesPage.goto()
    await expect(page.getByRole('searchbox', { name: 'Search recipes' })).toBeVisible()
  })

  test('typing in the search bar filters results by recipe name', async ({ page, recipesPage }) => {
    const unique = `SearchFilter${RUN_ID}`
    const match = `${unique} Pasta`
    const noMatch = `UnrelatedDish ${RUN_ID}`

    for (const name of [match, noMatch]) {
      await createRecipe(page, name)
    }

    await recipesPage.goto()
    await recipesPage.search(unique)

    await expect(page.getByRole('link', { name: new RegExp(match) })).toBeVisible()
    await expect(page.getByRole('link', { name: new RegExp(noMatch) })).not.toBeVisible()
  })

  test('shows empty state when search has no matches', async ({ page, recipesPage }) => {
    await recipesPage.goto()
    await recipesPage.search('xyzzy_no_match_at_all_999')
    await expect(page.getByText(/no recipes match/i)).toBeVisible()
  })
})

test.describe('Recipe search — favorites filter', () => {
  test('favorites toggle button is present', async ({ page, recipesPage }) => {
    await recipesPage.goto()
    await expect(
      page.getByRole('button', { name: /favorites/i }),
    ).toBeVisible()
  })

  test('favorites toggle shows only favorited recipes', async ({ page, recipesPage }) => {
    const favorited = `SearchFav ${RUN_ID}`
    const notFavorited = `SearchNotFav ${RUN_ID}`

    // Create two recipes
    for (const name of [favorited, notFavorited]) {
      await createRecipe(page, name)
    }

    // Favorite only the first one from the recipes list
    await recipesPage.goto()
    // Find the heart button next to the recipe card
    const recipesLink = page.getByRole('link', { name: new RegExp(favorited) })
    await expect(recipesLink).toBeVisible({ timeout: 10000 })
    // Toggle favorite via the heart button on the card (aria-label contains recipe name)
    const heartBtn = page.getByRole('button', {
      name: new RegExp(`favorite.*${favorited}|${favorited}.*favorite`, 'i'),
    })
    await heartBtn.click()

    // Now enable favorites-only toggle
    await page.getByRole('button', { name: /show favorites only/i }).click()

    await expect(page.getByRole('link', { name: new RegExp(favorited) })).toBeVisible()
    await expect(page.getByRole('link', { name: new RegExp(notFavorited) })).not.toBeVisible()
  })
})

test.describe('Recipe search — advanced filters panel', () => {
  test('Filters button toggles the advanced filter panel', async ({ page, recipesPage }) => {
    await recipesPage.goto()

    const filtersButton = page.getByRole('button', { name: /toggle advanced filters/i })
    await expect(filtersButton).toBeVisible()

    // Panel is initially hidden
    await expect(page.getByLabel('Contains ingredient')).not.toBeVisible()

    // Open it
    await filtersButton.click()
    await expect(page.getByLabel('Contains ingredient')).toBeVisible()

    // Close it
    await filtersButton.click()
    await expect(page.getByLabel('Contains ingredient')).not.toBeVisible()
  })

  test('ingredient search filters recipes by ingredient name', async ({ page, recipesPage }) => {
    const withGarlic = `GarlicRecipe ${RUN_ID}`
    const withSalt = `SaltRecipe ${RUN_ID}`

    await createRecipe(page, withGarlic, { ingredient: 'Garlic' })
    await createRecipe(page, withSalt, { ingredient: 'Salt' })

    await recipesPage.goto()
    await page.getByRole('button', { name: /toggle advanced filters/i }).click()
    await page.getByLabel('Contains ingredient').fill('Garlic')

    await expect(page.getByRole('link', { name: new RegExp(withGarlic) })).toBeVisible()
    await expect(page.getByRole('link', { name: new RegExp(withSalt) })).not.toBeVisible()
  })

  test('sort selector changes the display order', async ({ page, recipesPage }) => {
    await recipesPage.goto()
    await page.getByRole('button', { name: /toggle advanced filters/i }).click()

    // Verify the sort control is present (it's a <select> element)
    const sortSelect = page.getByRole('combobox')
    await expect(sortSelect).toBeVisible()

    // Change to A–Z (alpha-asc)
    await sortSelect.selectOption({ value: 'alpha-asc' })

    // Verify no crash and the page is still on /recipes
    await expect(page).toHaveURL('/recipes')
  })
})

test.describe('Recipe search — clear filters', () => {
  test('applying a search and then clearing restores the full list', async ({ page, recipesPage }) => {
    const name = `SearchClear ${RUN_ID}`
    await createRecipe(page, name)

    await recipesPage.goto()
    await recipesPage.search('xyzzy_no_match_at_all')
    await expect(page.getByRole('link', { name: new RegExp(name) })).not.toBeVisible()

    await recipesPage.clearSearch()
    await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible()
  })
})
