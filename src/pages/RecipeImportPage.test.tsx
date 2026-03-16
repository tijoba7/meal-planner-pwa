import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import RecipeImportPage from './RecipeImportPage'
import { ToastProvider } from '../contexts/ToastContext'
import * as scraper from '../lib/scraper'
import * as db from '../lib/db'
import type { ExtractedRecipe } from '../lib/scraper'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}))

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../lib/scraper', () => ({
  extractRecipeFromUrl: vi.fn(),
  getStoredApiKey: vi.fn(),
}))

vi.mock('../lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/db')>()
  return { ...actual, createRecipe: vi.fn() }
})

// Stub RecipeImage to avoid image loading side-effects.
vi.mock('../components/RecipeImage', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} data-testid="recipe-image" />,
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const sampleExtractedRecipe: ExtractedRecipe = {
  name: 'Pasta Carbonara',
  description: 'A classic Roman pasta dish.',
  recipeYield: '2',
  prepTime: 'PT10M',
  cookTime: 'PT20M',
  recipeIngredient: [
    { name: 'spaghetti', amount: 200, unit: 'g' },
    { name: 'eggs', amount: 3, unit: '' },
  ],
  recipeInstructions: [
    { '@type': 'HowToStep', text: 'Boil pasta.' },
    { '@type': 'HowToStep', text: 'Mix eggs with cheese.' },
  ],
  keywords: ['italian', 'pasta'],
  author: 'Chef Mario',
  image: 'https://example.com/carbonara.jpg',
}

// ─── Render helper ────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/recipes/import']}>
        <Routes>
          <Route path="/recipes/import" element={<RecipeImportPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RecipeImportPage', () => {
  const mockExtractRecipeFromUrl = vi.mocked(scraper.extractRecipeFromUrl)
  const mockGetStoredApiKey = vi.mocked(scraper.getStoredApiKey)
  const mockCreateRecipe = vi.mocked(db.createRecipe)

  beforeEach(() => {
    mockGetStoredApiKey.mockReturnValue('test-api-key')
    mockExtractRecipeFromUrl.mockResolvedValue({ ok: true, recipe: sampleExtractedRecipe })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateRecipe.mockResolvedValue({ id: 'new-recipe-id' } as any)
    mockNavigate.mockClear()
  })

  // ── API key validation ─────────────────────────────────────────────────────

  describe('API key validation', () => {
    it('shows a prompt to add an API key when none is stored', () => {
      mockGetStoredApiKey.mockReturnValue('')
      renderPage()
      expect(screen.getByText('AI API key required')).toBeInTheDocument()
    })

    it('renders a link to Settings when API key is missing', () => {
      mockGetStoredApiKey.mockReturnValue('')
      renderPage()
      expect(screen.getByRole('link', { name: /go to settings/i })).toHaveAttribute('href', '/settings')
    })

    it('does not render the URL form when API key is missing', () => {
      mockGetStoredApiKey.mockReturnValue('')
      renderPage()
      expect(screen.queryByRole('button', { name: /extract recipe/i })).not.toBeInTheDocument()
    })

    it('renders the URL form when an API key is present', () => {
      renderPage()
      expect(screen.getByRole('button', { name: /extract recipe/i })).toBeInTheDocument()
    })
  })

  // ── URL form ───────────────────────────────────────────────────────────────

  describe('URL form (idle state)', () => {
    it('renders the Import Recipe heading', () => {
      renderPage()
      expect(screen.getByRole('heading', { name: /import recipe/i })).toBeInTheDocument()
    })

    it('renders the URL input with a placeholder', () => {
      renderPage()
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('placeholder', expect.stringContaining('https://'))
    })

    it('requires input before submission', () => {
      renderPage()
      expect(screen.getByRole('textbox')).toBeRequired()
    })

    it('back link points to the recipes list', () => {
      renderPage()
      expect(screen.getByRole('link', { name: /← recipes/i })).toHaveAttribute('href', '/')
    })
  })

  // ── Loading state ──────────────────────────────────────────────────────────

  describe('loading state', () => {
    it('shows a loading indicator while extracting', async () => {
      mockExtractRecipeFromUrl.mockReturnValue(new Promise(() => {}))
      const user = userEvent.setup()
      renderPage()

      await user.type(screen.getByRole('textbox'), 'https://example.com/recipe')
      await user.click(screen.getByRole('button', { name: /extract recipe/i }))

      expect(screen.getByText(/extracting recipe/i)).toBeInTheDocument()
    })

    it('hides the URL form while loading', async () => {
      mockExtractRecipeFromUrl.mockReturnValue(new Promise(() => {}))
      const user = userEvent.setup()
      renderPage()

      await user.type(screen.getByRole('textbox'), 'https://example.com/recipe')
      await user.click(screen.getByRole('button', { name: /extract recipe/i }))

      expect(screen.queryByRole('button', { name: /extract recipe/i })).not.toBeInTheDocument()
    })
  })

  // ── Error handling ─────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('shows the server error message when extraction fails', async () => {
      mockExtractRecipeFromUrl.mockResolvedValue({ ok: false, error: 'Page not found' })
      const user = userEvent.setup()
      renderPage()

      await user.type(screen.getByRole('textbox'), 'https://example.com/bad-url')
      await user.click(screen.getByRole('button', { name: /extract recipe/i }))

      await waitFor(() => {
        expect(screen.getByText('Page not found')).toBeInTheDocument()
      })
    })

    it('re-shows the URL form after a failed extraction', async () => {
      mockExtractRecipeFromUrl.mockResolvedValue({ ok: false, error: 'Some error' })
      const user = userEvent.setup()
      renderPage()

      await user.type(screen.getByRole('textbox'), 'https://example.com/bad-url')
      await user.click(screen.getByRole('button', { name: /extract recipe/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /extract recipe/i })).toBeInTheDocument()
      })
    })
  })

  // ── Review screen ──────────────────────────────────────────────────────────

  describe('review screen', () => {
    async function triggerReview() {
      const user = userEvent.setup()
      renderPage()
      await user.type(screen.getByRole('textbox'), 'https://example.com/recipe')
      await user.click(screen.getByRole('button', { name: /extract recipe/i }))
      await screen.findByText('Recipe extracted! Review before saving.')
      return user
    }

    it('shows the "Recipe extracted" confirmation message', async () => {
      await triggerReview()
      expect(screen.getByText('Recipe extracted! Review before saving.')).toBeInTheDocument()
    })

    it('renders the recipe name', async () => {
      await triggerReview()
      expect(screen.getByText('Pasta Carbonara')).toBeInTheDocument()
    })

    it('renders the recipe author', async () => {
      await triggerReview()
      expect(screen.getByText(/by Chef Mario/)).toBeInTheDocument()
    })

    it('renders ingredient names', async () => {
      await triggerReview()
      expect(screen.getByText('spaghetti')).toBeInTheDocument()
      expect(screen.getByText('eggs')).toBeInTheDocument()
    })

    it('renders instruction steps', async () => {
      await triggerReview()
      expect(screen.getByText('Boil pasta.')).toBeInTheDocument()
      expect(screen.getByText('Mix eggs with cheese.')).toBeInTheDocument()
    })

    it('renders keyword tags', async () => {
      await triggerReview()
      expect(screen.getByText('italian')).toBeInTheDocument()
      expect(screen.getByText('pasta')).toBeInTheDocument()
    })

    it('renders a Save Recipe button', async () => {
      await triggerReview()
      expect(screen.getByRole('button', { name: /save recipe/i })).toBeInTheDocument()
    })

    it('renders a "Try another" button', async () => {
      await triggerReview()
      expect(screen.getByRole('button', { name: /try another/i })).toBeInTheDocument()
    })

    it('renders the recipe image when one is present', async () => {
      await triggerReview()
      expect(screen.getByTestId('recipe-image')).toBeInTheDocument()
    })

    it('renders serves, prep, and cook time metadata', async () => {
      await triggerReview()
      expect(screen.getByText(/serves 2/i)).toBeInTheDocument()
      expect(screen.getByText(/prep 10m/i)).toBeInTheDocument()
      expect(screen.getByText(/cook 20m/i)).toBeInTheDocument()
    })
  })

  // ── Save flow ──────────────────────────────────────────────────────────────

  describe('save flow', () => {
    it('calls createRecipe and navigates to the new recipe detail page', async () => {
      const user = userEvent.setup()
      renderPage()

      await user.type(screen.getByRole('textbox'), 'https://example.com/recipe')
      await user.click(screen.getByRole('button', { name: /extract recipe/i }))
      await screen.findByText('Recipe extracted! Review before saving.')

      await user.click(screen.getByRole('button', { name: /save recipe/i }))

      await waitFor(() => {
        expect(mockCreateRecipe).toHaveBeenCalledOnce()
        expect(mockNavigate).toHaveBeenCalledWith('/recipes/new-recipe-id')
      })
    })

    it('passes extracted recipe fields to createRecipe', async () => {
      const user = userEvent.setup()
      renderPage()

      await user.type(screen.getByRole('textbox'), 'https://example.com/recipe')
      await user.click(screen.getByRole('button', { name: /extract recipe/i }))
      await screen.findByText('Recipe extracted! Review before saving.')

      await user.click(screen.getByRole('button', { name: /save recipe/i }))

      await waitFor(() => {
        expect(mockCreateRecipe).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Pasta Carbonara' }),
        )
      })
    })

    it('shows "Saving…" label and disables buttons while saving', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let resolveSave!: (value: any) => void
      mockCreateRecipe.mockReturnValue(new Promise((resolve) => { resolveSave = resolve }))

      const user = userEvent.setup()
      renderPage()

      await user.type(screen.getByRole('textbox'), 'https://example.com/recipe')
      await user.click(screen.getByRole('button', { name: /extract recipe/i }))
      await screen.findByText('Recipe extracted! Review before saving.')

      await user.click(screen.getByRole('button', { name: /save recipe/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled()
        expect(screen.getByRole('button', { name: /try another/i })).toBeDisabled()
      })

      // Resolve to avoid async leaks
      resolveSave({ id: 'new-recipe-id' })
    })
  })

  // ── Reset flow ─────────────────────────────────────────────────────────────

  describe('reset flow', () => {
    it('clicking "Try another" returns to the URL form', async () => {
      const user = userEvent.setup()
      renderPage()

      await user.type(screen.getByRole('textbox'), 'https://example.com/recipe')
      await user.click(screen.getByRole('button', { name: /extract recipe/i }))
      await screen.findByText('Recipe extracted! Review before saving.')

      await user.click(screen.getByRole('button', { name: /try another/i }))

      expect(screen.getByRole('button', { name: /extract recipe/i })).toBeInTheDocument()
      expect(screen.queryByText('Recipe extracted! Review before saving.')).not.toBeInTheDocument()
    })

    it('clears the URL input when reset', async () => {
      const user = userEvent.setup()
      renderPage()

      await user.type(screen.getByRole('textbox'), 'https://example.com/recipe')
      await user.click(screen.getByRole('button', { name: /extract recipe/i }))
      await screen.findByText('Recipe extracted! Review before saving.')

      await user.click(screen.getByRole('button', { name: /try another/i }))

      expect(screen.getByRole('textbox')).toHaveValue('')
    })
  })
})
