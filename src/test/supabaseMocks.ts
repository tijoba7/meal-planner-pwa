import { vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

/**
 * Shared Supabase + TanStack Query mock utilities for unit tests.
 *
 * Usage pattern in each hook test file:
 *
 *   vi.mock('../lib/supabase', () => ({ supabase: createSupabaseMock() }))
 *   vi.mock('../contexts/AuthContext', () => ({ useAuth: () => fakeUser() }))
 *
 *   const { mockFrom } = getSupabaseMock()
 *
 *   it('...', async () => {
 *     mockFrom.mockReturnValue(buildBuilder({ data: [...], error: null }))
 *     const { result } = renderHook(() => useRecipes(), { wrapper: createWrapper() })
 *     await waitFor(() => expect(result.current.isSuccess).toBe(true))
 *   })
 */

// ─── Fake user ────────────────────────────────────────────────────────────────

export const TEST_USER_ID = 'test-user-00000000-0000-0000-0000-000000000001'

export function fakeUser() {
  return {
    user: {
      id: TEST_USER_ID,
      email: 'test@braisely.local',
      aud: 'authenticated',
      role: 'authenticated',
    },
    session: null,
    loading: false,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signInWithMagicLink: vi.fn(),
    signOut: vi.fn(),
    resetPassword: vi.fn(),
    updatePassword: vi.fn(),
  }
}

// ─── Supabase PostgREST builder mock ─────────────────────────────────────────

/**
 * Creates a chainable mock builder that resolves to `result` when awaited.
 *
 * Supports the full PostgREST chain:
 *   supabase.from('t').select().eq().order()   → awaits to result
 *   supabase.from('t').insert({})               → awaits to result
 *   supabase.from('t').update({}).eq().eq()     → awaits to result
 *   supabase.from('t').delete().eq().eq()       → awaits to result
 *   supabase.from('t').select().single()        → Promise resolving to result
 *   supabase.from('t').select().maybeSingle()   → Promise resolving to result
 */
export function buildBuilder(result: { data: unknown; error: null | { message: string } }) {
  // All builder methods except terminal ones return `builder` itself.
  // The builder is also thenable so `await builder` resolves with `result`.
  const builder: Record<string, unknown> = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    filter: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    // Make the builder thenable so that awaiting the end of a chain resolves
    // with `result` (the same resolution used by .single() / .maybeSingle()).
    then: (
      resolve: (value: typeof result) => unknown,
      reject: (err: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  }

  // Chain methods return the builder itself
  const chainMethods = ['select', 'insert', 'update', 'delete', 'eq', 'order', 'filter']
  chainMethods.forEach((m) => {
    ;(builder[m] as ReturnType<typeof vi.fn>).mockReturnValue(builder)
  })

  return builder as {
    select: ReturnType<typeof vi.fn>
    insert: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    filter: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
    maybeSingle: ReturnType<typeof vi.fn>
    then: (
      resolve: (value: typeof result) => unknown,
      reject: (err: unknown) => unknown,
    ) => Promise<unknown>
  }
}

// ─── QueryClient ──────────────────────────────────────────────────────────────

/**
 * Creates a QueryClient suitable for tests:
 * - No retries (fail fast)
 * - No garbage collection delay
 * - No stale time (always refetch in tests)
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

/**
 * Returns a React wrapper component that provides QueryClientProvider.
 * Pass a fresh queryClient per test to prevent state leaking between tests.
 */
export function createWrapper(queryClient?: QueryClient) {
  const qc = queryClient ?? createTestQueryClient()
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children)
  }
}
