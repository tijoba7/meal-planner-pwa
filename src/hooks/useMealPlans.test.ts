import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import {
  buildBuilder,
  createTestQueryClient,
  createWrapper,
  fakeUser,
  TEST_USER_ID,
} from '../test/supabaseMocks'
import type { MealPlan } from '../types'

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => fakeUser(),
}))

import { supabase } from '../lib/supabase'
import {
  useMealPlans,
  useMealPlan,
  useMealPlanForWeek,
  useCreateMealPlan,
  useDeleteMealPlan,
  useMealPlanTemplates,
  useCreateMealPlanTemplate,
} from './useMealPlans'
import { db } from '../lib/db'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makePlan(overrides: Partial<MealPlan> = {}): MealPlan {
  return {
    id: 'plan-001',
    weekStartDate: '2026-03-16',
    days: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(async () => {
  vi.mocked(supabase.from).mockReset()
  if (!db.isOpen()) await db.open()
  await Promise.all([db.mealPlans.clear(), db.mealPlanTemplates.clear()])
})

// ─── useMealPlans ─────────────────────────────────────────────────────────────

describe('useMealPlans', () => {
  it('returns meal plans fetched from Supabase', async () => {
    const plan = makePlan()
    vi.mocked(supabase.from).mockReturnValue(
      buildBuilder({ data: [{ id: plan.id, data: plan }], error: null }) as never,
    )

    const { result } = renderHook(() => useMealPlans(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].weekStartDate).toBe('2026-03-16')
  })

  it('writes fetched plans to Dexie cache', async () => {
    const plan = makePlan({ id: 'plan-cache' })
    vi.mocked(supabase.from).mockReturnValue(
      buildBuilder({ data: [{ id: plan.id, data: plan }], error: null }) as never,
    )

    const { result } = renderHook(() => useMealPlans(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const cached = await db.mealPlans.get('plan-cache')
    expect(cached?.weekStartDate).toBe('2026-03-16')
  })

  it('enters error state when Supabase returns an error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      buildBuilder({ data: null, error: { message: 'fetch failed' } }) as never,
    )

    const { result } = renderHook(() => useMealPlans(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

// ─── useMealPlan ──────────────────────────────────────────────────────────────

describe('useMealPlan', () => {
  it('fetches a single plan and falls back to Dexie on error', async () => {
    const plan = makePlan({ id: 'plan-offline' })
    await db.mealPlans.put(plan)

    const builder = buildBuilder({ data: null, error: { message: 'offline' } })
    builder.single.mockResolvedValue({ data: null, error: { message: 'offline' } })
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const { result } = renderHook(() => useMealPlan('plan-offline'), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.weekStartDate).toBe('2026-03-16')
  })

  it('is disabled when planId is empty', () => {
    const { result } = renderHook(() => useMealPlan(''), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    expect(result.current.fetchStatus).toBe('idle')
  })
})

// ─── useMealPlanForWeek ───────────────────────────────────────────────────────

describe('useMealPlanForWeek', () => {
  it('returns the plan for the given week', async () => {
    const plan = makePlan({ weekStartDate: '2026-03-16' })
    const builder = buildBuilder({ data: { id: plan.id, data: plan }, error: null })
    builder.maybeSingle.mockResolvedValue({ data: { id: plan.id, data: plan }, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const { result } = renderHook(() => useMealPlanForWeek('2026-03-16'), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.weekStartDate).toBe('2026-03-16')
  })

  it('returns null when no plan exists for the week', async () => {
    const builder = buildBuilder({ data: null, error: null })
    builder.maybeSingle.mockResolvedValue({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const { result } = renderHook(() => useMealPlanForWeek('2026-01-01'), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it('falls back to Dexie when Supabase errors', async () => {
    const plan = makePlan({ id: 'plan-dexie-week', weekStartDate: '2026-02-01' })
    await db.mealPlans.put(plan)

    const builder = buildBuilder({ data: null, error: { message: 'offline' } })
    builder.maybeSingle.mockResolvedValue({ data: null, error: { message: 'offline' } })
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const { result } = renderHook(() => useMealPlanForWeek('2026-02-01'), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.weekStartDate).toBe('2026-02-01')
  })

  it('is disabled when weekStartDate is empty', () => {
    const { result } = renderHook(() => useMealPlanForWeek(''), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    expect(result.current.fetchStatus).toBe('idle')
  })
})

// ─── useCreateMealPlan ────────────────────────────────────────────────────────

describe('useCreateMealPlan', () => {
  it('creates a meal plan in Supabase and writes to Dexie', async () => {
    const builder = buildBuilder({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const { result } = renderHook(() => useCreateMealPlan(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    result.current.mutate({ weekStartDate: '2026-04-07', days: {} })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const plan = result.current.data!
    expect(plan.weekStartDate).toBe('2026-04-07')
    expect(plan.id).toBeTruthy()

    const cached = await db.mealPlans.get(plan.id)
    expect(cached?.weekStartDate).toBe('2026-04-07')
  })
})

// ─── useDeleteMealPlan ────────────────────────────────────────────────────────

describe('useDeleteMealPlan', () => {
  it('deletes a plan from Supabase and Dexie', async () => {
    const plan = makePlan({ id: 'plan-to-delete' })
    await db.mealPlans.put(plan)

    const builder = buildBuilder({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const { result } = renderHook(() => useDeleteMealPlan(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    result.current.mutate('plan-to-delete')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const gone = await db.mealPlans.get('plan-to-delete')
    expect(gone).toBeUndefined()
  })
})

// ─── useMealPlanTemplates (Dexie-only) ────────────────────────────────────────

describe('useMealPlanTemplates', () => {
  it('returns templates from Dexie', async () => {
    await db.mealPlanTemplates.add({
      id: 't-001',
      name: 'Week 1',
      days: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })

    const { result } = renderHook(() => useMealPlanTemplates(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].name).toBe('Week 1')
  })

  it('returns an empty array when no templates exist', async () => {
    const { result } = renderHook(() => useMealPlanTemplates(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(0)
  })
})

// ─── useCreateMealPlanTemplate ─────────────────────────────────────────────────

describe('useCreateMealPlanTemplate', () => {
  it('persists a template to Dexie', async () => {
    const { result } = renderHook(() => useCreateMealPlanTemplate(), {
      wrapper: createWrapper(createTestQueryClient()),
    })

    result.current.mutate({ name: 'My Template', days: {} })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const all = await db.mealPlanTemplates.toArray()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('My Template')
  })
})

// ─── Query key scoping ────────────────────────────────────────────────────────

describe('query key scoping', () => {
  it('scopes meal plans by user ID', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      buildBuilder({ data: [], error: null }) as never,
    )

    const qc = createTestQueryClient()
    renderHook(() => useMealPlans(), { wrapper: createWrapper(qc) })

    await waitFor(() =>
      expect(qc.getQueryState(['meal-plans', TEST_USER_ID])).toBeDefined(),
    )
  })
})
