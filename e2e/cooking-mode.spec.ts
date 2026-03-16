import { test, expect } from './fixtures'

/**
 * E2E tests for the Cooking Mode overlay.
 *
 * Cooking mode is triggered from a recipe detail page when the recipe has
 * at least one instruction step. Tests cover:
 *   - entering cooking mode
 *   - navigating between steps
 *   - timer detection and controls
 *   - exiting cooking mode
 *
 * Each test creates its own recipe to stay self-contained.
 */

const RUN_ID = Date.now()

/**
 * Create a recipe with at least one instruction step and return the URL
 * of its detail page.
 */
async function createRecipeWithSteps(
  page: import('@playwright/test').Page,
  opts: { name: string; steps?: string[] },
) {
  await page.goto('/recipes/new')
  await page.getByPlaceholder('e.g. Spaghetti Bolognese').fill(opts.name)
  await page.getByPlaceholder('ingredient name').fill('Olive oil')

  const steps = opts.steps ?? ['Mix all ingredients.']
  await page.getByPlaceholder('Step 1…').fill(steps[0])

  // Add extra steps if provided
  for (let i = 1; i < steps.length; i++) {
    await page.getByRole('button', { name: '+ Add step' }).click()
    const stepInputs = page.getByPlaceholder(/Step \d+…/)
    await stepInputs.last().fill(steps[i])
  }

  await page.getByRole('button', { name: 'Add Recipe' }).click()
  await expect(page).toHaveURL(/recipes\/[^/]+$/)
  // The "Recipe saved!" success toast appears at the bottom and can block the Cook button.
  // Wait for all toasts to clear (default duration is 3 seconds).
  await expect(page.locator('[role="alert"]')).toHaveCount(0, { timeout: 8000 })
}

test.describe('Cooking mode — enter and exit', () => {
  test('can enter cooking mode via the Cook button', async ({ page }) => {
    const name = `Cook Enter ${RUN_ID}`
    await createRecipeWithSteps(page, { name })

    await page.getByRole('button', { name: /cook/i }).first().click()

    // Cooking mode dialog should appear
    await expect(page.getByRole('dialog', { name: 'Cooking mode' })).toBeVisible()
  })

  test('can exit cooking mode via the X button', async ({ page }) => {
    const name = `Cook Exit ${RUN_ID}`
    await createRecipeWithSteps(page, { name })

    await page.getByRole('button', { name: /cook/i }).first().click()
    await expect(page.getByRole('dialog', { name: 'Cooking mode' })).toBeVisible()

    await page.getByRole('button', { name: 'Exit cooking mode' }).click()
    await expect(page.getByRole('dialog', { name: 'Cooking mode' })).not.toBeVisible()
  })

  test('step counter shows "Step 1 of N" on entry', async ({ page }) => {
    const name = `Cook Counter ${RUN_ID}`
    await createRecipeWithSteps(page, {
      name,
      steps: ['First step.', 'Second step.'],
    })

    await page.getByRole('button', { name: /cook/i }).first().click()
    await expect(page.getByText(/step 1 of/i)).toBeVisible()
  })
})

test.describe('Cooking mode — step navigation', () => {
  test('can navigate to the next step', async ({ page }) => {
    const name = `Cook Nav ${RUN_ID}`
    await createRecipeWithSteps(page, {
      name,
      steps: ['First step text.', 'Second step text.'],
    })

    await page.getByRole('button', { name: /cook/i }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Cooking mode' })
    await expect(dialog).toBeVisible()

    // Should be on step 1 initially
    await expect(dialog.getByText('First step text.')).toBeVisible()

    // Navigate to step 2
    await dialog.getByRole('button', { name: 'Next step' }).click()
    await expect(dialog.getByText('Second step text.')).toBeVisible()
  })

  test('previous step button is disabled on the first step', async ({ page }) => {
    const name = `Cook PrevDisabled ${RUN_ID}`
    await createRecipeWithSteps(page, {
      name,
      steps: ['Only step.', 'Second step.'],
    })

    await page.getByRole('button', { name: /cook/i }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Cooking mode' })
    await expect(dialog).toBeVisible()

    await expect(dialog.getByRole('button', { name: 'Previous step' })).toBeDisabled()
  })

  test('can navigate back to a previous step', async ({ page }) => {
    const name = `Cook Back ${RUN_ID}`
    await createRecipeWithSteps(page, {
      name,
      steps: ['Step one content.', 'Step two content.'],
    })

    await page.getByRole('button', { name: /cook/i }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Cooking mode' })
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'Next step' }).click()
    await expect(dialog.getByText('Step two content.')).toBeVisible()

    await dialog.getByRole('button', { name: 'Previous step' }).click()
    await expect(dialog.getByText('Step one content.')).toBeVisible()
  })

  test('last step shows a Finish button instead of Next', async ({ page }) => {
    const name = `Cook Finish ${RUN_ID}`
    await createRecipeWithSteps(page, {
      name,
      steps: ['First.', 'Last step.'],
    })

    await page.getByRole('button', { name: /cook/i }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Cooking mode' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Next step' }).click()

    // On the last step, "Finish" replaces "Next step"
    await expect(dialog.getByRole('button', { name: 'Finish' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Next step' })).not.toBeVisible()
  })

  test('Finish button closes cooking mode', async ({ page }) => {
    const name = `Cook FinishClose ${RUN_ID}`
    await createRecipeWithSteps(page, { name, steps: ['Only one step.'] })

    await page.getByRole('button', { name: /cook/i }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Cooking mode' })
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'Finish' }).click()
    await expect(page.getByRole('dialog', { name: 'Cooking mode' })).not.toBeVisible()
  })
})

test.describe('Cooking mode — timers', () => {
  test('timer button appears for steps containing time phrases', async ({ page }) => {
    const name = `Cook Timer ${RUN_ID}`
    await createRecipeWithSteps(page, {
      name,
      steps: ['Simmer for 10 minutes.'],
    })

    await page.getByRole('button', { name: /cook/i }).first().click()
    await expect(page.getByRole('dialog', { name: 'Cooking mode' })).toBeVisible()

    // A "Timer for 10 minutes" button should appear
    await expect(page.getByRole('button', { name: /timer for/i })).toBeVisible()
  })

  test('starting a timer shows the countdown display', async ({ page }) => {
    const name = `Cook TimerStart ${RUN_ID}`
    await createRecipeWithSteps(page, {
      name,
      steps: ['Cook for 5 minutes.'],
    })

    await page.getByRole('button', { name: /cook/i }).first().click()
    await page.getByRole('button', { name: /timer for/i }).click()

    // Countdown should show in MM:SS format
    await expect(page.getByText(/\d+:\d{2}/)).toBeVisible()
  })
})
