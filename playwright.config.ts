import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E test configuration for Mise.
 *
 * Runs against the Vite dev server on port 5173.
 * Covers Chrome (desktop), Firefox (desktop), and mobile Chrome/Safari.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Use 1 worker on CI to avoid resource contention */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter */
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  /* Shared settings for all projects */
  use: {
    /* Base URL for all tests */
    baseURL: 'http://localhost:5173',

    /* Collect traces on first retry */
    trace: 'on-first-retry',

    /* Screenshot only on failure */
    screenshot: 'only-on-failure',
  },

  /* Test projects — desktop browsers + mobile emulation */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  /* Start the Vite dev server before running tests */
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})
