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
    this.newListButton = page.getByRole('button', { name: '+ New List' })
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
    await this.page.getByRole('button', { name: 'Create List' }).click()
  }

  async openList(name: string) {
    await this.page.getByRole('button', { name: new RegExp(name) }).click()
  }

  async deleteList(name: string) {
    // Find the delete button next to the matching list
    const listCard = this.page.locator('button', { hasText: name })
    const row = listCard.locator('..')
    await row.getByRole('button', { name: 'Delete' }).click()
  }

  async checkItem(itemName: string) {
    await this.page.getByRole('button', { name: `Check ${itemName}` }).click()
  }

  async uncheckItem(itemName: string) {
    await this.page.getByRole('button', { name: `Uncheck ${itemName}` }).click()
  }
}
