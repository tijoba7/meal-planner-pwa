import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import RecipeFormPage from './RecipeFormPage'
import { db, createRecipe } from '../lib/db'
import { ToastProvider } from '../contexts/ToastContext'
import { AuthProvider } from '../contexts/AuthContext'

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Hoist mockNavigate so it's available inside the vi.mock factory (hoisting safety).
const mockNavigate = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await db.delete()
  await db.open()
  mockNavigate.mockReset()
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderAdd() {
  render(
    <AuthProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={['/recipes/new']}>
          <Routes>
            <Route path="/recipes/new" element={<RecipeFormPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </AuthProvider>
  )
}

function renderEdit(id: string) {
  render(
    <AuthProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[`/recipes/${id}/edit`]}>
          <Routes>
            <Route path="/recipes/:id/edit" element={<RecipeFormPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </AuthProvider>
  )
}

const baseRecipe = {
  description: '',
  recipeYield: '1',
  prepTime: 'PT0M',
  cookTime: 'PT0M',
  recipeIngredient: [{ name: 'flour', amount: 1, unit: 'cup' }],
  recipeInstructions: [{ '@type': 'HowToStep' as const, text: 'Mix.' }],
  keywords: [] as string[],
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RecipeFormPage', () => {
  describe('add mode', () => {
    it('renders "New Recipe" heading and empty form', () => {
      renderAdd()
      expect(screen.getByRole('heading', { name: /new recipe/i })).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/spaghetti bolognese/i)).toHaveValue('')
      expect(screen.getByRole('button', { name: /add recipe/i })).toBeInTheDocument()
    })

    it('starts with one empty ingredient row and one instruction step', () => {
      renderAdd()
      expect(screen.getAllByPlaceholderText(/ingredient name/i)).toHaveLength(1)
      expect(screen.getByPlaceholderText(/step 1/i)).toBeInTheDocument()
    })

    it('back link points to the recipes list', () => {
      renderAdd()
      expect(screen.getByRole('link', { name: /recipes/i })).toHaveAttribute('href', '/')
    })
  })

  describe('edit mode', () => {
    it('pre-fills the form from the stored recipe', async () => {
      const recipe = await createRecipe({
        name: 'Test Pasta',
        description: 'A classic dish',
        recipeYield: '4',
        prepTime: 'PT10M',
        cookTime: 'PT20M',
        recipeIngredient: [{ name: 'pasta', amount: 200, unit: 'g' }],
        recipeInstructions: [{ '@type': 'HowToStep', text: 'Boil water.' }],
        keywords: ['italian'],
      })

      renderEdit(recipe.id)

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/spaghetti bolognese/i)).toHaveValue('Test Pasta')
      })
      expect(screen.getByRole('heading', { name: /edit recipe/i })).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/ingredient name/i)).toHaveValue('pasta')
      expect(screen.getByPlaceholderText(/step 1/i)).toHaveValue('Boil water.')
    })

    it('shows "Recipe not found" for an unknown id', async () => {
      renderEdit('nonexistent-id')
      await waitFor(() => {
        expect(screen.getByText(/recipe not found/i)).toBeInTheDocument()
      })
    })

    it('back link points to the recipe detail page', async () => {
      const recipe = await createRecipe({ name: 'Test', ...baseRecipe })

      renderEdit(recipe.id)

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/spaghetti bolognese/i)).toHaveValue('Test')
      })
      expect(screen.getByRole('link', { name: /back to recipe/i })).toHaveAttribute(
        'href',
        `/recipes/${recipe.id}`
      )
    })
  })

  describe('form validation', () => {
    it('shows an error when name is empty on submit', async () => {
      const user = userEvent.setup()
      renderAdd()

      await user.click(screen.getByRole('button', { name: /add recipe/i }))

      expect(screen.getByText(/name is required/i)).toBeInTheDocument()
    })

    it('shows an error when no ingredient name is filled on submit', async () => {
      const user = userEvent.setup()
      renderAdd()

      await user.type(screen.getByPlaceholderText(/spaghetti bolognese/i), 'My Recipe')
      await user.click(screen.getByRole('button', { name: /add recipe/i }))

      expect(screen.getByText(/add at least one ingredient/i)).toBeInTheDocument()
    })

    it('shows an error when no instruction step is filled on submit', async () => {
      const user = userEvent.setup()
      renderAdd()

      await user.type(screen.getByPlaceholderText(/spaghetti bolognese/i), 'My Recipe')
      await user.type(screen.getAllByPlaceholderText(/ingredient name/i)[0], 'flour')
      await user.click(screen.getByRole('button', { name: /add recipe/i }))

      expect(screen.getByText(/add at least one instruction step/i)).toBeInTheDocument()
    })
  })

  describe('ingredient list management', () => {
    it('adds a new row when clicking "+ Add ingredient"', async () => {
      const user = userEvent.setup()
      renderAdd()

      await user.click(screen.getByRole('button', { name: /add ingredient/i }))

      expect(screen.getAllByPlaceholderText(/ingredient name/i)).toHaveLength(2)
    })

    it('removes a row when clicking the remove button', async () => {
      const user = userEvent.setup()
      renderAdd()

      await user.click(screen.getByRole('button', { name: /add ingredient/i }))
      expect(screen.getAllByPlaceholderText(/ingredient name/i)).toHaveLength(2)

      await user.click(screen.getAllByRole('button', { name: /remove ingredient/i })[0])

      expect(screen.getAllByPlaceholderText(/ingredient name/i)).toHaveLength(1)
    })

    it('hides the remove button when only one ingredient row exists', () => {
      renderAdd()
      expect(screen.queryByRole('button', { name: /remove ingredient/i })).not.toBeInTheDocument()
    })
  })

  describe('instruction list management', () => {
    it('adds a new step when clicking "+ Add step"', async () => {
      const user = userEvent.setup()
      renderAdd()

      await user.click(screen.getByRole('button', { name: /add step/i }))

      expect(screen.getByPlaceholderText(/step 1/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/step 2/i)).toBeInTheDocument()
    })

    it('removes a step when clicking the remove button', async () => {
      const user = userEvent.setup()
      renderAdd()

      await user.click(screen.getByRole('button', { name: /add step/i }))
      expect(screen.getAllByRole('button', { name: /remove step/i })).toHaveLength(2)

      await user.click(screen.getAllByRole('button', { name: /remove step/i })[0])

      expect(screen.queryByPlaceholderText(/step 2/i)).not.toBeInTheDocument()
    })

    it('hides the remove button when only one instruction step exists', () => {
      renderAdd()
      expect(screen.queryByRole('button', { name: /remove step/i })).not.toBeInTheDocument()
    })
  })

  describe('form submission', () => {
    it('creates a recipe and navigates to the detail page (add mode)', async () => {
      const user = userEvent.setup()
      renderAdd()

      await user.type(screen.getByPlaceholderText(/spaghetti bolognese/i), 'Carbonara')
      await user.type(screen.getAllByPlaceholderText(/ingredient name/i)[0], 'eggs')
      await user.type(screen.getByPlaceholderText(/step 1/i), 'Cook the eggs.')

      await user.click(screen.getByRole('button', { name: /add recipe/i }))

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledOnce()
        expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/^\/recipes\/.+/))
      })
    })

    it('updates the recipe and navigates to the detail page (edit mode)', async () => {
      const recipe = await createRecipe({ name: 'Original', ...baseRecipe })

      const user = userEvent.setup()
      renderEdit(recipe.id)

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/spaghetti bolognese/i)).toHaveValue('Original')
      })

      const nameInput = screen.getByPlaceholderText(/spaghetti bolognese/i)
      await user.clear(nameInput)
      await user.type(nameInput, 'Updated')

      await user.click(screen.getByRole('button', { name: /save changes/i }))

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(`/recipes/${recipe.id}`)
      })
    })
  })
})
