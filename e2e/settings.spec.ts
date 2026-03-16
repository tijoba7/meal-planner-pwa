import { test, expect } from './fixtures'

/**
 * E2E tests for the Settings page.
 *
 * Covers: theme selection, unit preference, dietary preferences, export button.
 * Settings are stored in localStorage — changes are visible immediately after interaction.
 */

test.describe('Settings — page load', () => {
  test('settings page loads with heading', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  })

  test('appearance and dietary sections are present', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByText('Appearance')).toBeVisible()
    await expect(page.getByText('Dietary Preferences')).toBeVisible()
  })
})

test.describe('Settings — theme', () => {
  test('can switch to Dark theme', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Dark' }).click()

    // Dark theme applies the "dark" class to the document element
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    expect(isDark).toBe(true)
  })

  test('can switch to Light theme', async ({ page }) => {
    await page.goto('/settings')

    // First set to dark so we can verify the switch back
    await page.getByRole('button', { name: 'Dark' }).click()
    await page.getByRole('button', { name: 'Light' }).click()

    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    expect(isDark).toBe(false)
  })

  test('theme persists after navigation', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Dark' }).click()

    // Navigate away and back
    await page.goto('/')
    await page.goto('/settings')

    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    expect(isDark).toBe(true)
  })
})

test.describe('Settings — units', () => {
  test('can switch to Metric units', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Metric' }).click()

    // The Metric button should now appear selected (bg-green-600 text-white)
    // We verify it's "active" by checking the aria context or that clicking it doesn't crash
    // Then verify the preference is stored in localStorage
    const stored = await page.evaluate(() => localStorage.getItem('unitSystem'))
    expect(stored).toBe('metric')
  })

  test('can switch to Imperial units', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Metric' }).click()
    await page.getByRole('button', { name: 'Imperial' }).click()

    const stored = await page.evaluate(() => localStorage.getItem('unitSystem'))
    expect(stored).toBe('imperial')
  })

  test('unit preference persists after page reload', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Metric' }).click()
    await page.reload()

    const stored = await page.evaluate(() => localStorage.getItem('unitSystem'))
    expect(stored).toBe('metric')
  })
})

test.describe('Settings — dietary preferences', () => {
  test('can select a dietary preference', async ({ page }) => {
    await page.goto('/settings')

    // The dietary buttons use aria-pressed
    const veganButton = page.getByRole('button', { name: 'Vegan' })
    await expect(veganButton).toBeVisible()
    await veganButton.click()

    await expect(veganButton).toHaveAttribute('aria-pressed', 'true')
  })

  test('can deselect a dietary preference', async ({ page }) => {
    await page.goto('/settings')

    const veganButton = page.getByRole('button', { name: 'Vegan' })
    await veganButton.click()
    await expect(veganButton).toHaveAttribute('aria-pressed', 'true')

    await veganButton.click()
    await expect(veganButton).toHaveAttribute('aria-pressed', 'false')
  })

  test('can select multiple dietary preferences', async ({ page }) => {
    await page.goto('/settings')

    const veganButton = page.getByRole('button', { name: 'Vegan' })
    const glutenFreeButton = page.getByRole('button', { name: /gluten.free/i })
    await veganButton.click()
    await glutenFreeButton.click()

    await expect(veganButton).toHaveAttribute('aria-pressed', 'true')
    await expect(glutenFreeButton).toHaveAttribute('aria-pressed', 'true')
  })

  test('"Clear all" removes all dietary preferences', async ({ page }) => {
    await page.goto('/settings')

    const veganButton = page.getByRole('button', { name: 'Vegan' })
    await veganButton.click()
    await expect(veganButton).toHaveAttribute('aria-pressed', 'true')

    await page.getByRole('button', { name: 'Clear all', exact: true }).click()
    await expect(veganButton).toHaveAttribute('aria-pressed', 'false')
  })
})

test.describe('Settings — data export', () => {
  test('export button is present', async ({ page }) => {
    await page.goto('/settings')
    // Scroll to the data section if needed
    const exportButton = page.getByRole('button', { name: /export/i })
    await expect(exportButton).toBeVisible()
  })

  test('clicking export triggers a download', async ({ page }) => {
    await page.goto('/settings')

    // Intercept the download
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /export/i }).click(),
    ])

    expect(download.suggestedFilename()).toMatch(/mise-backup-.*\.json/)
  })
})
