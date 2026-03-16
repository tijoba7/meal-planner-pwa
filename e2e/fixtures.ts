import { test as base } from '@playwright/test'
import { RecipesPageObject } from './page-objects/RecipesPage'
import { PlannerPageObject } from './page-objects/PlannerPage'
import { ShoppingPageObject } from './page-objects/ShoppingPage'

/**
 * Extended test fixtures providing page object models for key pages.
 *
 * Usage:
 *   import { test, expect } from '../fixtures'
 *   test('adds a recipe', async ({ recipesPage }) => { ... })
 */
export const test = base.extend<{
  recipesPage: RecipesPageObject
  plannerPage: PlannerPageObject
  shoppingPage: ShoppingPageObject
}>({
  // Auto-dismiss the onboarding wizard for all tests by setting localStorage
  // before the page renders. Without this, the "Welcome to Mise" modal
  // intercepts pointer events and breaks navigation tests.
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      localStorage.setItem('mise_onboarding_done', '1')
    })
    await use(page)
  },
  recipesPage: async ({ page }, use) => {
    await use(new RecipesPageObject(page))
  },
  plannerPage: async ({ page }, use) => {
    await use(new PlannerPageObject(page))
  },
  shoppingPage: async ({ page }, use) => {
    await use(new ShoppingPageObject(page))
  },
})

export { expect } from '@playwright/test'
