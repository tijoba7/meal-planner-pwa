import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import RecipesPage from './RecipesPage'
import { getRecipes } from '../lib/db'

vi.mock('../lib/db', async (importActual) => {
  const actual = await importActual<typeof import('../lib/db')>()
  return { ...actual, getRecipes: vi.fn() }
})

const mockGetRecipes = vi.mocked(getRecipes)

const sampleRecipes = [
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

function renderPage() {
  return render(
    <MemoryRouter>
      <RecipesPage />
    </MemoryRouter>,
  )
}

describe('RecipesPage', () => {
  beforeEach(() => {
    mockGetRecipes.mockResolvedValue([])
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
      expect(screen.getByRole('link', { name: '+ Add Recipe' })).toHaveAttribute('href', '/recipes/new')
    })

    it('renders Import URL navigation link', () => {
      renderPage()
      expect(screen.getByRole('link', { name: 'Import URL' })).toHaveAttribute('href', '/recipes/import')
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
      mockGetRecipes.mockResolvedValue(sampleRecipes)
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
      mockGetRecipes.mockResolvedValue([sampleRecipes[0]])
      renderPage()
      await screen.findByText('60 min') // 15 + 45
    })

    it('renders individual prep and cook times', async () => {
      mockGetRecipes.mockResolvedValue([sampleRecipes[0]])
      renderPage()
      await screen.findByText('prep 15m')
      expect(screen.getByText('cook 45m')).toBeInTheDocument()
    })

    it('renders serving count', async () => {
      mockGetRecipes.mockResolvedValue([sampleRecipes[0]])
      renderPage()
      await screen.findByText('4 servings')
    })

    it('renders keyword tags', async () => {
      mockGetRecipes.mockResolvedValue([sampleRecipes[0]])
      renderPage()
      await screen.findByText('italian')
      expect(screen.getByText('pasta')).toBeInTheDocument()
    })

    it('links each recipe card to its detail page', async () => {
      mockGetRecipes.mockResolvedValue([sampleRecipes[0]])
      renderPage()
      await waitFor(() => {
        const link = screen.getByRole('link', { name: /Spaghetti Bolognese/ })
        expect(link).toHaveAttribute('href', '/recipes/r1')
      })
    })

    it('does not show empty state when recipes are present', async () => {
      renderPage()
      await screen.findByText('Spaghetti Bolognese')
      expect(screen.queryByText('No recipes yet')).not.toBeInTheDocument()
    })
  })

  describe('search filtering', () => {
    beforeEach(() => {
      mockGetRecipes.mockResolvedValue(sampleRecipes)
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
