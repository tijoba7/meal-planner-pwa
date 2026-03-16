import { test, expect } from './fixtures'

/**
 * E2E tests for the Collections feature.
 *
 * Covers: create collection → list → add recipes → remove recipes → rename → delete.
 * Each test run uses a unique suffix to avoid IndexedDB cross-test pollution.
 */

const RUN_ID = Date.now()

/** Create a minimal recipe and return its URL. */
async function createRecipe(page: import('@playwright/test').Page, name: string) {
  await page.goto('/recipes/new')
  await page.getByPlaceholder('e.g. Spaghetti Bolognese').fill(name)
  await page.getByPlaceholder('ingredient name').fill('Salt')
  await page.getByPlaceholder('Step 1…').fill('Season and serve.')
  await page.getByRole('button', { name: 'Add Recipe' }).click()
  await expect(page).toHaveURL(/recipes\/[^/]+$/)
}

/** Create a collection from the collections page. Returns to /collections after creation. */
async function createCollection(
  page: import('@playwright/test').Page,
  name: string,
  description?: string,
) {
  await page.goto('/collections')
  await page.getByRole('button', { name: 'New Collection' }).click()
  await expect(page.getByRole('heading', { name: 'New Collection' })).toBeVisible()
  await page.getByLabel('Name').fill(name)
  if (description) await page.getByLabel(/description/i).fill(description)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  // Modal closes after creation
  await expect(page.getByRole('heading', { name: 'New Collection' })).not.toBeVisible()
}

test.describe('Collections — create', () => {
  test('can create a new collection', async ({ page }) => {
    const name = `Coll Create ${RUN_ID}`
    await createCollection(page, name)
    await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible()
  })

  test('created collection shows recipe count of 0', async ({ page }) => {
    const name = `Coll Count ${RUN_ID}`
    await createCollection(page, name)
    await expect(page.getByText('0 recipes')).toBeVisible()
  })

  test('create modal can be cancelled', async ({ page }) => {
    await page.goto('/collections')
    await page.getByRole('button', { name: 'New Collection' }).click()
    await expect(page.getByRole('heading', { name: 'New Collection' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'New Collection' })).not.toBeVisible()
  })

  test('can create a collection with a description', async ({ page }) => {
    const name = `Coll Desc ${RUN_ID}`
    const description = 'Quick weeknight favourites'
    await createCollection(page, name, description)
    await expect(page.getByText(description)).toBeVisible()
  })
})

test.describe('Collections — add and remove recipes', () => {
  test('can add a recipe to a collection', async ({ page }) => {
    const recipeName = `CollRecipe ${RUN_ID}`
    const collectionName = `Coll AddRecipe ${RUN_ID}`

    await createRecipe(page, recipeName)
    await createCollection(page, collectionName)

    // Navigate to the collection detail
    await page.getByRole('link', { name: new RegExp(collectionName) }).click()
    await expect(page.getByRole('heading', { name: collectionName })).toBeVisible()

    // Open "Add recipes" modal — use first() since empty-state also has one
    await page.getByRole('button', { name: 'Add recipes' }).first().click()
    await expect(page.getByPlaceholder('Search recipes…')).toBeVisible()

    // Click the recipe in the list
    await expect(page.getByRole('button', { name: new RegExp(recipeName) })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: new RegExp(recipeName) }).click()

    // Close the modal
    await page.getByRole('button', { name: 'Done' }).click()

    // Recipe should now appear in the collection
    await expect(page.getByRole('link', { name: new RegExp(recipeName) })).toBeVisible()
  })

  test('can remove a recipe from a collection', async ({ page }) => {
    const recipeName = `CollRemove ${RUN_ID}`
    const collectionName = `Coll RemoveRecipe ${RUN_ID}`

    await createRecipe(page, recipeName)
    await createCollection(page, collectionName)

    // Add the recipe first
    await page.getByRole('link', { name: new RegExp(collectionName) }).click()
    await page.getByRole('button', { name: 'Add recipes' }).first().click()
    await expect(page.getByRole('button', { name: new RegExp(recipeName) })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: new RegExp(recipeName) }).click()
    await page.getByRole('button', { name: 'Done' }).click()
    await expect(page.getByRole('link', { name: new RegExp(recipeName) })).toBeVisible()

    // Remove it using the X button
    await page.getByRole('button', { name: `Remove "${recipeName}" from collection` }).click()

    // Recipe should no longer appear
    await expect(page.getByRole('link', { name: new RegExp(recipeName) })).not.toBeVisible()
  })
})

test.describe('Collections — rename', () => {
  test('can rename a collection', async ({ page }) => {
    const original = `Coll Rename ${RUN_ID}`
    const updated = `Coll Renamed ${RUN_ID}`

    await createCollection(page, original)
    await page.getByRole('link', { name: new RegExp(original) }).click()
    await expect(page.getByRole('heading', { name: original })).toBeVisible()

    // Open edit modal
    await page.getByRole('button', { name: 'Edit collection' }).click()
    await expect(page.getByRole('heading', { name: 'Edit Collection' })).toBeVisible()

    // Clear and fill the name field
    const nameInput = page.getByLabel('Name')
    await nameInput.clear()
    await nameInput.fill(updated)
    await page.getByRole('button', { name: 'Save' }).click()

    // Modal closes; heading shows the new name
    await expect(page.getByRole('heading', { name: updated })).toBeVisible()
    await expect(page.getByRole('heading', { name: original })).not.toBeVisible()
  })
})

test.describe('Collections — delete', () => {
  test('can delete a collection from the list page', async ({ page }) => {
    const name = `Coll Delete ${RUN_ID}`
    await createCollection(page, name)
    await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible()

    // The X button on the collection card
    await page.getByRole('button', { name: `Delete collection "${name}"` }).click()
    await expect(page.getByText('Delete collection?')).toBeVisible()
    // Use exact: true to avoid partial match with card X buttons
    await page.getByRole('button', { name: 'Delete', exact: true }).click()

    await expect(page.getByRole('link', { name: new RegExp(name) })).not.toBeVisible()
  })

  test('delete from detail page redirects to collections list', async ({ page }) => {
    const name = `Coll DeleteDetail ${RUN_ID}`
    await createCollection(page, name)
    await page.getByRole('link', { name: new RegExp(name) }).click()
    await expect(page.getByRole('heading', { name: name })).toBeVisible()

    // Wait for both async data fetches to settle before interacting.
    // CollectionDetailPage's useEffect has no cleanup, so React 18 StrictMode
    // double-invokes it — two concurrent Promise.all calls run. Waiting for the
    // empty-state text confirms collection + allRecipes are fully loaded and no
    // further re-renders are pending that would detach confirm-dialog DOM nodes.
    await expect(page.getByText(/no recipes yet/i)).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: 'Delete collection' }).click()
    await expect(page.getByText('Delete collection?')).toBeVisible()
    // Scope to the dialog so the locator re-queries inside the correct container
    // on every retry, rather than holding a stale reference to a detached node.
    await page.locator('[role="dialog"]').getByRole('button', { name: 'Delete' }).click()

    await expect(page).toHaveURL(/\/collections$/, { timeout: 10000 })
  })

  test('delete can be cancelled', async ({ page }) => {
    const name = `Coll DeleteCancel ${RUN_ID}`
    await createCollection(page, name)

    await page.getByRole('button', { name: `Delete collection "${name}"` }).click()
    await expect(page.getByText('Delete collection?')).toBeVisible()
    // Use exact: true to avoid partial match on card buttons whose aria-label contains "Cancel"
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()

    // Collection still present
    await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible()
  })
})
