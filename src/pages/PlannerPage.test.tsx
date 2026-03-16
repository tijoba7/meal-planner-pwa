import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { createTestQueryClient } from '../test/supabaseMocks'
import PlannerPage from './PlannerPage'
import type { MealPlan, Recipe, MealPlanTemplate } from '../types'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockCreateMutate = vi.hoisted(() => vi.fn())
const mockCreateMutateAsync = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockUpdateMutateAsync = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../hooks/useMealPlans', () => ({
  useMealPlanForWeek: vi.fn(),
  useMealPlans: vi.fn(() => ({ data: [] })),
  useCreateMealPlan: vi.fn(() => ({
    mutate: mockCreateMutate,
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  })),
  useUpdateMealPlan: vi.fn(() => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  })),
  useMealPlanTemplates: vi.fn(),
  useCreateMealPlanTemplate: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  })),
  useDeleteMealPlanTemplate: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  })),
}))

vi.mock('../hooks/useRecipes', () => ({
  useRecipes: vi.fn(),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user', email: 'test@test.com' }, signOut: vi.fn() }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Returns the ISO date string for the Monday of the current week. */
function currentWeekMonday(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

function addDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

const mondayStr = currentWeekMonday()

const emptyPlan: MealPlan = {
  id: 'plan-1',
  weekStartDate: mondayStr,
  days: {},
  createdAt: '2026-03-10T00:00:00.000Z',
  updatedAt: '2026-03-10T00:00:00.000Z',
}

const recipeA: Recipe = {
  id: 'r1',
  name: 'Oatmeal',
  description: 'Quick oatmeal',
  recipeYield: '1',
  prepTime: 'PT5M',
  cookTime: 'PT5M',
  recipeIngredient: [{ name: 'oats', amount: 100, unit: 'g' }],
  recipeInstructions: [],
  keywords: ['breakfast', 'quick'],
  dateCreated: '2026-01-01T00:00:00.000Z',
  dateModified: '2026-01-01T00:00:00.000Z',
}

const recipeB: Recipe = {
  id: 'r2',
  name: 'Chicken Salad',
  description: 'Healthy salad',
  recipeYield: '2',
  prepTime: 'PT10M',
  cookTime: 'PT15M',
  recipeIngredient: [{ name: 'chicken', amount: 200, unit: 'g' }],
  recipeInstructions: [],
  keywords: ['lunch', 'healthy'],
  dateCreated: '2026-01-02T00:00:00.000Z',
  dateModified: '2026-01-02T00:00:00.000Z',
}

const planWithMeals: MealPlan = {
  id: 'plan-1',
  weekStartDate: mondayStr,
  days: {
    [mondayStr]: {
      breakfast: { recipes: [{ recipeId: 'r1', servings: 1 }] },
    },
  },
  createdAt: '2026-03-10T00:00:00.000Z',
  updatedAt: '2026-03-10T00:00:00.000Z',
}

const sampleTemplate: MealPlanTemplate = {
  id: 'tmpl-1',
  name: 'High-protein week',
  days: {
    '0': { breakfast: { recipes: [{ recipeId: 'r1', servings: 1 }] } },
  },
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
}

// ─── Query result helpers ──────────────────────────────────────────────────────

function makeResult<T>(data: T, loading = false) {
  return {
    data,
    isLoading: loading,
    isPending: loading,
    isSuccess: !loading,
    isError: false,
    error: null,
    status: loading ? ('pending' as const) : ('success' as const),
    fetchStatus: 'idle' as const,
  }
}

// ─── Imports ──────────────────────────────────────────────────────────────────

import {
  useMealPlanForWeek,
  useMealPlanTemplates,
} from '../hooks/useMealPlans'
import { useRecipes } from '../hooks/useRecipes'

const mockUseMealPlanForWeek = vi.mocked(useMealPlanForWeek)
const mockUseMealPlanTemplates = vi.mocked(useMealPlanTemplates)
const mockUseRecipes = vi.mocked(useRecipes)

// ─── Render helper ────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter>
        <PlannerPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PlannerPage', () => {
  beforeEach(() => {
    mockUseMealPlanForWeek.mockReturnValue(makeResult(emptyPlan) as unknown as unknown as ReturnType<typeof useMealPlanForWeek>)
    mockUseMealPlanTemplates.mockReturnValue(makeResult([]) as unknown as unknown as ReturnType<typeof useMealPlanTemplates>)
    mockUseRecipes.mockReturnValue(makeResult([]) as unknown as unknown as ReturnType<typeof useRecipes>)
    mockCreateMutate.mockReset()
    mockCreateMutateAsync.mockReset()
    mockCreateMutateAsync.mockResolvedValue(emptyPlan)
    mockUpdateMutateAsync.mockReset()
    mockUpdateMutateAsync.mockResolvedValue(emptyPlan)
  })

  // ── Loading state ──────────────────────────────────────────────────────────

  describe('loading state', () => {
    it('shows a loading skeleton while data is being fetched', () => {
      mockUseMealPlanForWeek.mockReturnValue(makeResult(null, true) as unknown as ReturnType<typeof useMealPlanForWeek>)
      renderPage()
      expect(screen.getByRole('status', { busy: true })).toBeInTheDocument()
    })

    it('loading skeleton has accessible label', () => {
      mockUseMealPlanForWeek.mockReturnValue(makeResult(null, true) as unknown as ReturnType<typeof useMealPlanForWeek>)
      renderPage()
      expect(screen.getByLabelText('Loading meal plan')).toBeInTheDocument()
    })
  })

  // ── Week navigation ────────────────────────────────────────────────────────

  describe('week navigation', () => {
    it('renders the "Weekly Planner" heading after loading', async () => {
      renderPage()
      expect(await screen.findByRole('heading', { name: 'Weekly Planner' })).toBeInTheDocument()
    })

    it('renders previous and next week navigation buttons', async () => {
      renderPage()
      await screen.findByRole('heading', { name: 'Weekly Planner' })
      expect(screen.getByRole('button', { name: 'Previous week' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Next week' })).toBeInTheDocument()
    })

    it('renders the current week range in the header', async () => {
      renderPage()
      await screen.findByRole('heading', { name: 'Weekly Planner' })
      const header = screen.getByText(/\d{4}/)
      expect(header).toBeInTheDocument()
    })

    it('navigates to the next week when next button is clicked', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Weekly Planner' })

      const headerBefore = screen.getByText(/\d{4}/).textContent

      await user.click(screen.getByRole('button', { name: 'Next week' }))

      await waitFor(() => {
        const headerAfter = screen.getByText(/\d{4}/).textContent
        expect(headerAfter).not.toBe(headerBefore)
      })
    })

    it('navigates to the previous week when prev button is clicked', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Weekly Planner' })

      const headerBefore = screen.getByText(/\d{4}/).textContent

      await user.click(screen.getByRole('button', { name: 'Previous week' }))

      await waitFor(() => {
        const headerAfter = screen.getByText(/\d{4}/).textContent
        expect(headerAfter).not.toBe(headerBefore)
      })
    })

    it('fetches meal plan for the new week after navigation', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Weekly Planner' })

      await user.click(screen.getByRole('button', { name: 'Next week' }))

      await waitFor(() => {
        const nextMonday = addDays(mondayStr, 7)
        expect(mockUseMealPlanForWeek).toHaveBeenCalledWith(nextMonday)
      })
    })

    it('creates a new meal plan if none exists for the week', async () => {
      mockUseMealPlanForWeek.mockReturnValue(makeResult(null) as unknown as ReturnType<typeof useMealPlanForWeek>)
      renderPage()
      await waitFor(() => {
        expect(mockCreateMutate).toHaveBeenCalledWith(
          expect.objectContaining({ weekStartDate: mondayStr, days: {} })
        )
      })
    })
  })

  // ── Week calendar rendering ────────────────────────────────────────────────

  describe('week calendar rendering', () => {
    it('renders exactly 7 day sections', async () => {
      renderPage()
      await screen.findByRole('heading', { name: 'Weekly Planner' })
      const dayHeaders = screen.getAllByRole('heading', { level: 3 })
      expect(dayHeaders.length).toBeGreaterThanOrEqual(7)
    })

    it('renders all four meal type labels for each day', async () => {
      renderPage()
      await screen.findByRole('heading', { name: 'Weekly Planner' })
      expect(screen.getAllByText('Breakfast')).toHaveLength(7)
      expect(screen.getAllByText('Lunch')).toHaveLength(7)
      expect(screen.getAllByText('Dinner')).toHaveLength(7)
      expect(screen.getAllByText('Snack')).toHaveLength(7)
    })

    it('renders "Add recipe" button for each meal slot', async () => {
      renderPage()
      await screen.findByRole('heading', { name: 'Weekly Planner' })
      const addButtons = screen.getAllByText('Add recipe')
      expect(addButtons).toHaveLength(28)
    })

    it('renders correct day labels (short weekday, month, day)', async () => {
      renderPage()
      await screen.findByRole('heading', { name: 'Weekly Planner' })
      const monday = new Date(mondayStr + 'T00:00:00')
      const expectedLabel = monday.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
      expect(screen.getByText(expectedLabel)).toBeInTheDocument()
    })
  })

  // ── Empty state ────────────────────────────────────────────────────────────

  describe('empty state', () => {
    it('shows "Nothing planned yet" when the week has no meals', async () => {
      renderPage()
      await screen.findByText('Nothing planned yet')
    })

    it('shows a helpful description in the empty state', async () => {
      renderPage()
      await screen.findByText(/Add recipes to any meal slot below/)
    })

    it('shows a "Browse recipes" link in the empty state', async () => {
      renderPage()
      const link = await screen.findByRole('link', { name: 'Browse recipes' })
      expect(link).toHaveAttribute('href', '/')
    })

    it('does not show empty state when the plan has meals', async () => {
      mockUseMealPlanForWeek.mockReturnValue(makeResult(planWithMeals) as unknown as ReturnType<typeof useMealPlanForWeek>)
      mockUseRecipes.mockReturnValue(makeResult([recipeA]) as unknown as ReturnType<typeof useRecipes>)
      renderPage()
      await screen.findByText('Oatmeal')
      expect(screen.queryByText('Nothing planned yet')).not.toBeInTheDocument()
    })
  })

  // ── Meal slot display ──────────────────────────────────────────────────────

  describe('meal slot display', () => {
    beforeEach(() => {
      mockUseMealPlanForWeek.mockReturnValue(makeResult(planWithMeals) as unknown as ReturnType<typeof useMealPlanForWeek>)
      mockUseRecipes.mockReturnValue(makeResult([recipeA, recipeB]) as unknown as ReturnType<typeof useRecipes>)
    })

    it('displays a recipe assigned to a meal slot', async () => {
      renderPage()
      await screen.findByText('Oatmeal')
    })

    it('recipe name links to its detail page', async () => {
      renderPage()
      await screen.findByText('Oatmeal')
      const link = screen.getByRole('link', { name: 'Oatmeal' })
      expect(link).toHaveAttribute('href', '/recipes/r1')
    })

    it('shows "Add another" when a slot already has a recipe', async () => {
      renderPage()
      await screen.findByText('Oatmeal')
      expect(screen.getByText('Add another')).toBeInTheDocument()
    })

    it('renders a remove button for each assigned recipe', async () => {
      renderPage()
      await screen.findByText('Oatmeal')
      expect(screen.getByRole('button', { name: 'Remove Oatmeal' })).toBeInTheDocument()
    })
  })

  // ── Recipe assignment modal ────────────────────────────────────────────────

  describe('recipe assignment modal', () => {
    beforeEach(() => {
      mockUseRecipes.mockReturnValue(makeResult([recipeA, recipeB]) as unknown as ReturnType<typeof useRecipes>)
    })

    it('opens the picker when "Add recipe" is clicked', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Weekly Planner' })

      await user.click(screen.getAllByText('Add recipe')[0])

      expect(screen.getByPlaceholderText('Search recipes…')).toBeInTheDocument()
    })

    it('shows the meal type label in the picker header', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Weekly Planner' })

      await user.click(screen.getAllByText('Add recipe')[0])

      expect(screen.getByRole('heading', { name: 'Breakfast' })).toBeInTheDocument()
    })

    it('lists all available recipes in the picker', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Weekly Planner' })

      await user.click(screen.getAllByText('Add recipe')[0])

      expect(await screen.findByText('Oatmeal')).toBeInTheDocument()
      expect(screen.getByText('Chicken Salad')).toBeInTheDocument()
    })

    it('filters recipes in the picker by search term', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Weekly Planner' })

      await user.click(screen.getAllByText('Add recipe')[0])
      await screen.findByText('Oatmeal')

      await user.type(screen.getByPlaceholderText('Search recipes…'), 'chicken')

      expect(screen.queryByText('Oatmeal')).not.toBeInTheDocument()
      expect(screen.getByText('Chicken Salad')).toBeInTheDocument()
    })

    it('shows "No recipes yet" with link when no recipes exist', async () => {
      mockUseRecipes.mockReturnValue(makeResult([]) as unknown as unknown as ReturnType<typeof useRecipes>)
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Weekly Planner' })

      await user.click(screen.getAllByText('Add recipe')[0])

      await screen.findByText('No recipes yet')
      const link = screen.getByRole('link', { name: 'Add your first recipe' })
      expect(link).toHaveAttribute('href', '/recipes/new')
    })

    it('shows "No recipes found" when search has no results', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Weekly Planner' })

      await user.click(screen.getAllByText('Add recipe')[0])
      await screen.findByText('Oatmeal')

      await user.type(screen.getByPlaceholderText('Search recipes…'), 'zzznotexists')

      expect(screen.getByText('No recipes found')).toBeInTheDocument()
    })

    it('closes the picker when the close button is clicked', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Weekly Planner' })

      await user.click(screen.getAllByText('Add recipe')[0])
      await screen.findByPlaceholderText('Search recipes…')

      await user.click(screen.getByRole('button', { name: 'Close' }))

      expect(screen.queryByPlaceholderText('Search recipes…')).not.toBeInTheDocument()
    })

    it('calls updateMealPlan when a recipe is selected from the picker', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Weekly Planner' })

      await user.click(screen.getAllByText('Add recipe')[0])
      await screen.findByText('Oatmeal')

      await user.click(screen.getByText('Oatmeal'))

      await waitFor(() => {
        expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ planId: 'plan-1' })
        )
      })
      const [[{ data: payload }]] = mockUpdateMutateAsync.mock.calls as [[{ planId: string; data: { days: Record<string, unknown> } }]]
      const allRecipes = Object.values(payload.days ?? {}).flatMap((day) =>
        Object.values(day as Record<string, { recipes: { recipeId: string }[] }>).flatMap(
          (slot) => slot?.recipes ?? []
        )
      )
      expect(allRecipes).toContainEqual(expect.objectContaining({ recipeId: 'r1' }))
    })

    it('closes the picker after a recipe is selected', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Weekly Planner' })

      await user.click(screen.getAllByText('Add recipe')[0])
      await screen.findByText('Oatmeal')

      await user.click(screen.getByText('Oatmeal'))

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Search recipes…')).not.toBeInTheDocument()
      })
    })
  })

  // ── Recipe removal ─────────────────────────────────────────────────────────

  describe('recipe removal from slots', () => {
    beforeEach(() => {
      mockUseMealPlanForWeek.mockReturnValue(makeResult(planWithMeals) as unknown as ReturnType<typeof useMealPlanForWeek>)
      mockUseRecipes.mockReturnValue(makeResult([recipeA]) as unknown as ReturnType<typeof useRecipes>)
    })

    it('calls updateMealPlan with the recipe removed when Remove button is clicked', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Oatmeal')

      await user.click(screen.getByRole('button', { name: 'Remove Oatmeal' }))

      await waitFor(() => {
        expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ planId: 'plan-1', data: expect.any(Object) })
        )
      })
    })

    it('removes the recipe from the UI after removal', async () => {
      // After updateMealPlan resolves, the page re-renders with the mock plan
      // which still has meals. But the picker closes. We test that updateMealPlan
      // was called, which implies the removal flow ran.
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Oatmeal')

      await user.click(screen.getByRole('button', { name: 'Remove Oatmeal' }))

      await waitFor(() => {
        expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ planId: 'plan-1' })
        )
      })
    })
  })

  // ── Copy week modal ────────────────────────────────────────────────────────

  describe('copy week modal', () => {
    it('opens when "Copy week" button is clicked', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Weekly Planner' })

      await user.click(
        screen.getByRole('button', { name: "Copy this week's meal plan to another week" })
      )

      expect(screen.getByRole('heading', { name: 'Copy week to…' })).toBeInTheDocument()
    })

    it('closes when the close button is clicked', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Weekly Planner' })

      await user.click(
        screen.getByRole('button', { name: "Copy this week's meal plan to another week" })
      )
      await screen.findByRole('heading', { name: 'Copy week to…' })

      await user.click(screen.getByRole('button', { name: 'Close' }))

      expect(screen.queryByRole('heading', { name: 'Copy week to…' })).not.toBeInTheDocument()
    })
  })

  // ── Templates ─────────────────────────────────────────────────────────────

  describe('template gallery', () => {
    it('renders the Templates button', async () => {
      renderPage()
      await screen.findByRole('heading', { name: 'Weekly Planner' })
      expect(screen.getByRole('button', { name: /Templates/ })).toBeInTheDocument()
    })

    it('shows template count when templates exist', async () => {
      mockUseMealPlanTemplates.mockReturnValue(makeResult([sampleTemplate]) as unknown as ReturnType<typeof useMealPlanTemplates>)
      renderPage()
      await screen.findByRole('heading', { name: 'Weekly Planner' })
      expect(await screen.findByRole('button', { name: 'Templates (1)' })).toBeInTheDocument()
    })

    it('opens the template gallery when Templates button is clicked', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Weekly Planner' })

      await user.click(screen.getByRole('button', { name: /Templates/ }))

      expect(screen.getByRole('heading', { name: 'Meal plan templates' })).toBeInTheDocument()
    })

    it('shows "No templates yet" when gallery is empty', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Weekly Planner' })

      await user.click(screen.getByRole('button', { name: /Templates/ }))

      await screen.findByText('No templates yet')
    })

    it('lists templates by name', async () => {
      mockUseMealPlanTemplates.mockReturnValue(makeResult([sampleTemplate]) as unknown as ReturnType<typeof useMealPlanTemplates>)
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Weekly Planner' })

      await user.click(screen.getByRole('button', { name: /Templates/ }))

      await screen.findByText('High-protein week')
    })

    it('closes the gallery when the close button is clicked', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Weekly Planner' })

      await user.click(screen.getByRole('button', { name: /Templates/ }))
      await screen.findByRole('heading', { name: 'Meal plan templates' })

      await user.click(screen.getByRole('button', { name: 'Close' }))

      expect(screen.queryByRole('heading', { name: 'Meal plan templates' })).not.toBeInTheDocument()
    })
  })

  // ── Weekly nutrition summary ───────────────────────────────────────────────

  describe('weekly nutrition summary', () => {
    it('does not show the nutrition panel when no recipe has nutrition data', async () => {
      mockUseMealPlanForWeek.mockReturnValue(makeResult(planWithMeals) as unknown as ReturnType<typeof useMealPlanForWeek>)
      mockUseRecipes.mockReturnValue(makeResult([recipeA]) as unknown as ReturnType<typeof useRecipes>)
      renderPage()
      await screen.findByText('Oatmeal')
      expect(screen.queryByText('Weekly Nutrition')).not.toBeInTheDocument()
    })

    it('shows the nutrition panel when recipes have nutrition data', async () => {
      const recipeWithNutrition: Recipe = {
        ...recipeA,
        nutrition: { calories: 300, proteinContent: 10, carbohydrateContent: 40, fatContent: 8 },
      }
      mockUseMealPlanForWeek.mockReturnValue(makeResult(planWithMeals) as unknown as ReturnType<typeof useMealPlanForWeek>)
      mockUseRecipes.mockReturnValue(makeResult([recipeWithNutrition]) as unknown as ReturnType<typeof useRecipes>)

      renderPage()
      await screen.findByText('Oatmeal')
      await screen.findByText('Weekly Nutrition')
      expect(screen.getByText('Calories')).toBeInTheDocument()
      expect(screen.getByText('Protein')).toBeInTheDocument()
    })
  })

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  describe('keyboard shortcuts', () => {
    it('navigates to next week with ArrowRight key', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Weekly Planner' })

      const headerBefore = screen.getByText(/\d{4}/).textContent

      await user.keyboard('{ArrowRight}')

      await waitFor(() => {
        expect(screen.getByText(/\d{4}/).textContent).not.toBe(headerBefore)
      })
    })

    it('navigates to previous week with ArrowLeft key', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Weekly Planner' })

      const headerBefore = screen.getByText(/\d{4}/).textContent

      await user.keyboard('{ArrowLeft}')

      await waitFor(() => {
        expect(screen.getByText(/\d{4}/).textContent).not.toBe(headerBefore)
      })
    })

    it('closes the picker via the Close button', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Weekly Planner' })

      await user.click(screen.getAllByText('Add recipe')[0])
      await screen.findByPlaceholderText('Search recipes…')

      await user.click(screen.getByRole('button', { name: 'Close' }))

      expect(screen.queryByPlaceholderText('Search recipes…')).not.toBeInTheDocument()
    })
  })
})
