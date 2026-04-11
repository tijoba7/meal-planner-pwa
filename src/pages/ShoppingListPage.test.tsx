import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { createTestQueryClient } from '../test/supabaseMocks'
import { ToastProvider } from '../contexts/ToastContext'
import type { ShoppingList, MealPlan, Recipe } from '../types'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockCreateMutateAsync,
  mockDeleteMutateAsync,
  mockToggleMutateAsync,
  mockUpdateMutateAsync,
  mockShareMutateAsync,
  mockUnshareMutateAsync,
  mockGetMyHouseholds,
  mockSubscribeToHouseholdShoppingLists,
} = vi.hoisted(() => ({
  mockCreateMutateAsync: vi.fn(),
  mockDeleteMutateAsync: vi.fn().mockResolvedValue(undefined),
  mockToggleMutateAsync: vi.fn().mockResolvedValue(undefined),
  mockUpdateMutateAsync: vi.fn().mockResolvedValue(undefined),
  mockShareMutateAsync: vi.fn().mockResolvedValue(undefined),
  mockUnshareMutateAsync: vi.fn().mockResolvedValue(undefined),
  mockGetMyHouseholds: vi.fn().mockResolvedValue([]),
  mockSubscribeToHouseholdShoppingLists: vi.fn(() => vi.fn()),
}))

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../hooks/useShoppingLists', () => ({
  useShoppingLists: vi.fn(),
  useShoppingList: vi.fn(),
  useCreateShoppingList: vi.fn(() => ({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  })),
  useUpdateShoppingList: vi.fn(() => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  })),
  useDeleteShoppingList: vi.fn(() => ({
    mutateAsync: mockDeleteMutateAsync,
    isPending: false,
  })),
  useToggleShoppingItem: vi.fn(() => ({
    mutateAsync: mockToggleMutateAsync,
    isPending: false,
  })),
  useShareShoppingList: vi.fn(() => ({
    mutateAsync: mockShareMutateAsync,
    isPending: false,
  })),
  useUnshareShoppingList: vi.fn(() => ({
    mutateAsync: mockUnshareMutateAsync,
    isPending: false,
  })),
  shoppingListKeys: { detail: (id: string) => ['shopping-list', id] },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'test-user-shopping-page',
      email: 'test@braisely.local',
    },
    session: null,
    loading: false,
  }),
}))

vi.mock('../lib/householdService', () => ({
  getMyHouseholds: mockGetMyHouseholds,
  subscribeToHouseholdShoppingLists: mockSubscribeToHouseholdShoppingLists,
}))

vi.mock('../hooks/useMealPlans', () => ({
  useMealPlans: vi.fn(() => ({ data: [] })),
}))

vi.mock('../hooks/useRecipes', () => ({
  useRecipes: vi.fn(() => ({ data: [] })),
}))

vi.mock('../hooks/usePantryItems', () => ({
  usePantryItems: vi.fn(() => ({ data: [] })),
}))

// ─── Imports for vi.mocked calls ─────────────────────────────────────────────

import ShoppingListPage from './ShoppingListPage'
import { useShoppingLists, useShoppingList } from '../hooks/useShoppingLists'
import { useRecipes } from '../hooks/useRecipes'
import { useMealPlans } from '../hooks/useMealPlans'

const mockUseShoppingLists = vi.mocked(useShoppingLists)
const mockUseShoppingList = vi.mocked(useShoppingList)

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const item1 = { id: 'item-1', name: 'Milk', amount: 2, unit: 'cups', checked: false }
const item2 = { id: 'item-2', name: 'Eggs', amount: 6, unit: 'pcs', checked: false }
const item3 = { id: 'item-3', name: 'Butter', amount: 1, unit: 'tbsp', checked: true }

const sampleList: ShoppingList = {
  id: 'list-1',
  name: 'Week 1 Groceries',
  items: [item1, item2, item3],
  createdAt: '2026-03-10T00:00:00.000Z',
  updatedAt: '2026-03-10T00:00:00.000Z',
}

const emptyList: ShoppingList = {
  id: 'list-2',
  name: 'Empty List',
  items: [],
  createdAt: '2026-03-11T00:00:00.000Z',
  updatedAt: '2026-03-11T00:00:00.000Z',
}

// ─── Render helper ────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ToastProvider>
        <MemoryRouter>
          <ShoppingListPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ShoppingListPage', () => {
  beforeEach(() => {
    vi.mocked(useRecipes).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useRecipes>)
    vi.mocked(useMealPlans).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useMealPlans>)
    mockUseShoppingLists.mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useShoppingLists>)
    // Return no active list by default (id is '' when activeListId is null)
    mockUseShoppingList.mockImplementation(
      (id) =>
        ({
          data: id ? sampleList : undefined,
        }) as ReturnType<typeof useShoppingList>
    )
    mockCreateMutateAsync.mockResolvedValue(sampleList)
    mockDeleteMutateAsync.mockResolvedValue(undefined)
    mockToggleMutateAsync.mockResolvedValue(undefined)
    mockUpdateMutateAsync.mockResolvedValue(undefined)
    mockShareMutateAsync.mockReset()
    mockUnshareMutateAsync.mockReset()
    mockGetMyHouseholds.mockReset()
    mockSubscribeToHouseholdShoppingLists.mockReset()
    mockShareMutateAsync.mockResolvedValue(undefined)
    mockUnshareMutateAsync.mockResolvedValue(undefined)
    mockGetMyHouseholds.mockResolvedValue([])
    mockSubscribeToHouseholdShoppingLists.mockReturnValue(vi.fn())
  })

  // ── Loading state ──────────────────────────────────────────────────────────

  describe('loading state', () => {
    it('shows a loading skeleton while data is being fetched', () => {
      mockUseShoppingLists.mockReturnValue({
        data: undefined,
        isLoading: true,
      } as unknown as ReturnType<typeof useShoppingLists>)
      renderPage()
      expect(screen.getByRole('status', { busy: true })).toBeInTheDocument()
    })
  })

  // ── Empty state ────────────────────────────────────────────────────────────

  describe('empty state', () => {
    it('shows "No shopping lists yet" when there are no lists', async () => {
      renderPage()
      await screen.findByText('No shopping lists yet')
    })

    it('shows a helpful description', async () => {
      renderPage()
      await screen.findByText('Create one from your meal plan to auto-generate your grocery list.')
    })

    it('clicking "Create a list" opens the create form', async () => {
      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByRole('button', { name: 'Create a list' }))
      expect(screen.getByRole('heading', { name: 'New Shopping List' })).toBeInTheDocument()
    })
  })

  // ── List view ──────────────────────────────────────────────────────────────

  describe('list view', () => {
    beforeEach(() => {
      mockUseShoppingLists.mockReturnValue({
        data: [sampleList],
        isLoading: false,
      } as unknown as ReturnType<typeof useShoppingLists>)
    })

    it('renders the page heading', async () => {
      renderPage()
      expect(await screen.findByRole('heading', { name: 'Shopping Lists' })).toBeInTheDocument()
    })

    it('renders each list name', async () => {
      renderPage()
      expect(await screen.findByText('Week 1 Groceries')).toBeInTheDocument()
    })

    it('renders item count for each list', async () => {
      renderPage()
      await screen.findByText('Week 1 Groceries')
      expect(screen.getByText(/3 items/)).toBeInTheDocument()
    })

    it('renders checked item count for each list', async () => {
      renderPage()
      await screen.findByText('Week 1 Groceries')
      expect(screen.getByText(/1 checked/)).toBeInTheDocument()
    })

    it('renders a Delete button for each list', async () => {
      renderPage()
      await screen.findByText('Week 1 Groceries')
      expect(screen.getByRole('button', { name: /delete week 1 groceries/i })).toBeInTheDocument()
    })

    it('renders the "+ New List" button', async () => {
      renderPage()
      expect(await screen.findByRole('button', { name: /new shopping list/i })).toBeInTheDocument()
    })
  })

  // ── Create form ────────────────────────────────────────────────────────────

  describe('create form', () => {
    beforeEach(() => {
      mockUseShoppingLists.mockReturnValue({
        data: [sampleList],
        isLoading: false,
      } as unknown as ReturnType<typeof useShoppingLists>)
    })

    it('opens when "+ New List" is clicked', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Shopping Lists' })
      await user.click(screen.getByRole('button', { name: /new shopping list/i }))
      expect(screen.getByRole('heading', { name: 'New Shopping List' })).toBeInTheDocument()
    })

    it('closes when the Close button is clicked', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Shopping Lists' })
      await user.click(screen.getByRole('button', { name: /new shopping list/i }))
      const dialog = screen.getByRole('dialog', { name: /new shopping list/i })
      await user.click(within(dialog).getByRole('button', { name: /^close$/i }))

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /new shopping list/i })).toHaveAttribute(
          'data-state',
          'closed'
        )
      })
    })

    it('"Create List" is disabled when the list name is empty', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Shopping Lists' })
      await user.click(screen.getByRole('button', { name: /new shopping list/i }))
      expect(screen.getByRole('button', { name: 'Create List' })).toBeDisabled()
    })

    it('"Create List" is enabled once a name is entered', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Shopping Lists' })
      await user.click(screen.getByRole('button', { name: /new shopping list/i }))
      await user.type(screen.getByPlaceholderText("e.g. This week's groceries"), 'My List')
      expect(screen.getByRole('button', { name: 'Create List' })).not.toBeDisabled()
    })

    it('calls createShoppingList with the entered name', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Shopping Lists' })
      await user.click(screen.getByRole('button', { name: /new shopping list/i }))
      await user.type(
        screen.getByPlaceholderText("e.g. This week's groceries"),
        'Week 1 Groceries'
      )
      await user.click(screen.getByRole('button', { name: 'Create List' }))
      await waitFor(() => {
        expect(mockCreateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Week 1 Groceries' })
        )
      })
    })
  })

  // ── Ingredient aggregation ─────────────────────────────────────────────────

  describe('ingredient aggregation from meal plan', () => {
    function currentWeekMondayStr(): string {
      const d = new Date()
      const day = d.getDay()
      const diff = day === 0 ? -6 : 1 - day
      d.setDate(d.getDate() + diff)
      d.setHours(0, 0, 0, 0)
      return d.toISOString().slice(0, 10)
    }

    it('passes aggregated ingredients from the meal plan to createShoppingList', async () => {
      const mondayStr = currentWeekMondayStr()

      const recipe: Recipe = {
        id: 'r1',
        name: 'Pasta',
        description: '',
        recipeYield: '4',
        prepTime: 'PT10M',
        cookTime: 'PT20M',
        recipeIngredient: [{ name: 'pasta', amount: 400, unit: 'g' }],
        recipeInstructions: [],
        keywords: [],
        dateCreated: '2026-01-01T00:00:00.000Z',
        dateModified: '2026-01-01T00:00:00.000Z',
      }

      const mealPlan: MealPlan = {
        id: 'mp1',
        weekStartDate: mondayStr,
        days: {
          [mondayStr]: {
            dinner: { recipes: [{ recipeId: 'r1', servings: 4 }] },
          },
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }

      vi.mocked(useRecipes).mockReturnValue({ data: [recipe] } as ReturnType<typeof useRecipes>)
      vi.mocked(useMealPlans).mockReturnValue({
        data: [mealPlan],
      } as ReturnType<typeof useMealPlans>)
      mockUseShoppingLists.mockReturnValue({
        data: [sampleList],
        isLoading: false,
      } as unknown as ReturnType<typeof useShoppingLists>)

      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Shopping Lists' })
      await user.click(screen.getByRole('button', { name: /new shopping list/i }))
      await user.type(screen.getByPlaceholderText("e.g. This week's groceries"), 'Test List')
      await user.click(screen.getByRole('button', { name: 'Create List' }))

      await waitFor(() => {
        expect(mockCreateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            items: expect.arrayContaining([
              expect.objectContaining({ name: 'pasta', amount: 400, unit: 'g' }),
            ]),
          })
        )
      })
    })

    it('auto-shares a generated list when the source meal plan is shared', async () => {
      const mondayStr = currentWeekMondayStr()
      const sharedPlan: MealPlan = {
        id: 'mp-shared',
        weekStartDate: mondayStr,
        days: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        householdId: 'house-auto-share',
      }

      vi.mocked(useMealPlans).mockReturnValue({
        data: [sharedPlan],
      } as ReturnType<typeof useMealPlans>)
      mockCreateMutateAsync.mockResolvedValue({
        ...sampleList,
        id: 'list-auto-shared',
        name: 'Auto Shared List',
      })

      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Shopping Lists' })
      await user.click(screen.getByRole('button', { name: /new shopping list/i }))
      await user.type(screen.getByPlaceholderText("e.g. This week's groceries"), 'Auto Shared List')
      await user.click(screen.getByRole('button', { name: 'Create List' }))

      await waitFor(() => {
        expect(mockShareMutateAsync).toHaveBeenCalledWith({
          listId: 'list-auto-shared',
          householdId: 'house-auto-share',
        })
      })
    })
  })

  // ── List deletion ──────────────────────────────────────────────────────────

  describe('list deletion', () => {
    beforeEach(() => {
      mockUseShoppingLists.mockReturnValue({
        data: [sampleList],
        isLoading: false,
      } as unknown as ReturnType<typeof useShoppingLists>)
    })

    it('calls deleteShoppingList with the correct id', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Week 1 Groceries')
      await user.click(screen.getByRole('button', { name: /delete week 1 groceries/i }))
      await waitFor(() => {
        expect(mockDeleteMutateAsync).toHaveBeenCalledWith('list-1')
      })
    })
  })

  // ── Detail view ────────────────────────────────────────────────────────────

  describe('detail view', () => {
    beforeEach(() => {
      mockUseShoppingLists.mockReturnValue({
        data: [sampleList],
        isLoading: false,
      } as unknown as ReturnType<typeof useShoppingLists>)
      mockUseShoppingList.mockImplementation(
        (id) =>
          ({
            data: id ? sampleList : undefined,
          }) as ReturnType<typeof useShoppingList>
      )
    })

    it('opens when a list card is clicked', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Week 1 Groceries')
      await user.click(screen.getByRole('button', { name: /open week 1 groceries/i }))
      expect(await screen.findByRole('heading', { name: 'Week 1 Groceries' })).toBeInTheDocument()
    })

    it('shows checked / total item count', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Week 1 Groceries')
      await user.click(screen.getByRole('button', { name: /open week 1 groceries/i }))
      await screen.findByRole('heading', { name: 'Week 1 Groceries' })
      expect(screen.getByText('1 of 3 items checked')).toBeInTheDocument()
    })

    it('renders unchecked items', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Week 1 Groceries')
      await user.click(screen.getByRole('button', { name: /open week 1 groceries/i }))
      await screen.findByRole('heading', { name: 'Week 1 Groceries' })
      expect(screen.getByText('Milk')).toBeInTheDocument()
      expect(screen.getByText('Eggs')).toBeInTheDocument()
    })

    it('renders checked items in a "Checked off" section', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Week 1 Groceries')
      await user.click(screen.getByRole('button', { name: /open week 1 groceries/i }))
      await screen.findByRole('heading', { name: 'Week 1 Groceries' })
      expect(screen.getByText('Checked off')).toBeInTheDocument()
      expect(screen.getByText('Butter')).toBeInTheDocument()
    })

    it('back button returns to the list view', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Week 1 Groceries')
      await user.click(screen.getByRole('button', { name: /open week 1 groceries/i }))
      await screen.findByRole('heading', { name: 'Week 1 Groceries' })
      await user.click(screen.getByRole('button', { name: /all lists/i }))
      expect(await screen.findByRole('heading', { name: 'Shopping Lists' })).toBeInTheDocument()
    })
  })

  // ── Household sharing sync ────────────────────────────────────────────────

  describe('household sharing sync', () => {
    it('subscribes to household realtime updates for an active shared list', async () => {
      const sharedList: ShoppingList = {
        ...sampleList,
        id: 'list-shared-sync',
        householdId: 'house-sync',
      }

      mockUseShoppingLists.mockReturnValue({
        data: [sharedList],
        isLoading: false,
      } as unknown as ReturnType<typeof useShoppingLists>)
      mockUseShoppingList.mockImplementation(
        (id) =>
          ({
            data: id ? sharedList : undefined,
          }) as ReturnType<typeof useShoppingList>
      )

      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Week 1 Groceries')
      await user.click(screen.getByRole('button', { name: /open week 1 groceries/i }))
      await screen.findByRole('heading', { name: 'Week 1 Groceries' })

      await waitFor(() => {
        expect(mockSubscribeToHouseholdShoppingLists).toHaveBeenCalledWith(
          'house-sync',
          expect.any(Function),
          expect.any(Function)
        )
      })
    })
  })

  // ── Progress bar ──────────────────────────────────────────────────────────

  describe('progress bar', () => {
    it('shows progress info on list cards that have items', async () => {
      mockUseShoppingLists.mockReturnValue({
        data: [sampleList],
        isLoading: false,
      } as unknown as ReturnType<typeof useShoppingLists>)
      renderPage()
      await screen.findByText('Week 1 Groceries')
      expect(screen.getByText(/1 checked/)).toBeInTheDocument()
    })

    it('shows a progress bar in the detail view', async () => {
      mockUseShoppingLists.mockReturnValue({
        data: [sampleList],
        isLoading: false,
      } as unknown as ReturnType<typeof useShoppingLists>)
      mockUseShoppingList.mockImplementation(
        (id) =>
          ({
            data: id ? sampleList : undefined,
          }) as ReturnType<typeof useShoppingList>
      )
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Week 1 Groceries')
      await user.click(screen.getByRole('button', { name: /open week 1 groceries/i }))
      await screen.findByRole('heading', { name: 'Week 1 Groceries' })
      expect(screen.getByText('1 of 3 items checked')).toBeInTheDocument()
    })
  })

  // ── Item check / uncheck ──────────────────────────────────────────────────

  describe('item check/uncheck', () => {
    beforeEach(() => {
      mockUseShoppingLists.mockReturnValue({
        data: [sampleList],
        isLoading: false,
      } as unknown as ReturnType<typeof useShoppingLists>)
      mockUseShoppingList.mockImplementation(
        (id) =>
          ({
            data: id ? sampleList : undefined,
          }) as ReturnType<typeof useShoppingList>
      )
    })

    it('calls toggleShoppingItem when an unchecked item is clicked', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Week 1 Groceries')
      await user.click(screen.getByRole('button', { name: /open week 1 groceries/i }))
      await screen.findByRole('heading', { name: 'Week 1 Groceries' })
      await user.click(screen.getByRole('button', { name: 'Check Milk' }))
      await waitFor(() => {
        expect(mockToggleMutateAsync).toHaveBeenCalledWith({
          listId: 'list-1',
          itemId: 'item-1',
        })
      })
    })

    it('calls toggleShoppingItem when a checked item is clicked', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Week 1 Groceries')
      await user.click(screen.getByRole('button', { name: /open week 1 groceries/i }))
      await screen.findByRole('heading', { name: 'Week 1 Groceries' })
      await user.click(screen.getByRole('button', { name: 'Uncheck Butter' }))
      await waitFor(() => {
        expect(mockToggleMutateAsync).toHaveBeenCalledWith({
          listId: 'list-1',
          itemId: 'item-3',
        })
      })
    })
  })

  // ── Item removal ──────────────────────────────────────────────────────────

  describe('item removal', () => {
    beforeEach(() => {
      mockUseShoppingLists.mockReturnValue({
        data: [sampleList],
        isLoading: false,
      } as unknown as ReturnType<typeof useShoppingLists>)
      mockUseShoppingList.mockImplementation(
        (id) =>
          ({
            data: id ? sampleList : undefined,
          }) as ReturnType<typeof useShoppingList>
      )
    })

    it('calls updateShoppingList with the item filtered out', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Week 1 Groceries')
      await user.click(screen.getByRole('button', { name: /open week 1 groceries/i }))
      await screen.findByRole('heading', { name: 'Week 1 Groceries' })
      await user.click(screen.getByRole('button', { name: 'Remove Milk' }))
      await waitFor(() => {
        expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
          listId: 'list-1',
          data: { items: [item2, item3] },
        })
      })
    })
  })

  // ── Empty list detail view ─────────────────────────────────────────────────

  describe('empty list detail view', () => {
    it('shows "No items in this list" when the active list has no items', async () => {
      const user = userEvent.setup()
      mockUseShoppingLists.mockReturnValue({
        data: [emptyList],
        isLoading: false,
      } as unknown as ReturnType<typeof useShoppingLists>)
      mockUseShoppingList.mockImplementation(
        (id) =>
          ({
            data: id ? emptyList : undefined,
          }) as ReturnType<typeof useShoppingList>
      )
      renderPage()
      await screen.findByText('Empty List')
      await user.click(screen.getByRole('button', { name: /open empty list/i }))
      await screen.findByText('No items in this list')
    })
  })
})
