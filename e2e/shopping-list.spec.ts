import { test, expect } from './fixtures'

/**
 * E2E tests for the Shopping List flow.
 *
 * Covers: create list (empty plan) → create from meal plan → check/uncheck items
 * → progress tracking → remove item → delete list.
 *
 * Tests that need real ingredients create a recipe, add it to this week's planner,
 * then generate a shopping list using the default date range (current week).
 * Each test uses a RUN_ID-scoped ingredient name to avoid cross-test pollution.
 */

const RUN_ID = Date.now()

/** Create a recipe with a single uniquely named ingredient. */
async function createRecipe(
  page: import('@playwright/test').Page,
  opts: { name: string; ingredient: string },
) {
  await page.goto('/recipes/new')
  await page.getByPlaceholder('e.g. Spaghetti Bolognese').fill(opts.name)
  await page.getByPlaceholder('ingredient name').fill(opts.ingredient)
  await page.getByPlaceholder('Step 1\u2026').fill('Cook everything.')
  await page.getByRole('button', { name: 'Add Recipe' }).click()
  await expect(page).toHaveURL(/recipes\/[^/]+$/)
}

/** Add a recipe to this week's planner (second day's Breakfast slot).
 *
 * We use the second day (nth 1) rather than the first because the planner
 * renders a Sunday-based week and stores dates as UTC-midnight. In UTC+
 * timezones this can shift the first day's stored date one day earlier than
 * the shopping list's startDate, causing aggregation to miss it. Day[1] is
 * always >= startDate for any realistic timezone.
 */
async function addRecipeToPlanner(
  page: import('@playwright/test').Page,
  plannerPage: import('./page-objects/PlannerPage').PlannerPageObject,
  recipeName: string,
) {
  await plannerPage.goto()
  await expect(plannerPage.heading).toBeVisible()

  // Navigate to the second day's Breakfast slot
  const breakfastSpan = page.locator('span', { hasText: 'Breakfast' }).nth(1)
  const addButton = breakfastSpan.locator('..').locator('..').getByText('Add recipe')
  await addButton.click()

  // Wait for recipes to load from IndexedDB before clicking.
  // dispatchEvent bypasses all actionability checks (position, viewport) —
  // needed because a success toast or the picker's own fixed overlay can
  // prevent a regular click from reaching the button on mobile viewports.
  const recipeButton = page.getByRole('button', { name: new RegExp(recipeName) })
  await expect(recipeButton).toBeVisible()
  await recipeButton.dispatchEvent('click')
  // Wait for the picker to close before continuing (ensures the DB write for
  // the meal plan entry completes before we navigate to the shopping page).
  await expect(recipeButton).not.toBeVisible()
}

/** Manually add an item to the currently open list detail view.
 *
 * This bypasses the planner entirely, which avoids slot-pollution across tests
 * that run in the same Playwright worker (they share IndexedDB state).
 */
async function addItemToList(
  page: import('@playwright/test').Page,
  itemName: string,
) {
  const addItemBtn = page.getByRole('button', { name: 'Add item' })
  await expect(addItemBtn).toBeVisible()
  await addItemBtn.click()
  await page.getByRole('textbox', { name: 'Item name' }).fill(itemName)
  // exact:true prevents matching "Add item" or any other "Add ..." button
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText(itemName, { exact: true })).toBeVisible()
}

// ---------------------------------------------------------------------------
// Create and view
// ---------------------------------------------------------------------------

test.describe('Shopping List — create and view', () => {
  test('shows heading and new list button', async ({ shoppingPage }) => {
    await shoppingPage.goto()
    await expect(shoppingPage.heading).toBeVisible()
    await expect(shoppingPage.newListButton).toBeVisible()
  })

  test('can create a list when no meals are planned (edge case: 0 items)', async ({
    page,
    shoppingPage,
  }) => {
    const name = `Empty Plan List ${RUN_ID}`

    await shoppingPage.goto()
    await shoppingPage.createList(name)

    // Detail view opens with the list name as heading
    await expect(page.getByRole('heading', { name })).toBeVisible()

    // No items — empty state message and 0-of-0 counter
    await expect(page.getByText('No items in this list')).toBeVisible()
    await expect(page.getByText('0 of 0 items checked')).toBeVisible()
  })

  test('created list appears in the list view', async ({ page, shoppingPage }) => {
    const name = `Visible List ${RUN_ID}`

    await shoppingPage.goto()
    await shoppingPage.createList(name)

    // Wait for the detail view to settle before navigating back
    await expect(page.getByRole('heading', { name })).toBeVisible()
    await page.getByText('All lists').click()

    await expect(page.getByRole('button', { name: new RegExp(`Open ${name}`) })).toBeVisible()
  })

  test('list card shows item count and progress bar', async ({ page, shoppingPage }) => {
    const name = `Count List ${RUN_ID}`

    await shoppingPage.goto()
    await shoppingPage.createList(name)

    await expect(page.getByRole('heading', { name })).toBeVisible()
    await page.getByText('All lists').click()

    // Card subtitle should mention "0 items"
    await expect(page.getByText(/0 item/)).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Generate from meal plan
// ---------------------------------------------------------------------------

test.describe('Shopping List — generate from meal plan', () => {
  test('aggregates ingredients from planned meals into the list', async ({
    page,
    shoppingPage,
    plannerPage,
  }) => {
    const recipeName = `E2E Shopping Recipe ${RUN_ID}`
    const ingredient = `ShopIngredient${RUN_ID}`
    const listName = `Meal Plan List ${RUN_ID}`

    await createRecipe(page, { name: recipeName, ingredient })
    await addRecipeToPlanner(page, plannerPage, recipeName)

    await shoppingPage.goto()
    await shoppingPage.createList(listName)

    // The unique ingredient should appear in the list
    await expect(page.getByText(ingredient, { exact: true })).toBeVisible()
  })

  test('list detail shows correct item count after generation', async ({
    page,
    shoppingPage,
    plannerPage,
  }) => {
    const recipeName = `E2E Count Recipe ${RUN_ID}`
    const ingredient = `CountIngredient${RUN_ID}`
    const listName = `Count Recipe List ${RUN_ID}`

    await createRecipe(page, { name: recipeName, ingredient })
    await addRecipeToPlanner(page, plannerPage, recipeName)

    await shoppingPage.goto()
    await shoppingPage.createList(listName)

    // At least 1 item should be unchecked (our ingredient)
    await expect(page.getByText(/0 of \d+ items checked/)).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Item interactions
//
// These tests add an item manually via the "Add item" button rather than
// going through the planner. This avoids both the planner slot-pollution
// problem (workers share IndexedDB) and the timezone UTC-midnight edge case.
// ---------------------------------------------------------------------------

test.describe('Shopping List — item interactions', () => {
  test('checking an item moves it to the Checked off section', async ({
    page,
    shoppingPage,
  }) => {
    const listName = `Check List ${RUN_ID}`
    const itemName = `CheckItem${RUN_ID}`

    await shoppingPage.goto()
    await shoppingPage.createList(listName)
    await addItemToList(page, itemName)

    await shoppingPage.checkItem(itemName)

    // "Checked off" section header should appear
    await expect(page.getByText('Checked off')).toBeVisible()
  })

  test('unchecking an item removes it from Checked off section', async ({
    page,
    shoppingPage,
  }) => {
    const listName = `Uncheck List ${RUN_ID}`
    const itemName = `UncheckItem${RUN_ID}`

    await shoppingPage.goto()
    await shoppingPage.createList(listName)
    await addItemToList(page, itemName)

    await shoppingPage.checkItem(itemName)
    await expect(page.getByText('Checked off')).toBeVisible()

    await shoppingPage.uncheckItem(itemName)

    // No checked items — "Checked off" header should disappear
    await expect(page.getByText('Checked off')).not.toBeVisible()
  })

  test('progress counter increments when an item is checked', async ({
    page,
    shoppingPage,
  }) => {
    const listName = `Progress List ${RUN_ID}`
    const itemName = `ProgressItem${RUN_ID}`

    await shoppingPage.goto()
    await shoppingPage.createList(listName)
    await addItemToList(page, itemName)

    // Before: 0 items done
    await expect(page.getByText(/0 of \d+ items checked/)).toBeVisible()

    await shoppingPage.checkItem(itemName)

    // After: at least 1 item done
    await expect(page.getByText(/^[1-9]\d* of \d+ items checked$/)).toBeVisible()
  })

  test('can remove an item from the list', async ({ page, shoppingPage }) => {
    const listName = `Remove List ${RUN_ID}`
    const itemName = `RemoveItem${RUN_ID}`

    await shoppingPage.goto()
    await shoppingPage.createList(listName)
    await addItemToList(page, itemName)

    await expect(page.getByText(itemName, { exact: true })).toBeVisible()

    await page.getByRole('button', { name: `Remove ${itemName}` }).click()

    await expect(page.getByText(itemName, { exact: true })).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Category grouping (MEA-100)
// ---------------------------------------------------------------------------

test.describe('Shopping List — category grouping', () => {
  test('known ingredient is auto-categorized into the correct section', async ({
    page,
    shoppingPage,
  }) => {
    const listName = `Category List ${RUN_ID}`

    await shoppingPage.goto()
    await shoppingPage.createList(listName)

    // Add a produce item — "apples" should match the Produce category
    await addItemToList(page, 'apples')

    // "Produce" section header should be visible
    await expect(page.getByRole('button', { name: /Produce/i })).toBeVisible()
    await expect(page.getByText('apples', { exact: true })).toBeVisible()
  })

  test('unknown ingredient defaults to Other section', async ({ page, shoppingPage }) => {
    const listName = `Other Category List ${RUN_ID}`
    const itemName = `UnknownItem${RUN_ID}`

    await shoppingPage.goto()
    await shoppingPage.createList(listName)
    await addItemToList(page, itemName)

    // "Other" section header should appear for unrecognized ingredients
    await expect(page.getByRole('button', { name: /Other/i })).toBeVisible()
    await expect(page.getByText(itemName, { exact: true })).toBeVisible()
  })

  test('category section is collapsible', async ({ page, shoppingPage }) => {
    const listName = `Collapse List ${RUN_ID}`

    await shoppingPage.goto()
    await shoppingPage.createList(listName)
    await addItemToList(page, 'apples')

    const sectionHeader = page.getByRole('button', { name: /Produce/i })
    await expect(sectionHeader).toBeVisible()

    // Collapse the section
    await sectionHeader.click()
    await expect(page.getByText('apples', { exact: true })).not.toBeVisible()

    // Expand again
    await sectionHeader.click()
    await expect(page.getByText('apples', { exact: true })).toBeVisible()
  })

  test('user can change an item category via inline selector', async ({ page, shoppingPage }) => {
    const listName = `Reclassify List ${RUN_ID}`

    await shoppingPage.goto()
    await shoppingPage.createList(listName)
    await addItemToList(page, 'apples')

    // Click the category badge to open the dropdown
    await page.getByRole('button', { name: /Change category for apples/i }).click()

    // Select "Pantry" from the dropdown
    await page.getByRole('combobox').selectOption('Pantry')

    // Item should now appear under Pantry
    await expect(page.getByRole('button', { name: /Pantry/i })).toBeVisible()
    await expect(page.getByText('apples', { exact: true })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Delete list
// ---------------------------------------------------------------------------

test.describe('Shopping List — delete', () => {
  test('can delete a shopping list from the list view', async ({ page, shoppingPage }) => {
    const name = `Delete Me ${RUN_ID}`

    await shoppingPage.goto()
    await shoppingPage.createList(name)

    // Wait for detail view, then go back to the list overview
    await expect(page.getByRole('heading', { name })).toBeVisible()
    await page.getByText('All lists').click()

    await expect(page.getByRole('button', { name: new RegExp(`Open ${name}`) })).toBeVisible()

    await shoppingPage.deleteList(name)

    await expect(page.getByRole('button', { name: new RegExp(`Open ${name}`) })).not.toBeVisible()
  })
})
