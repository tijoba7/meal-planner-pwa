import { test as base } from '@playwright/test'
import { RecipesPageObject } from './page-objects/RecipesPage'
import { PlannerPageObject } from './page-objects/PlannerPage'
import { ShoppingPageObject } from './page-objects/ShoppingPage'

/**
 * Extended test fixtures providing page object models for key pages.
 *
 * Usage:
 *   import { test, expect } from '../fixtures'
 *   test('adds a recipe', async ({ recipesPage }) => { ... })
 *
 * Auth + data strategy:
 *   Supabase is mandatory. The page fixture:
 *   1. Injects a fake authenticated session into localStorage so ProtectedRoute
 *      renders the app. Storage key = `sb-localhost-auth-token` (derived from
 *      VITE_SUPABASE_URL='http://localhost:54321' hostname).
 *   2. Intercepts /auth/v1/* so Supabase doesn't get network errors validating
 *      the fake session.
 *   3. Mounts an in-memory PostgREST-compatible mock for /rest/v1/* that
 *      persists INSERT/UPDATE/DELETE within each test. This allows tests that
 *      create recipes/plans/etc. via the UI to immediately see that data when
 *      the app re-queries Supabase, without needing a real Supabase instance.
 */

// Supabase JS v2 storage key — derived from VITE_SUPABASE_URL hostname
const SUPABASE_STORAGE_KEY = 'sb-localhost-auth-token'

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

/**
 * Parse PostgREST equality filters from URL query string.
 * e.g. `?id=eq.abc&author_id=eq.xyz` → { id: 'abc', author_id: 'xyz' }
 */
function parseEqFilters(search: string): Record<string, string> {
  const filters: Record<string, string> = {}
  const params = new URLSearchParams(search)
  for (const [key, value] of params) {
    if (value.startsWith('eq.')) {
      filters[key] = value.slice(3)
    }
  }
  return filters
}

/** Apply equality filters to a row. Returns true if all filters match.
 * Handles PostgREST JSON path operators like `data->>weekStartDate`. */
function matchesFilters(row: Record<string, unknown>, filters: Record<string, string>): boolean {
  return Object.entries(filters).every(([key, value]) => {
    // Handle PostgREST JSON extraction operator: `col->>field`
    // e.g. `data->>weekStartDate` → parse row.data as JSON, compare .weekStartDate
    const jsonPathMatch = key.match(/^(\w+)->>\s*(.+)$/)
    if (jsonPathMatch) {
      const [, col, field] = jsonPathMatch
      try {
        const parsed = typeof row[col] === 'string' ? JSON.parse(row[col] as string) : row[col]
        return String((parsed as Record<string, unknown>)[field]) === value
      } catch {
        return false
      }
    }
    return String(row[key]) === value
  })
}

export const test = base.extend<{
  recipesPage: RecipesPageObject
  plannerPage: PlannerPageObject
  shoppingPage: ShoppingPageObject
}>({
  // Inject a fake authenticated session, dismiss the onboarding wizard, and
  // mount an in-memory Supabase mock so CRUD operations work without a real
  // Supabase instance.
  page: async ({ page }, use) => {
    const session = buildFakeSession()

    const userId = session.user.id
    await page.addInitScript(
      ({ key, sessionJson, userId }) => {
        localStorage.setItem('braisely_onboarding_done', '1')
        localStorage.setItem(key, sessionJson)
        // Skip the cloud-migration prompt — tests that create recipes would
        // otherwise see the MigrationPrompt modal (because saved recipes go
        // into Dexie and trigger the "you have local data" check).
        localStorage.setItem(
          `braisely:migration:${userId}`,
          JSON.stringify({ skipped: true, skippedAt: new Date().toISOString() }),
        )
      },
      { key: SUPABASE_STORAGE_KEY, sessionJson: JSON.stringify(session), userId },
    )

    // ── Auth API mocks ────────────────────────────────────────────────────────
    await page.route('**/auth/v1/user**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(session.user),
      }),
    )
    await page.route('**/auth/v1/token**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(session),
      }),
    )

    // ── In-memory PostgREST mock ──────────────────────────────────────────────
    //
    // Each table is stored as an array of plain objects. Mutations (POST/PATCH/DELETE)
    // are applied immediately so the next GET sees the updated data. Filters are
    // applied using PostgREST's `col=eq.value` syntax.
    //
    // This is intentionally minimal: it handles the equality filters and column
    // selection that the hooks in this app actually use. Complex operators
    // (in, like, range, etc.) are not supported.

    const store: Record<string, Record<string, unknown>[]> = {}

    function getTable(name: string) {
      if (!store[name]) store[name] = []
      return store[name]
    }

    await page.route('**/rest/v1/**', async (route) => {
      const url = new URL(route.request().url())
      // Extract table name from path: /rest/v1/<table>
      const table = url.pathname.replace(/^.*\/rest\/v1\//, '').split('?')[0]
      const method = route.request().method()
      const filters = parseEqFilters(url.search)
      const accept = route.request().headers()['accept'] ?? ''
      const isSingle = accept.includes('vnd.pgrst.object')
      const rows = getTable(table)

      if (method === 'GET') {
        const matched = rows.filter((r) => matchesFilters(r, filters))
        if (isSingle) {
          // Single-row query — return the first match or a 406 PGRST error
          if (matched.length > 0) {
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(matched[0]),
            })
          } else {
            route.fulfill({
              status: 406,
              contentType: 'application/json',
              body: JSON.stringify({
                code: 'PGRST116',
                details: 'The result contains 0 rows',
                hint: null,
                message: 'JSON object requested, multiple (or no) rows returned',
              }),
            })
          }
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(matched),
          })
        }
      } else if (method === 'POST') {
        const raw = route.request().postData() ?? '[]'
        const body = JSON.parse(raw)
        const inserted = Array.isArray(body) ? body : [body]
        store[table] = [...rows, ...inserted]
        // Supabase INSERT returns the inserted rows by default (Prefer: return=representation)
        const prefer = route.request().headers()['prefer'] ?? ''
        if (prefer.includes('return=representation')) {
          route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify(inserted),
          })
        } else {
          route.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
        }
      } else if (method === 'PATCH') {
        const raw = route.request().postData() ?? '{}'
        const patch = JSON.parse(raw)
        store[table] = rows.map((r) =>
          matchesFilters(r, filters) ? { ...r, ...patch } : r,
        )
        const updated = store[table].filter((r) => matchesFilters(r, filters))
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(updated),
        })
      } else if (method === 'DELETE') {
        store[table] = rows.filter((r) => !matchesFilters(r, filters))
        route.fulfill({ status: 204, body: '' })
      } else {
        route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      }
    })

    await use(page)
  },
  recipesPage: async ({ page }, use) => {
    await use(new RecipesPageObject(page))
  },
  plannerPage: async ({ page }, use) => {
    await use(new PlannerPageObject(page))
  },
  shoppingPage: async ({ page }, use) => {
    await use(new ShoppingPageObject(page))
  },
})

export { expect } from '@playwright/test'
