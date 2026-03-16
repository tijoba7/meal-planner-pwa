import { test, expect } from './fixtures'

/**
 * E2E tests for the meal planning flow.
 *
 * Covers: navigate to planner → assign recipe to slot → persist across reload
 * → remove recipe → navigate between weeks → verify week isolation.
 *
 * Each test run uses unique recipe names to avoid IndexedDB cross-test pollution.
 */

const RUN_ID = Date.now()

/**
 * Create a minimal recipe and return to the planner.
 * Assumes the page is already loaded (fixtures auto-dismiss onboarding).
 */
async function createRecipeAndGoToPlanner(
  page: import('@playwright/test').Page,
  recipeName: string,
) {
  await page.goto('/recipes/new')
  await page.getByPlaceholder('e.g. Spaghetti Bolognese').fill(recipeName)
  await page.getByPlaceholder('ingredient name').fill('Olive oil')
  await page.getByPlaceholder('Step 1…').fill('Mix and cook.')
  await page.getByRole('button', { name: 'Add Recipe' }).click()
  // Wait for redirect to detail page confirming save
  await expect(page).toHaveURL(/recipes\/[^/]+$/)
  await page.goto('/meal-plan')
  // Wait for the planner heading to appear, confirming the page is mounted
  await page.getByRole('heading', { name: 'Weekly Planner' }).waitFor()
}

test.describe('Meal planner — page load', () => {
  test('planner page loads with weekly heading', async ({ plannerPage }) => {
    await plannerPage.goto()
    await expect(plannerPage.heading).toBeVisible()
    // Week navigation buttons should be present
    await expect(plannerPage.prevWeekButton).toBeVisible()
    await expect(plannerPage.nextWeekButton).toBeVisible()
  })

  test('shows day columns for the current week', async ({ page, plannerPage }) => {
    await plannerPage.goto()
    // All 7 day names should appear (Mon–Sun)
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      await expect(page.getByRole('heading', { name: new RegExp(day) })).toBeVisible()
    }
  })

  test('each day has meal type labels', async ({ page, plannerPage }) => {
    await plannerPage.goto()
    for (const label of ['Breakfast', 'Lunch', 'Dinner', 'Snack']) {
      // Multiple instances (one per day), just check first is visible
      await expect(page.getByText(label).first()).toBeVisible()
    }
  })
})

test.describe('Meal planner — assign recipes', () => {
  test('can open the recipe picker for a meal slot', async ({ page, plannerPage }) => {
    const name = `Plan Picker ${RUN_ID}`
    await createRecipeAndGoToPlanner(page, name)

    // Open picker for Dinner slot
    await plannerPage.openRecipePicker({ mealLabel: 'Dinner' })

    // Picker dialog should show with search field and the recipe we created
    await expect(page.getByPlaceholder('Search recipes…')).toBeVisible()
    // Allow extra time for Dexie to load recipes into the picker
    await expect(page.getByText(name)).toBeVisible({ timeout: 15000 })
  })

  test('can search for a recipe in the picker', async ({ page, plannerPage }) => {
    const name = `Plan Search ${RUN_ID}`
    const otherName = `Unrelated Dish ${RUN_ID}`
    // Create two recipes
    for (const n of [name, otherName]) {
      await page.goto('/recipes/new')
      await page.getByPlaceholder('e.g. Spaghetti Bolognese').fill(n)
      await page.getByPlaceholder('ingredient name').fill('Salt')
      await page.getByPlaceholder('Step 1…').fill('Season and serve.')
      await page.getByRole('button', { name: 'Add Recipe' }).click()
      await expect(page).toHaveURL(/recipes\/[^/]+$/)
    }
    await page.goto('/meal-plan')

    await plannerPage.openRecipePicker({ mealLabel: 'Lunch' })
    // Wait for recipes to load before searching
    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible({ timeout: 15000 })
    await plannerPage.searchInPicker(`Plan Search`)

    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible()
    await expect(page.getByRole('button', { name: new RegExp(otherName) })).not.toBeVisible()
  })

  test('can assign a recipe to a meal slot', async ({ page, plannerPage }) => {
    const name = `Plan Assign ${RUN_ID}`
    await createRecipeAndGoToPlanner(page, name)

    await plannerPage.openRecipePicker({ mealLabel: 'Breakfast' })
    await plannerPage.selectRecipeInPicker(name)

    // Picker closes and recipe name appears in the planner grid
    await expect(page.getByPlaceholder('Search recipes…')).not.toBeVisible()
    await expect(page.getByRole('link', { name })).toBeVisible()
  })

  test('assigned recipe persists after navigating away and back', async ({ page, plannerPage }) => {
    const name = `Plan Persist ${RUN_ID}`
    await createRecipeAndGoToPlanner(page, name)

    await plannerPage.openRecipePicker({ mealLabel: 'Dinner' })
    await plannerPage.selectRecipeInPicker(name)
    await expect(page.getByRole('link', { name })).toBeVisible()

    // Navigate away then back — IndexedDB data should survive
    await page.goto('/')
    await page.goto('/meal-plan')
    await expect(plannerPage.heading).toBeVisible()
    await expect(page.getByRole('link', { name })).toBeVisible({ timeout: 10000 })
  })

  test('can assign multiple recipes to different meal slots', async ({ page, plannerPage }) => {
    const lunch = `Plan Multi Lunch ${RUN_ID}`
    const dinner = `Plan Multi Dinner ${RUN_ID}`

    for (const n of [lunch, dinner]) {
      await page.goto('/recipes/new')
      await page.getByPlaceholder('e.g. Spaghetti Bolognese').fill(n)
      await page.getByPlaceholder('ingredient name').fill('Water')
      await page.getByPlaceholder('Step 1…').fill('Boil.')
      await page.getByRole('button', { name: 'Add Recipe' }).click()
      await expect(page).toHaveURL(/recipes\/[^/]+$/)
    }
    await page.goto('/meal-plan')

    await plannerPage.openRecipePicker({ mealLabel: 'Lunch' })
    await plannerPage.selectRecipeInPicker(lunch)

    await plannerPage.openRecipePicker({ mealLabel: 'Dinner' })
    await plannerPage.selectRecipeInPicker(dinner)

    await expect(page.getByRole('link', { name: lunch })).toBeVisible()
    await expect(page.getByRole('link', { name: dinner })).toBeVisible()
  })
})

test.describe('Meal planner — remove recipes', () => {
  test('can remove a recipe from a slot', async ({ page, plannerPage }) => {
    const name = `Plan Remove ${RUN_ID}`
    await createRecipeAndGoToPlanner(page, name)

    await plannerPage.openRecipePicker({ mealLabel: 'Snack' })
    await plannerPage.selectRecipeInPicker(name)
    await expect(page.getByRole('link', { name })).toBeVisible()

    await plannerPage.removeRecipe(name)

    // Recipe link should no longer be in the planner
    await expect(page.getByRole('link', { name })).not.toBeVisible()
  })

  test('removal persists after navigating away and back', async ({ page, plannerPage }) => {
    const name = `Plan RemovePersist ${RUN_ID}`
    await createRecipeAndGoToPlanner(page, name)

    await plannerPage.openRecipePicker({ mealLabel: 'Lunch' })
    await plannerPage.selectRecipeInPicker(name)
    await expect(page.getByRole('link', { name })).toBeVisible()

    await plannerPage.removeRecipe(name)
    // Wait for removal to be reflected before navigating away
    await expect(page.getByRole('link', { name })).not.toBeVisible()

    await page.goto('/')
    await page.goto('/meal-plan')
    await expect(plannerPage.heading).toBeVisible()
    await expect(page.getByRole('link', { name })).not.toBeVisible()
  })
})

test.describe('Meal planner — week navigation', () => {
  test('can navigate to next and previous week', async ({ page, plannerPage }) => {
    await plannerPage.goto()

    // Capture week range text before navigating
    const initialText = await plannerPage.weekRangeText.textContent()
    expect(initialText).toMatch(/\w+ \d+ – \w+ \d+, \d{4}/)

    // Navigate forward — text must change
    await plannerPage.navigateToNextWeek()
    await expect(plannerPage.weekRangeText).not.toHaveText(initialText!)
    const nextWeekText = await plannerPage.weekRangeText.textContent()
    expect(nextWeekText).toMatch(/\w+ \d+ – \w+ \d+, \d{4}/)

    // Navigate back — text must change again (away from the "next week" text)
    await plannerPage.navigateToPreviousWeek()
    await expect(plannerPage.weekRangeText).not.toHaveText(nextWeekText!)
    const prevWeekText = await plannerPage.weekRangeText.textContent()
    expect(prevWeekText).toMatch(/\w+ \d+ – \w+ \d+, \d{4}/)
  })

  test('recipe assigned to current week does not appear in next week', async ({
    page,
    plannerPage,
  }) => {
    const name = `Plan Isolate ${RUN_ID}`
    await createRecipeAndGoToPlanner(page, name)

    // Assign to current week
    await plannerPage.openRecipePicker({ mealLabel: 'Dinner' })
    await plannerPage.selectRecipeInPicker(name)
    await expect(page.getByRole('link', { name })).toBeVisible()

    // Navigate to next week
    await plannerPage.navigateToNextWeek()

    // Recipe should not appear in the next week's plan
    await expect(page.getByRole('link', { name })).not.toBeVisible()
  })

  test('current week meal plan is preserved across page navigations', async ({
    page,
    plannerPage,
  }) => {
    const name = `Plan NavBack ${RUN_ID}`
    await createRecipeAndGoToPlanner(page, name)

    // Assign to current week
    await plannerPage.openRecipePicker({ mealLabel: 'Breakfast' })
    await plannerPage.selectRecipeInPicker(name)
    await expect(page.getByRole('link', { name })).toBeVisible()

    // Navigate to next week — recipe should disappear
    const currentWeekText = await plannerPage.weekRangeText.textContent()
    await plannerPage.navigateToNextWeek()
    await expect(plannerPage.weekRangeText).not.toHaveText(currentWeekText!)
    await expect(page.getByRole('link', { name })).not.toBeVisible()

    // Navigate away and back to the planner (resets to current week via getMonday(new Date()))
    await page.goto('/')
    await page.goto('/meal-plan')
    await expect(plannerPage.heading).toBeVisible()

    // Current week's recipe should be restored
    await expect(page.getByRole('link', { name })).toBeVisible({ timeout: 10000 })
  })
})
