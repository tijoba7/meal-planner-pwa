import { test, expect } from './fixtures'

/**
 * E2E tests for the Pantry page.
 *
 * Covers: add item → list → edit → delete → expiry warnings → category display.
 * Each test uses a unique item name to avoid IndexedDB cross-test pollution.
 */

const RUN_ID = Date.now()

/** Navigate to the pantry page and click "Add Item" to open the add form. */
async function openAddForm(page: import('@playwright/test').Page) {
  await page.goto('/pantry')
  await page.getByRole('button', { name: 'Add Item' }).click()
  await expect(page.getByRole('heading', { name: /add pantry item/i })).toBeVisible()
}

/** Fill and submit the add-item form. Quantity and unit are optional. */
async function addPantryItem(
  page: import('@playwright/test').Page,
  opts: {
    name: string
    quantity?: string
    expiryDate?: string
  },
) {
  await openAddForm(page)
  await page.getByLabel('Item name').fill(opts.name)
  if (opts.quantity) await page.getByLabel('Quantity').fill(opts.quantity)
  if (opts.expiryDate) await page.getByLabel('Expiry date').fill(opts.expiryDate)
  await page.getByRole('button', { name: 'Add to Pantry' }).click()
  // Wait for the item to appear — form closes on success
  await expect(page.getByRole('heading', { name: /add pantry item/i })).not.toBeVisible()
}

test.describe('Pantry — add items', () => {
  test('can open the add-item form', async ({ page }) => {
    await page.goto('/pantry')
    await page.getByRole('button', { name: 'Add Item' }).click()
    await expect(page.getByLabel('Item name')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add to Pantry' })).toBeVisible()
  })

  test('can add a pantry item and see it in the list', async ({ page }) => {
    const name = `PantryAdd ${RUN_ID}`
    await addPantryItem(page, { name })
    await expect(page.getByText(name, { exact: true })).toBeVisible()
  })

  test('add form can be cancelled', async ({ page }) => {
    await page.goto('/pantry')
    await page.getByRole('button', { name: 'Add Item' }).click()
    await expect(page.getByLabel('Item name')).toBeVisible()
    // Use the "Cancel" text button in the form body (not the header X icon)
    await page.getByRole('button', { name: 'Cancel', exact: true }).last().click()
    await expect(page.getByLabel('Item name')).not.toBeVisible()
  })

  test('added item persists after page reload', async ({ page }) => {
    const name = `PantryPersist ${RUN_ID}`
    await addPantryItem(page, { name })
    await page.reload()
    await expect(page.getByText(name, { exact: true })).toBeVisible()
  })
})

test.describe('Pantry — edit items', () => {
  test('can edit a pantry item name', async ({ page }) => {
    const original = `PantryEdit ${RUN_ID}`
    const updated = `PantryEdited ${RUN_ID}`
    await addPantryItem(page, { name: original })

    await page.getByRole('button', { name: `Edit ${original}` }).click()
    const nameInput = page.locator('input[type="text"]').first()
    await nameInput.clear()
    await nameInput.fill(updated)
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText(updated, { exact: true })).toBeVisible()
    await expect(page.getByText(original, { exact: true })).not.toBeVisible()
  })

  test('edit can be cancelled without saving', async ({ page }) => {
    const name = `PantryEditCancel ${RUN_ID}`
    await addPantryItem(page, { name })

    await page.getByRole('button', { name: `Edit ${name}` }).click()
    const nameInput = page.locator('input[type="text"]').first()
    await nameInput.clear()
    await nameInput.fill('should not be saved')
    // The Cancel button in the inline edit row — only one Cancel button visible here
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()

    await expect(page.getByText(name, { exact: true })).toBeVisible()
    await expect(page.getByText('should not be saved', { exact: true })).not.toBeVisible()
  })
})

test.describe('Pantry — delete items', () => {
  test('can delete a pantry item', async ({ page }) => {
    const name = `PantryDelete ${RUN_ID}`
    await addPantryItem(page, { name })
    await expect(page.getByText(name, { exact: true })).toBeVisible()

    await page.getByRole('button', { name: `Remove ${name}` }).click()
    // Confirm dialog appears
    await expect(page.getByText(`Remove "${name}"?`)).toBeVisible()
    await page.getByRole('button', { name: 'Remove' }).click()

    await expect(page.getByText(name, { exact: true })).not.toBeVisible()
  })

  test('delete confirmation can be cancelled (Keep)', async ({ page }) => {
    const name = `PantryDeleteCancel ${RUN_ID}`
    await addPantryItem(page, { name })

    await page.getByRole('button', { name: `Remove ${name}` }).click()
    await expect(page.getByText(`Remove "${name}"?`)).toBeVisible()
    await page.getByRole('button', { name: 'Keep' }).click()

    // Item still present
    await expect(page.getByText(name, { exact: true })).toBeVisible()
  })
})

test.describe('Pantry — expiry warnings', () => {
  test('shows "Expires soon" for items expiring within 7 days', async ({ page }) => {
    const name = `PantrySoon ${RUN_ID}`
    // Set expiry to 3 days from now
    const soon = new Date()
    soon.setDate(soon.getDate() + 3)
    const expiryDate = soon.toISOString().slice(0, 10)

    await addPantryItem(page, { name, expiryDate })
    await expect(page.getByText(/expires soon/i)).toBeVisible()
  })

  test('shows "Expired" for items past their expiry date', async ({ page }) => {
    const name = `PantryExpired ${RUN_ID}`
    // Set expiry to yesterday
    const past = new Date()
    past.setDate(past.getDate() - 1)
    const expiryDate = past.toISOString().slice(0, 10)

    await addPantryItem(page, { name, expiryDate })
    await expect(page.getByText(/expired/i).first()).toBeVisible()
  })
})

test.describe('Pantry — categories', () => {
  test('items are grouped by category with a colored badge', async ({ page }) => {
    const name = `PantryOlive ${RUN_ID}`
    // "Olive oil" should be categorised as Pantry
    await addPantryItem(page, { name: `Olive oil ${RUN_ID}` })

    // Category badge should be visible (Pantry category in this case)
    // The badge renders as a rounded-full span — look for any category label
    const categoryBadge = page.locator('span.rounded-full').first()
    await expect(categoryBadge).toBeVisible()
  })

  test('can collapse and expand a category group', async ({ page }) => {
    const name = `PantryCollapse ${RUN_ID}`
    await addPantryItem(page, { name })

    // Find the first category group header button
    const groupToggle = page.locator('button[aria-expanded]').first()
    await expect(groupToggle).toBeVisible()

    // Collapse it
    await groupToggle.click()
    await expect(groupToggle).toHaveAttribute('aria-expanded', 'false')

    // Expand it again
    await groupToggle.click()
    await expect(groupToggle).toHaveAttribute('aria-expanded', 'true')
  })
})
