import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import RecipeDetailPage from './RecipeDetailPage'
import * as db from '../lib/db'
import { ToastProvider } from '../contexts/ToastContext'
import type { Recipe } from '../types'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}))

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/db')>()
  return {
    ...actual,
    getRecipe: vi.fn(),
    deleteRecipe: vi.fn().mockResolvedValue(undefined),
  }
})

// Stub CookingMode so tests stay focused on RecipeDetailPage behaviour.
vi.mock('../components/CookingMode', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="cooking-mode">
      <button onClick={onClose}>Close Cooking Mode</button>
    </div>
  ),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const sampleRecipe: Recipe = {
  id: 'recipe-123',
  name: 'Test Pasta',
  description: 'A delicious pasta dish.',
  recipeYield: '4',
  prepTime: 'PT10M',
  cookTime: 'PT25M',
  recipeIngredient: [
    { name: 'spaghetti', amount: 200, unit: 'g' },
    { name: 'tomato sauce', amount: 1, unit: 'cup' },
  ],
  recipeInstructions: [
    { '@type': 'HowToStep', text: 'Boil water and cook spaghetti.' },
    { '@type': 'HowToStep', text: 'Add sauce and serve.' },
  ],
  keywords: ['pasta', 'italian'],
  dateCreated: '2026-01-01T00:00:00.000Z',
  dateModified: '2026-01-01T00:00:00.000Z',
}

// ─── Render helper ────────────────────────────────────────────────────────────

function renderPage(id = 'recipe-123') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[`/recipes/${id}`]}>
        <Routes>
          <Route path="/recipes/:id" element={<RecipeDetailPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RecipeDetailPage', () => {
  const mockGetRecipe = vi.mocked(db.getRecipe)
  const mockDeleteRecipe = vi.mocked(db.deleteRecipe)

  beforeEach(() => {
    mockGetRecipe.mockResolvedValue(sampleRecipe)
    mockDeleteRecipe.mockResolvedValue(undefined)
    mockNavigate.mockClear()
  })

  // ── Loading state ──────────────────────────────────────────────────────────

  describe('loading state', () => {
    it('shows a loading skeleton while the recipe is being fetched', () => {
      mockGetRecipe.mockReturnValue(new Promise(() => {}))
      renderPage()
      expect(screen.getByRole('generic', { busy: true })).toBeInTheDocument()
    })
  })

  // ── Not-found state ────────────────────────────────────────────────────────

  describe('not found state', () => {
    it('shows "Recipe not found." when the recipe does not exist', async () => {
      mockGetRecipe.mockResolvedValue(undefined)
      renderPage('no-such-id')
      await waitFor(() => {
        expect(screen.getByText('Recipe not found.')).toBeInTheDocument()
      })
    })

    it('renders a back link to the home page', async () => {
      mockGetRecipe.mockResolvedValue(undefined)
      renderPage('no-such-id')
      await waitFor(() => {
        const link = screen.getByRole('link', { name: /back to recipes/i })
        expect(link).toHaveAttribute('href', '/')
      })
    })
  })

  // ── Recipe data display ────────────────────────────────────────────────────

  describe('recipe data display', () => {
    it('renders the recipe name as a heading', async () => {
      renderPage()
      expect(await screen.findByRole('heading', { name: 'Test Pasta' })).toBeInTheDocument()
    })

    it('renders the recipe description', async () => {
      renderPage()
      expect(await screen.findByText('A delicious pasta dish.')).toBeInTheDocument()
    })

    it('renders all ingredients', async () => {
      renderPage()
      await screen.findByRole('heading', { name: 'Test Pasta' })
      expect(screen.getByText('spaghetti')).toBeInTheDocument()
      expect(screen.getByText('tomato sauce')).toBeInTheDocument()
    })

    it('renders all instruction steps', async () => {
      renderPage()
      await screen.findByRole('heading', { name: 'Test Pasta' })
      expect(screen.getByText('Boil water and cook spaghetti.')).toBeInTheDocument()
      expect(screen.getByText('Add sauce and serve.')).toBeInTheDocument()
    })

    it('displays prep time, cook time, and total time', async () => {
      renderPage()
      await screen.findByRole('heading', { name: 'Test Pasta' })
      expect(screen.getByText('Prep 10 min')).toBeInTheDocument()
      expect(screen.getByText('Cook 25 min')).toBeInTheDocument()
      expect(screen.getByText('Total 35 min')).toBeInTheDocument()
    })

    it('displays keyword tags', async () => {
      renderPage()
      await screen.findByRole('heading', { name: 'Test Pasta' })
      expect(screen.getByText('pasta')).toBeInTheDocument()
      expect(screen.getByText('italian')).toBeInTheDocument()
    })

    it('renders a link to the recipe edit page', async () => {
      renderPage()
      const editLink = await screen.findByRole('link', { name: /edit/i })
      expect(editLink).toHaveAttribute('href', '/recipes/recipe-123/edit')
    })

    it('renders a delete button', async () => {
      renderPage()
      expect(await screen.findByRole('button', { name: 'Delete' })).toBeInTheDocument()
    })

    it('does not render a nutrition section when nutrition data is absent', async () => {
      renderPage()
      await screen.findByRole('heading', { name: 'Test Pasta' })
      expect(screen.queryByRole('heading', { name: 'Nutrition' })).not.toBeInTheDocument()
    })

    it('renders a nutrition section when nutrition data is present', async () => {
      mockGetRecipe.mockResolvedValue({
        ...sampleRecipe,
        nutrition: { calories: 350, proteinContent: 12 },
      })
      renderPage()
      expect(await screen.findByRole('heading', { name: 'Nutrition' })).toBeInTheDocument()
    })
  })

  // ── Cook button ────────────────────────────────────────────────────────────

  describe('Cook button', () => {
    it('shows the Cook button when the recipe has instructions', async () => {
      renderPage()
      expect(await screen.findByRole('button', { name: /cook/i })).toBeInTheDocument()
    })

    it('hides the Cook button when the recipe has no instructions', async () => {
      mockGetRecipe.mockResolvedValue({ ...sampleRecipe, recipeInstructions: [] })
      renderPage()
      await screen.findByRole('heading', { name: 'Test Pasta' })
      expect(screen.queryByRole('button', { name: /cook/i })).not.toBeInTheDocument()
    })

    it('opens CookingMode when the Cook button is clicked', async () => {
      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByRole('button', { name: /cook/i }))
      expect(screen.getByTestId('cooking-mode')).toBeInTheDocument()
    })

    it('closes CookingMode when onClose is called', async () => {
      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByRole('button', { name: /cook/i }))
      await user.click(screen.getByRole('button', { name: 'Close Cooking Mode' }))
      expect(screen.queryByTestId('cooking-mode')).not.toBeInTheDocument()
    })
  })

  // ── Serving scaler ─────────────────────────────────────────────────────────

  // The serving count text is split across DOM elements ("<span>4</span> servings"),
  // so we use a custom textContent matcher rather than getByText string matching.
  function findServings(n: number) {
    return screen.getByText(
      (_, el) => el?.textContent?.replace(/\s+/g, ' ').trim() === `${n} servings`,
    )
  }

  describe('serving scaler', () => {
    it('shows the initial serving count from recipeYield', async () => {
      renderPage()
      await screen.findByRole('heading', { name: 'Test Pasta' })
      expect(findServings(4)).toBeInTheDocument()
    })

    it('increments servings when the increase button is clicked', async () => {
      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByRole('button', { name: 'Increase servings' }))
      expect(findServings(5)).toBeInTheDocument()
    })

    it('decrements servings when the decrease button is clicked', async () => {
      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByRole('button', { name: 'Decrease servings' }))
      expect(findServings(3)).toBeInTheDocument()
    })

    it('disables the decrease button when servings is already 1', async () => {
      mockGetRecipe.mockResolvedValue({ ...sampleRecipe, recipeYield: '1' })
      renderPage()
      expect(
        await screen.findByRole('button', { name: 'Decrease servings' }),
      ).toBeDisabled()
    })

    it('shows a reset button when servings are scaled, and resets on click', async () => {
      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByRole('button', { name: 'Increase servings' }))
      const resetButton = screen.getByRole('button', { name: /reset to 4/i })
      expect(resetButton).toBeInTheDocument()
      await user.click(resetButton)
      expect(screen.queryByRole('button', { name: /reset to 4/i })).not.toBeInTheDocument()
    })
  })

  // ── Delete flow ───────────────────────────────────────────────────────────

  describe('delete flow', () => {
    it('shows a confirmation dialog when the Delete button is clicked', async () => {
      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByRole('button', { name: 'Delete' }))
      expect(screen.getByText('Delete recipe?')).toBeInTheDocument()
      expect(screen.getByText(/"Test Pasta" will be permanently deleted/)).toBeInTheDocument()
    })

    it('dismisses the dialog without deleting when Cancel is clicked', async () => {
      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByRole('button', { name: 'Delete' }))
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByText('Delete recipe?')).not.toBeInTheDocument()
      expect(mockDeleteRecipe).not.toHaveBeenCalled()
    })

    it('calls deleteRecipe and navigates to "/" when deletion is confirmed', async () => {
      const user = userEvent.setup()
      renderPage()

      // Open dialog — only one "Delete" button visible at this point
      await user.click(await screen.findByRole('button', { name: 'Delete' }))
      expect(screen.getByText('Delete recipe?')).toBeInTheDocument()

      // Two "Delete" buttons are now in the DOM: header + dialog confirm button
      const [, confirmButton] = screen.getAllByRole('button', { name: 'Delete' })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(mockDeleteRecipe).toHaveBeenCalledWith('recipe-123')
        expect(mockNavigate).toHaveBeenCalledWith('/')
      })
    })
  })
})
