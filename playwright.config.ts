import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E test configuration for Braisely.
 *
 * Three web servers, all using fake Supabase credentials:
 *  - Port 5175: feature test server — tests inject sessions via localStorage
 *  - Port 5174: auth flow test server — tests exercise login/redirect/logout flows
 *
 * Port 5175 is deliberately different from the default Vite dev port (5173) so
 * that a running dev server never pollutes the E2E test environment.  When a
 * dev server is alive on 5173 it is started with real Supabase credentials
 * (from .env.local), which causes the Supabase JS client to use a different
 * localStorage key than the one fixtures.ts injects — breaking session injection.
 *
 * Covers Chrome (desktop), Firefox (desktop), and mobile Chrome/Safari for feature tests.
 * Auth flow tests run on Chromium only (auth logic is browser-agnostic).
 *
 * Session injection pattern (feature tests):
 *   The Supabase JS client reads its session from localStorage key
 *   `sb-localhost-auth-token` (derived from VITE_SUPABASE_URL hostname).
 *   Tests inject a fake far-future session before page.goto() so
 *   ProtectedRoute sees an authenticated user and renders the app.
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
    /* Base URL for feature tests (auth-bypass server on dedicated test port) */
    baseURL: 'http://localhost:5175',

    /* Collect traces on first retry */
    trace: 'on-first-retry',

    /* Screenshot only on failure */
    screenshot: 'only-on-failure',

    /* Disable CSS animations so slide-up/fade-in don't interfere with click hit-testing */
    reducedMotion: 'reduce',
  },

  /* Test projects */
  projects: [
    // Feature tests — run against the auth-bypass server (port 5175).
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
      // Feature test server — session injected per-test via localStorage.
      // Runs on port 5175 (not 5173) so it never conflicts with a live dev
      // server started from .env.local with real Supabase credentials.
      // Fake Supabase credentials satisfy supabase.ts startup check;
      // actual API calls are intercepted by page.route() in fixtures.ts.
      command: 'pnpm dev --port 5175',
      url: 'http://localhost:5175',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        VITE_SUPABASE_URL: 'http://localhost:54321',
        VITE_SUPABASE_ANON_KEY: 'test-anon-key-for-e2e',
      },
    },
    {
      // Auth flow test server — ProtectedRoute enforces auth normally.
      // Fake Supabase credentials satisfy supabase.ts startup check;
      // API calls are intercepted by page.route() in auth.spec.ts.
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
