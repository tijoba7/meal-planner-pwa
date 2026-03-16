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
    // On mobile the "Create List" button lives inside a fixed bottom-sheet overlay.
    // Playwright's regular click (and even force:true) scroll into view on the
    // document — but position:fixed elements don't move with it, so the button
    // ends up "outside of the viewport" after scrolling. dispatchEvent('click')
    // fires the event directly on the element, bypassing all actionability checks.
    await this.page.getByRole('button', { name: 'Create List' }).dispatchEvent('click')
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
