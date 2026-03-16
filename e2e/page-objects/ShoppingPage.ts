import type { Page, Locator } from '@playwright/test'

/**
 * Page object model for the Shopping Lists page (route: /shopping).
 */
export class ShoppingPageObject {
  readonly page: Page

  // Locators
  readonly heading: Locator
  readonly newListButton: Locator
  readonly emptyStateTitle: Locator

  constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole('heading', { name: 'Shopping Lists' })
    this.newListButton = page.getByRole('button', { name: 'New shopping list' })
    this.emptyStateTitle = page.getByText('No shopping lists yet')
  }

  async goto() {
    await this.page.goto('/shopping')
  }

  async openNewListForm() {
    await this.newListButton.click()
  }

  async createList(name: string) {
    await this.openNewListForm()
    await this.page.getByPlaceholder("e.g. This week's groceries").fill(name)
    // force:true bypasses Playwright's stability check on the modal's slide-up
    // animation (260ms on mobile / 200ms scale-in on desktop), which otherwise
    // causes a "not stable" timeout waiting for the button to stop moving.
    // eslint-disable-next-line playwright/no-force-option
    await this.page.getByRole('button', { name: 'Create List' }).click({ force: true })
    // Wait until the detail view is rendered before returning to the caller
    await this.page.getByRole('heading', { name }).waitFor()
  }

  async openList(name: string) {
    await this.page.getByRole('button', { name: new RegExp(`Open ${name}`) }).click()
  }

  async deleteList(name: string) {
    // The delete button's aria-label is "Delete {name}" (set in ShoppingListPage.tsx).
    // Matching the full aria-label avoids the strict-mode violation that occurred
    // when using exact:'Delete' — the list-card open button also matches /Delete/.
    await this.page.getByRole('button', { name: `Delete ${name}` }).click()
  }

  async checkItem(itemName: string) {
    await this.page.getByRole('button', { name: `Check ${itemName}` }).click()
  }

  async uncheckItem(itemName: string) {
    await this.page.getByRole('button', { name: `Uncheck ${itemName}` }).click()
  }
}
