import type { Page, Locator } from '@playwright/test'

/**
 * Page object model for the Recipes list page (route: /).
 */
export class RecipesPageObject {
  readonly page: Page

  // Locators
  readonly heading: Locator
  readonly searchInput: Locator
  readonly addRecipeLink: Locator
  readonly importUrlLink: Locator
  readonly recipeCards: Locator
  readonly emptyStateTitle: Locator

  constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole('heading', { name: 'Recipes' })
    this.searchInput = page.getByPlaceholder('Search recipes...')
    this.addRecipeLink = page.getByRole('link', { name: '+ Add Recipe' })
    this.importUrlLink = page.getByRole('link', { name: 'Import URL' })
    this.recipeCards = page.locator('a[href^="/recipes/"]').filter({ hasText: /\w/ })
    this.emptyStateTitle = page.getByText('No recipes yet')
  }

  async goto() {
    await this.page.goto('/recipes')
  }

  async search(term: string) {
    await this.searchInput.fill(term)
  }

  async clearSearch() {
    await this.searchInput.clear()
  }

  async getRecipeCard(name: string) {
    return this.page.getByRole('link', { name: new RegExp(name) })
  }

  async clickAddRecipe() {
    await this.addRecipeLink.click()
  }

  async clickImportUrl() {
    await this.importUrlLink.click()
  }
}
