import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ShoppingListPage from './ShoppingListPage'
import * as db from '../lib/db'
import { ToastProvider } from '../contexts/ToastContext'
import type { ShoppingList, MealPlan, Recipe } from '../types'

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/db')>()
  return {
    ...actual,
    getShoppingLists: vi.fn(),
    getShoppingList: vi.fn(),
    createShoppingList: vi.fn(),
    deleteShoppingList: vi.fn(),
    toggleShoppingItem: vi.fn(),
    updateShoppingList: vi.fn(),
    getMealPlans: vi.fn(),
    getRecipes: vi.fn(),
  }
})

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
    <ToastProvider>
      <MemoryRouter>
        <ShoppingListPage />
      </MemoryRouter>
    </ToastProvider>,
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ShoppingListPage', () => {
  const mockGetShoppingLists = vi.mocked(db.getShoppingLists)
  const mockGetShoppingList = vi.mocked(db.getShoppingList)
  const mockCreateShoppingList = vi.mocked(db.createShoppingList)
  const mockDeleteShoppingList = vi.mocked(db.deleteShoppingList)
  const mockToggleShoppingItem = vi.mocked(db.toggleShoppingItem)
  const mockUpdateShoppingList = vi.mocked(db.updateShoppingList)
  const mockGetMealPlans = vi.mocked(db.getMealPlans)
  const mockGetRecipes = vi.mocked(db.getRecipes)

  beforeEach(() => {
    mockGetShoppingLists.mockResolvedValue([])
    mockGetShoppingList.mockResolvedValue(undefined)
    mockCreateShoppingList.mockResolvedValue(sampleList)
    mockDeleteShoppingList.mockResolvedValue(undefined)
    mockToggleShoppingItem.mockResolvedValue(undefined)
    mockUpdateShoppingList.mockResolvedValue(sampleList)
    mockGetMealPlans.mockResolvedValue([])
    mockGetRecipes.mockResolvedValue([])
  })

  // ── Loading state ──────────────────────────────────────────────────────────

  describe('loading state', () => {
    it('shows a loading skeleton while data is being fetched', () => {
      mockGetShoppingLists.mockReturnValue(new Promise(() => {}))
      renderPage()
      expect(screen.getByRole('generic', { busy: true })).toBeInTheDocument()
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
      await screen.findByText(
        'Create one from your meal plan to auto-generate your grocery list.',
      )
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
      mockGetShoppingLists.mockResolvedValue([sampleList])
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
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    })

    it('renders the "+ New List" button', async () => {
      renderPage()
      expect(await screen.findByRole('button', { name: '+ New List' })).toBeInTheDocument()
    })
  })

  // ── Create form ────────────────────────────────────────────────────────────

  describe('create form', () => {
    it('opens when "+ New List" is clicked', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Shopping Lists' })
      await user.click(screen.getByRole('button', { name: '+ New List' }))
      expect(screen.getByRole('heading', { name: 'New Shopping List' })).toBeInTheDocument()
    })

    it('closes when the Close button is clicked', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Shopping Lists' })
      await user.click(screen.getByRole('button', { name: '+ New List' }))
      await user.click(screen.getByRole('button', { name: 'Close' }))
      expect(screen.queryByRole('heading', { name: 'New Shopping List' })).not.toBeInTheDocument()
    })

    it('"Create List" is disabled when the list name is empty', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Shopping Lists' })
      await user.click(screen.getByRole('button', { name: '+ New List' }))
      expect(screen.getByRole('button', { name: 'Create List' })).toBeDisabled()
    })

    it('"Create List" is enabled once a name is entered', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Shopping Lists' })
      await user.click(screen.getByRole('button', { name: '+ New List' }))
      await user.type(screen.getByPlaceholderText("e.g. This week's groceries"), 'My List')
      expect(screen.getByRole('button', { name: 'Create List' })).not.toBeDisabled()
    })

    it('calls createShoppingList with the entered name', async () => {
      const user = userEvent.setup()
      mockGetShoppingLists.mockResolvedValue([sampleList])
      mockGetShoppingList.mockResolvedValue(sampleList)
      renderPage()
      await screen.findByRole('heading', { name: 'Shopping Lists' })
      await user.click(screen.getByRole('button', { name: '+ New List' }))
      await user.type(
        screen.getByPlaceholderText("e.g. This week's groceries"),
        'Week 1 Groceries',
      )
      await user.click(screen.getByRole('button', { name: 'Create List' }))
      await waitFor(() => {
        expect(mockCreateShoppingList).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Week 1 Groceries' }),
        )
      })
    })
  })

  // ── Ingredient aggregation ─────────────────────────────────────────────────

  describe('ingredient aggregation from meal plan', () => {
    // Mirror the component's date calculation so our meal plan date falls in the default range.
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

      mockGetRecipes.mockResolvedValue([recipe])
      mockGetMealPlans.mockResolvedValue([mealPlan])
      mockGetShoppingLists.mockResolvedValue([sampleList])
      mockGetShoppingList.mockResolvedValue(sampleList)

      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Shopping Lists' })
      await user.click(screen.getByRole('button', { name: '+ New List' }))
      await user.type(screen.getByPlaceholderText("e.g. This week's groceries"), 'Test List')
      await user.click(screen.getByRole('button', { name: 'Create List' }))

      await waitFor(() => {
        expect(mockCreateShoppingList).toHaveBeenCalledWith(
          expect.objectContaining({
            items: expect.arrayContaining([
              expect.objectContaining({ name: 'pasta', amount: 400, unit: 'g' }),
            ]),
          }),
        )
      })
    })

    it('aggregates the same ingredient from multiple recipe entries', async () => {
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
          // Same recipe planned on two different days → pasta should be doubled
          [mondayStr]: { dinner: { recipes: [{ recipeId: 'r1', servings: 4 }] } },
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }

      mockGetRecipes.mockResolvedValue([recipe])
      mockGetMealPlans.mockResolvedValue([mealPlan])
      mockGetShoppingLists.mockResolvedValue([sampleList])
      mockGetShoppingList.mockResolvedValue(sampleList)

      const user = userEvent.setup()
      renderPage()
      await screen.findByRole('heading', { name: 'Shopping Lists' })
      await user.click(screen.getByRole('button', { name: '+ New List' }))
      await user.type(screen.getByPlaceholderText("e.g. This week's groceries"), 'Test List')
      await user.click(screen.getByRole('button', { name: 'Create List' }))

      await waitFor(() => {
        expect(mockCreateShoppingList).toHaveBeenCalledWith(
          expect.objectContaining({
            items: expect.arrayContaining([
              expect.objectContaining({ name: 'pasta', unit: 'g' }),
            ]),
          }),
        )
      })
    })
  })

  // ── List deletion ──────────────────────────────────────────────────────────

  describe('list deletion', () => {
    it('calls deleteShoppingList with the correct id', async () => {
      const user = userEvent.setup()
      mockGetShoppingLists.mockResolvedValue([sampleList])
      renderPage()
      await screen.findByText('Week 1 Groceries')
      await user.click(screen.getByRole('button', { name: 'Delete' }))
      await waitFor(() => {
        expect(mockDeleteShoppingList).toHaveBeenCalledWith('list-1')
      })
    })

    it('removes the list from the UI after deletion', async () => {
      const user = userEvent.setup()
      mockGetShoppingLists.mockResolvedValueOnce([sampleList]).mockResolvedValue([])
      renderPage()
      await screen.findByText('Week 1 Groceries')
      await user.click(screen.getByRole('button', { name: 'Delete' }))
      await waitFor(() => {
        expect(screen.queryByText('Week 1 Groceries')).not.toBeInTheDocument()
      })
    })
  })

  // ── Detail view ────────────────────────────────────────────────────────────

  describe('detail view', () => {
    beforeEach(() => {
      mockGetShoppingLists.mockResolvedValue([sampleList])
      mockGetShoppingList.mockResolvedValue(sampleList)
    })

    it('opens when a list card is clicked', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Week 1 Groceries')
      await user.click(screen.getByRole('button', { name: /Week 1 Groceries/ }))
      expect(await screen.findByRole('heading', { name: 'Week 1 Groceries' })).toBeInTheDocument()
    })

    it('shows checked / total item count', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Week 1 Groceries')
      await user.click(screen.getByRole('button', { name: /Week 1 Groceries/ }))
      await screen.findByRole('heading', { name: 'Week 1 Groceries' })
      expect(screen.getByText('1 of 3 items checked')).toBeInTheDocument()
    })

    it('renders unchecked items', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Week 1 Groceries')
      await user.click(screen.getByRole('button', { name: /Week 1 Groceries/ }))
      await screen.findByRole('heading', { name: 'Week 1 Groceries' })
      expect(screen.getByText('Milk')).toBeInTheDocument()
      expect(screen.getByText('Eggs')).toBeInTheDocument()
    })

    it('renders checked items in a "Checked off" section', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Week 1 Groceries')
      await user.click(screen.getByRole('button', { name: /Week 1 Groceries/ }))
      await screen.findByRole('heading', { name: 'Week 1 Groceries' })
      expect(screen.getByText('Checked off')).toBeInTheDocument()
      expect(screen.getByText('Butter')).toBeInTheDocument()
    })

    it('back button returns to the list view', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Week 1 Groceries')
      await user.click(screen.getByRole('button', { name: /Week 1 Groceries/ }))
      await screen.findByRole('heading', { name: 'Week 1 Groceries' })
      await user.click(screen.getByRole('button', { name: /All lists/ }))
      expect(await screen.findByRole('heading', { name: 'Shopping Lists' })).toBeInTheDocument()
    })
  })

  // ── Progress bar ──────────────────────────────────────────────────────────

  describe('progress bar', () => {
    it('shows a progress bar on list cards that have items', async () => {
      mockGetShoppingLists.mockResolvedValue([sampleList])
      renderPage()
      await screen.findByText('Week 1 Groceries')
      // Progress is reflected in the summary text
      expect(screen.getByText(/1 checked/)).toBeInTheDocument()
    })

    it('shows a progress bar in the detail view', async () => {
      const user = userEvent.setup()
      mockGetShoppingLists.mockResolvedValue([sampleList])
      mockGetShoppingList.mockResolvedValue(sampleList)
      renderPage()
      await screen.findByText('Week 1 Groceries')
      await user.click(screen.getByRole('button', { name: /Week 1 Groceries/ }))
      await screen.findByRole('heading', { name: 'Week 1 Groceries' })
      expect(screen.getByText('1 of 3 items checked')).toBeInTheDocument()
    })
  })

  // ── Item check / uncheck ──────────────────────────────────────────────────

  describe('item check/uncheck', () => {
    const updatedList: ShoppingList = {
      ...sampleList,
      items: [{ ...item1, checked: true }, item2, item3],
    }

    beforeEach(() => {
      mockGetShoppingLists.mockResolvedValue([sampleList])
      mockGetShoppingList
        .mockResolvedValueOnce(sampleList) // initial load when activeListId is set
        .mockResolvedValue(updatedList) // reload after toggle
    })

    it('calls toggleShoppingItem when an unchecked item is clicked', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Week 1 Groceries')
      await user.click(screen.getByRole('button', { name: /Week 1 Groceries/ }))
      await screen.findByRole('heading', { name: 'Week 1 Groceries' })
      await user.click(screen.getByRole('button', { name: 'Check Milk' }))
      await waitFor(() => {
        expect(mockToggleShoppingItem).toHaveBeenCalledWith('list-1', 'item-1')
      })
    })

    it('calls toggleShoppingItem when a checked item is clicked', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Week 1 Groceries')
      await user.click(screen.getByRole('button', { name: /Week 1 Groceries/ }))
      await screen.findByRole('heading', { name: 'Week 1 Groceries' })
      await user.click(screen.getByRole('button', { name: 'Uncheck Butter' }))
      await waitFor(() => {
        expect(mockToggleShoppingItem).toHaveBeenCalledWith('list-1', 'item-3')
      })
    })
  })

  // ── Item removal ──────────────────────────────────────────────────────────

  describe('item removal', () => {
    const listAfterRemoval: ShoppingList = {
      ...sampleList,
      items: [item2, item3],
    }

    beforeEach(() => {
      mockGetShoppingLists.mockResolvedValue([sampleList])
      mockGetShoppingList
        .mockResolvedValueOnce(sampleList) // initial load when activeListId is set
        .mockResolvedValue(listAfterRemoval) // reload after removal
    })

    it('calls updateShoppingList with the item filtered out', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Week 1 Groceries')
      await user.click(screen.getByRole('button', { name: /Week 1 Groceries/ }))
      await screen.findByRole('heading', { name: 'Week 1 Groceries' })
      await user.click(screen.getByRole('button', { name: 'Remove Milk' }))
      await waitFor(() => {
        expect(mockUpdateShoppingList).toHaveBeenCalledWith('list-1', {
          items: [item2, item3],
        })
      })
    })

    it('removes the item from the detail view after removal', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Week 1 Groceries')
      await user.click(screen.getByRole('button', { name: /Week 1 Groceries/ }))
      await screen.findByRole('heading', { name: 'Week 1 Groceries' })
      await user.click(screen.getByRole('button', { name: 'Remove Milk' }))
      await waitFor(() => {
        expect(screen.queryByText('Milk')).not.toBeInTheDocument()
      })
    })
  })

  // ── Empty list detail view ─────────────────────────────────────────────────

  describe('empty list detail view', () => {
    it('shows "No items in this list" when the active list has no items', async () => {
      const user = userEvent.setup()
      mockGetShoppingLists.mockResolvedValue([emptyList])
      mockGetShoppingList.mockResolvedValue(emptyList)
      renderPage()
      await screen.findByText('Empty List')
      await user.click(screen.getByRole('button', { name: /Empty List/ }))
      await screen.findByText('No items in this list')
    })
  })
})
