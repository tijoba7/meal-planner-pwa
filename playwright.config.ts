import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E test configuration for Mise.
 *
 * Two web servers:
 *  - Port 5173: auth-bypass server for feature tests (VITE_TEST_BYPASS_AUTH=true)
 *  - Port 5174: real-auth server for auth flow tests (fake Supabase, API mocked via page.route)
 *
 * Covers Chrome (desktop), Firefox (desktop), and mobile Chrome/Safari for feature tests.
 * Auth flow tests run on Chromium only (auth logic is browser-agnostic).
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry twice on CI, once locally for transient server startup failures */
  retries: process.env.CI ? 2 : 1,

  /* Use 1 worker on CI, 2 locally — prevents Vite dev server overload */
  workers: process.env.CI ? 1 : 2,

  /* Per-test timeout — increased from 30s to 60s to accommodate Vite dev server
     warmup latency when running the full 116-test suite in parallel. */
  timeout: 60000,

  /* Reporter */
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  /* Shared settings for all projects */
  use: {
    /* Base URL for feature tests (auth-bypass server) */
    baseURL: 'http://localhost:5173',

    /* Collect traces on first retry */
    trace: 'on-first-retry',

    /* Screenshot only on failure */
    screenshot: 'only-on-failure',
  },

  /* Test projects */
  projects: [
    // Feature tests — run against the auth-bypass server (port 5173).
    // All routes are accessible; no Supabase credentials required.
    {
      name: 'chromium',
      testIgnore: ['**/auth.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testIgnore: ['**/auth.spec.ts'],
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'mobile-chrome',
      testIgnore: ['**/auth.spec.ts'],
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      testIgnore: ['**/auth.spec.ts'],
      use: { ...devices['iPhone 12'] },
    },

    // Auth flow tests — run against the real-auth server (port 5174).
    // ProtectedRoute enforces auth; Supabase API calls are intercepted via page.route().
    {
      name: 'auth',
      testMatch: ['**/auth.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5174',
      },
    },
  ],

  /* Web servers — one per auth mode */
  webServer: [
    {
      // Auth-bypass server for feature tests (routes always accessible)
      command: 'pnpm dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        // Bypass Supabase auth in E2E tests — ProtectedRoute lets all requests through,
        // and AuthContext returns a fake authenticated user.
        VITE_TEST_BYPASS_AUTH: 'true',
      },
    },
    {
      // Real-auth server for auth flow tests (ProtectedRoute active)
      // Fake Supabase URL makes isSupabaseAvailable() return true;
      // actual API calls are intercepted by page.route() in auth.spec.ts.
      command: 'pnpm dev --port 5174',
      url: 'http://localhost:5174',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        VITE_SUPABASE_URL: 'http://localhost:54321',
        VITE_SUPABASE_ANON_KEY: 'test-anon-key-for-e2e',
      },
    },
  ],
})
