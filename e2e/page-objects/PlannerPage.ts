import type { Page, Locator } from '@playwright/test'

/**
 * Page object model for the Weekly Planner page (route: /meal-plan).
 */
export class PlannerPageObject {
  readonly page: Page

  // Locators
  readonly heading: Locator
  readonly prevWeekButton: Locator
  readonly nextWeekButton: Locator
  readonly weekRangeText: Locator
  readonly templatesButton: Locator
  readonly copyWeekButton: Locator
  readonly emptyStateTitle: Locator

  constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole('heading', { name: 'Weekly Planner' })
    this.prevWeekButton = page.getByRole('button', { name: 'Previous week' })
    this.nextWeekButton = page.getByRole('button', { name: 'Next week' })
    this.weekRangeText = page.locator('p.text-sm.text-gray-500').first()
    this.templatesButton = page.getByRole('button', { name: /Templates/ })
    this.copyWeekButton = page.getByRole('button', {
      name: "Copy this week's meal plan to another week",
    })
    this.emptyStateTitle = page.getByText('Nothing planned yet')
  }

  async goto() {
    await this.page.goto('/meal-plan')
  }

  /** Click the "Add recipe" button for the given day and meal type. */
  async openRecipePicker(options: { mealLabel: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack' }) {
    // Find the first add-recipe button under the matching meal label
    const mealRow = this.page.locator('span', { hasText: options.mealLabel }).first()
    const addButton = mealRow.locator('..').locator('..').getByText('Add recipe')
    await addButton.click()
  }

  async searchInPicker(term: string) {
    await this.page.getByPlaceholder('Search recipes…').fill(term)
  }

  async selectRecipeInPicker(name: string) {
    await this.page.getByRole('button', { name: new RegExp(name) }).click()
  }

  async closePickerWithButton() {
    await this.page.getByRole('button', { name: 'Close' }).click()
  }

  async removeRecipe(name: string) {
    await this.page.getByRole('button', { name: `Remove ${name}` }).click()
  }

  async navigateToNextWeek() {
    await this.nextWeekButton.click()
  }

  async navigateToPreviousWeek() {
    await this.prevWeekButton.click()
  }
}
