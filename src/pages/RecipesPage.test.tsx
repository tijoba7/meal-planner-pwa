import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'
import { createTestQueryClient } from '../test/supabaseMocks'
import RecipesPage from './RecipesPage'
import { ToastProvider } from '../contexts/ToastContext'
import type { Recipe } from '../types'

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../hooks/useRecipes', () => ({
  useRecipes: vi.fn(),
  useToggleFavorite: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user', email: 'test@test.com' }, signOut: vi.fn() }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('../hooks/useKeyboardShortcuts', () => ({ useKeyboardShortcuts: vi.fn() }))

import { useRecipes } from '../hooks/useRecipes'
const mockUseRecipes = vi.mocked(useRecipes)

// ─── Sample data ──────────────────────────────────────────────────────────────

const sampleRecipes: Recipe[] = [
  {
    id: 'r1',
    name: 'Spaghetti Bolognese',
    description: 'A classic Italian pasta dish',
    recipeYield: '4',
    prepTime: 'PT15M',
    cookTime: 'PT45M',
    recipeIngredient: [],
    recipeInstructions: [],
    keywords: ['italian', 'pasta'],
    dateCreated: '2026-01-01T00:00:00Z',
    dateModified: '2026-01-01T00:00:00Z',
  },
  {
    id: 'r2',
    name: 'Chicken Caesar Salad',
    description: 'A crispy salad with grilled chicken',
    recipeYield: '2',
    prepTime: 'PT20M',
    cookTime: 'PT10M',
    recipeIngredient: [],
    recipeInstructions: [],
    keywords: ['salad', 'chicken'],
    dateCreated: '2026-01-02T00:00:00Z',
    dateModified: '2026-01-02T00:00:00Z',
  },
]

function makeQueryResult(data: Recipe[]) {
  return {
    data,
    isLoading: false,
    isPending: false,
    isSuccess: true,
    isError: false,
    error: null,
    status: 'success' as const,
    fetchStatus: 'idle' as const,
  }
}

function renderPage() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ToastProvider>
        <MemoryRouter>
          <RecipesPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}

describe('RecipesPage', () => {
  beforeEach(() => {
    mockUseRecipes.mockReturnValue(makeQueryResult([]) as ReturnType<typeof useRecipes>)
  })

  describe('page structure', () => {
    it('renders the Recipes heading', () => {
      renderPage()
      expect(screen.getByRole('heading', { name: 'Recipes' })).toBeInTheDocument()
    })

    it('renders the search input', () => {
      renderPage()
      expect(screen.getByPlaceholderText('Search recipes...')).toBeInTheDocument()
    })

    it('renders Add Recipe navigation link', () => {
      renderPage()
      expect(screen.getByRole('link', { name: '+ Add Recipe' })).toHaveAttribute(
        'href',
        '/recipes/new'
      )
    })

    it('renders Import URL navigation link', () => {
      renderPage()
      expect(screen.getByRole('link', { name: 'Import URL' })).toHaveAttribute(
        'href',
        '/recipes/import'
      )
    })
  })

  describe('empty state — no recipes', () => {
    it('shows "No recipes yet" title', async () => {
      renderPage()
      await screen.findByText('No recipes yet')
    })

    it('shows helpful description', async () => {
      renderPage()
      await screen.findByText('Add your first recipe to get started planning meals.')
    })

    it('shows a link to add the first recipe', async () => {
      renderPage()
      const link = await screen.findByRole('link', { name: 'Add your first recipe' })
      expect(link).toHaveAttribute('href', '/recipes/new')
    })
  })

  describe('recipe list rendering', () => {
    beforeEach(() => {
      mockUseRecipes.mockReturnValue(makeQueryResult(sampleRecipes) as ReturnType<typeof useRecipes>)
    })

    it('renders all recipe names', async () => {
      renderPage()
      await screen.findByText('Spaghetti Bolognese')
      expect(screen.getByText('Chicken Caesar Salad')).toBeInTheDocument()
    })

    it('renders recipe descriptions', async () => {
      renderPage()
      await screen.findByText('A classic Italian pasta dish')
      expect(screen.getByText('A crispy salad with grilled chicken')).toBeInTheDocument()
    })

    it('renders total time (prep + cook)', async () => {
      mockUseRecipes.mockReturnValue(makeQueryResult([sampleRecipes[0]]) as ReturnType<typeof useRecipes>)
      renderPage()
      await screen.findByText('60 min') // 15 + 45
    })

    it('renders individual prep and cook times', async () => {
      mockUseRecipes.mockReturnValue(makeQueryResult([sampleRecipes[0]]) as ReturnType<typeof useRecipes>)
      renderPage()
      await screen.findByText('prep 15m')
      expect(screen.getByText('cook 45m')).toBeInTheDocument()
    })

    it('renders serving count', async () => {
      mockUseRecipes.mockReturnValue(makeQueryResult([sampleRecipes[0]]) as ReturnType<typeof useRecipes>)
      renderPage()
      await screen.findByText('4 servings')
    })

    it('renders keyword tags', async () => {
      mockUseRecipes.mockReturnValue(makeQueryResult([sampleRecipes[0]]) as ReturnType<typeof useRecipes>)
      renderPage()
      await screen.findByText('italian')
      expect(screen.getByText('pasta')).toBeInTheDocument()
    })

    it('links each recipe card to its detail page', async () => {
      mockUseRecipes.mockReturnValue(makeQueryResult([sampleRecipes[0]]) as ReturnType<typeof useRecipes>)
      renderPage()
      const link = await screen.findByRole('link', { name: /Spaghetti Bolognese/ })
      expect(link).toHaveAttribute('href', '/recipes/r1')
    })

    it('does not show empty state when recipes are present', async () => {
      renderPage()
      await screen.findByText('Spaghetti Bolognese')
      expect(screen.queryByText('No recipes yet')).not.toBeInTheDocument()
    })
  })

  describe('search filtering', () => {
    beforeEach(() => {
      mockUseRecipes.mockReturnValue(makeQueryResult(sampleRecipes) as ReturnType<typeof useRecipes>)
    })

    it('filters recipes by name', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Spaghetti Bolognese')

      await user.type(screen.getByPlaceholderText('Search recipes...'), 'chicken')

      expect(screen.queryByText('Spaghetti Bolognese')).not.toBeInTheDocument()
      expect(screen.getByText('Chicken Caesar Salad')).toBeInTheDocument()
    })

    it('filters recipes by description', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Spaghetti Bolognese')

      await user.type(screen.getByPlaceholderText('Search recipes...'), 'Italian pasta')

      expect(screen.getByText('Spaghetti Bolognese')).toBeInTheDocument()
      expect(screen.queryByText('Chicken Caesar Salad')).not.toBeInTheDocument()
    })

    it('filters recipes by keyword', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Spaghetti Bolognese')

      await user.type(screen.getByPlaceholderText('Search recipes...'), 'salad')

      expect(screen.queryByText('Spaghetti Bolognese')).not.toBeInTheDocument()
      expect(screen.getByText('Chicken Caesar Salad')).toBeInTheDocument()
    })

    it('search is case-insensitive', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Spaghetti Bolognese')

      await user.type(screen.getByPlaceholderText('Search recipes...'), 'SPAGHETTI')

      expect(screen.getByText('Spaghetti Bolognese')).toBeInTheDocument()
    })

    it('shows "No recipes found" empty state when no results match', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Spaghetti Bolognese')

      await user.type(screen.getByPlaceholderText('Search recipes...'), 'xyznonexistent')

      await screen.findByText('No recipes found')
      expect(screen.getByText(/No recipes match your current filters/)).toBeInTheDocument()
    })

    it('clearing the input restores the full list', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Spaghetti Bolognese')

      const input = screen.getByPlaceholderText('Search recipes...')
      await user.type(input, 'chicken')
      expect(screen.queryByText('Spaghetti Bolognese')).not.toBeInTheDocument()

      await user.clear(input)

      expect(screen.getByText('Spaghetti Bolognese')).toBeInTheDocument()
      expect(screen.getByText('Chicken Caesar Salad')).toBeInTheDocument()
    })

    it('"Clear search" button resets the query and shows all recipes', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Spaghetti Bolognese')

      await user.type(screen.getByPlaceholderText('Search recipes...'), 'xyznonexistent')
      await screen.findByText('No recipes found')

      await user.click(screen.getByRole('button', { name: 'Clear all filters' }))

      expect(screen.getByText('Spaghetti Bolognese')).toBeInTheDocument()
      expect(screen.getByText('Chicken Caesar Salad')).toBeInTheDocument()
    })
  })
})
