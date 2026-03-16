import { test, expect } from '@playwright/test'

/**
 * Auth flow E2E tests.
 *
 * These tests run against the real-auth server (port 5174, no VITE_TEST_BYPASS_AUTH).
 * ProtectedRoute enforces authentication normally. Supabase API calls are intercepted
 * via page.route() — no real Supabase instance is required.
 *
 * The Supabase localStorage key is 'supabase.auth.token' (default STORAGE_KEY).
 * A fake session with a far-future expires_at is used for authenticated tests —
 * Supabase will not attempt a token refresh when expiry is well in the future.
 */

// Key format: sb-{hostname_first_label}-auth-token (from @supabase/supabase-js v2)
// VITE_SUPABASE_URL=http://localhost:54321 → hostname='localhost' → key below
const SUPABASE_STORAGE_KEY = 'sb-localhost-auth-token'

/** Build a fake Supabase session that will be accepted by supabase-js v2. */
function buildFakeSession(email = 'e2e@test.local') {
  return {
    access_token: 'fake-e2e-access-token',
    refresh_token: 'fake-e2e-refresh-token',
    token_type: 'bearer',
    expires_in: 365 * 24 * 3600,
    // Far-future expiry — prevents Supabase from attempting a server refresh
    expires_at: Math.floor(Date.now() / 1000) + 365 * 24 * 3600,
    user: {
      id: 'e2e00000-0000-0000-0000-000000000001',
      aud: 'authenticated',
      role: 'authenticated',
      email,
      email_confirmed_at: '2024-01-01T00:00:00.000Z',
      phone: '',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
    },
  }
}

/** Build a Supabase token API response (signInWithPassword response format). */
function buildTokenResponse(email = 'e2e@test.local') {
  return {
    access_token: 'new-fake-access-token',
    refresh_token: 'new-fake-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: 'e2e00000-0000-0000-0000-000000000001',
      aud: 'authenticated',
      role: 'authenticated',
      email,
      email_confirmed_at: '2024-01-01T00:00:00.000Z',
      phone: '',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
    },
  }
}

// ---------------------------------------------------------------------------
// Unauthenticated behaviour
// ---------------------------------------------------------------------------

test.describe('Auth — unauthenticated', () => {
  test('redirects to /auth/login when accessing a protected route', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('redirects to /auth/login when accessing /meal-plan', async ({ page }) => {
    await page.goto('/meal-plan')
    await expect(page).toHaveURL(/\/auth\/login/)
    // Login page should be visible
    await expect(page.getByRole('heading', { name: 'Mise' })).toBeVisible()
  })

  test('login page renders form correctly', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.getByRole('heading', { name: 'Mise' })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })

  test('signup page renders form correctly', async ({ page }) => {
    await page.goto('/auth/signup')
    await expect(page.getByRole('heading', { name: 'Mise' })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    // Use exact: true — 'Password' is a substring of 'Confirm password'
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Confirm password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

test.describe('Auth — login', () => {
  test('successful login redirects to home', async ({ page }) => {
    const tokenResponse = buildTokenResponse()

    // Mock the Supabase signInWithPassword endpoint
    await page.route('**/auth/v1/token**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(tokenResponse),
      }),
    )

    await page.addInitScript(() => {
      localStorage.setItem('mise_onboarding_done', '1')
    })

    await page.goto('/auth/login')
    await page.getByLabel('Email').fill('test@example.com')
    await page.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Sign in' }).click()

    // After login, the app redirects to the home feed — verify we're no longer on the login page
    await expect(page).not.toHaveURL(/\/auth\/login/)
    // The main nav should be visible, confirming the authenticated layout rendered
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
  })

  test('redirects to intended destination after login', async ({ page }) => {
    const tokenResponse = buildTokenResponse()

    await page.route('**/auth/v1/token**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(tokenResponse),
      }),
    )

    await page.addInitScript(() => {
      localStorage.setItem('mise_onboarding_done', '1')
    })

    // Navigate to protected route first — should redirect to login
    await page.goto('/meal-plan')
    await expect(page).toHaveURL(/\/auth\/login/)

    // Log in
    await page.getByLabel('Email').fill('test@example.com')
    await page.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Sign in' }).click()

    // Should redirect back to the originally intended page
    await expect(page.getByRole('heading', { name: 'Weekly Planner' })).toBeVisible()
  })

  test('shows error message on invalid credentials', async ({ page }) => {
    await page.route('**/auth/v1/token**', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Invalid login credentials',
        }),
      }),
    )

    await page.goto('/auth/login')
    await page.getByLabel('Email').fill('wrong@example.com')
    await page.getByLabel('Password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText('Invalid login credentials')).toBeVisible()
  })

  test('link from login to signup works', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByRole('link', { name: 'Sign up' }).click()
    await expect(page).toHaveURL(/\/auth\/signup/)
  })
})

// ---------------------------------------------------------------------------
// Signup
// ---------------------------------------------------------------------------

test.describe('Auth — signup', () => {
  test('successful signup shows confirmation screen', async ({ page }) => {
    await page.route('**/auth/v1/signup**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'newuser-0000-0000-0000-000000000001',
            email: 'new@example.com',
            email_confirmed_at: null,
            created_at: new Date().toISOString(),
          },
          session: null,
        }),
      }),
    )

    await page.goto('/auth/signup')
    await page.getByLabel('Email').fill('new@example.com')
    await page.getByLabel('Password', { exact: true }).fill('strongpassword123')
    await page.getByLabel('Confirm password').fill('strongpassword123')
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page.getByRole('heading', { name: 'Almost there!' })).toBeVisible()
  })

  test('shows error when passwords do not match', async ({ page }) => {
    await page.goto('/auth/signup')
    await page.getByLabel('Email').fill('new@example.com')
    await page.getByLabel('Password', { exact: true }).fill('password123')
    await page.getByLabel('Confirm password').fill('differentpassword')
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page.getByText('Passwords do not match.')).toBeVisible()
  })

  test('shows error when password is too short', async ({ page }) => {
    await page.goto('/auth/signup')
    await page.getByLabel('Email').fill('new@example.com')
    await page.getByLabel('Password', { exact: true }).fill('short')
    await page.getByLabel('Confirm password').fill('short')
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page.getByText('Password must be at least 8 characters.')).toBeVisible()
  })

  test('link from signup to login works', async ({ page }) => {
    await page.goto('/auth/signup')
    await page.getByRole('link', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/auth\/login/)
  })
})

// ---------------------------------------------------------------------------
// Session persistence
// ---------------------------------------------------------------------------

test.describe('Auth — session persistence', () => {
  test('session survives page reload', async ({ page }) => {
    const session = buildFakeSession()

    // Inject fake session and onboarding flag before app loads
    await page.addInitScript(
      ({ key, sessionJson }) => {
        localStorage.setItem('mise_onboarding_done', '1')
        localStorage.setItem(key, sessionJson)
      },
      { key: SUPABASE_STORAGE_KEY, sessionJson: JSON.stringify(session) },
    )

    // Also mock /auth/v1/user in case Supabase tries to re-fetch the user
    await page.route('**/auth/v1/user**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(session.user),
      }),
    )

    await page.goto('/')
    // Should be on the home page, not redirected to login
    await expect(page).not.toHaveURL(/\/auth\/login/)
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()

    // Reload the page
    await page.reload()

    // Should still be on the home page
    await expect(page).not.toHaveURL(/\/auth\/login/)
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

test.describe('Auth — logout', () => {
  test('sign out redirects to login page', async ({ page }) => {
    const session = buildFakeSession()

    await page.addInitScript(
      ({ key, sessionJson }) => {
        localStorage.setItem('mise_onboarding_done', '1')
        localStorage.setItem(key, sessionJson)
      },
      { key: SUPABASE_STORAGE_KEY, sessionJson: JSON.stringify(session) },
    )

    // Mock /auth/v1/user so Supabase resolves the session user without hitting a real server
    await page.route('**/auth/v1/user**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(session.user),
      }),
    )

    // Mock the Supabase logout endpoint (POST /auth/v1/logout)
    await page.route('**/auth/v1/logout**', (route) =>
      route.fulfill({ status: 204, body: '' }),
    )

    await page.goto('/')
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()

    // Click the sign-out button in the desktop sidebar
    await page.getByRole('button', { name: 'Sign out' }).click()

    // Should be redirected to the login page
    await expect(page).toHaveURL(/\/auth\/login/)
  })
})
