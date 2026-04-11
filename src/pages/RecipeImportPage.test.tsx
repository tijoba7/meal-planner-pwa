import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import RecipeImportPage from './RecipeImportPage'
import { ToastProvider } from '../contexts/ToastContext'
import * as scraper from '../lib/scraper'
import * as db from '../lib/db'
import * as appSettings from '../lib/appSettingsService'
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

vi.mock('../lib/scraper', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/scraper')>()
  return {
    ...actual,
    extractRecipeFromUrl: vi.fn(),
    extractRecipeFromText: vi.fn(),
    extractRecipesFromUrls: vi.fn(),
    detectInputMode: actual.detectInputMode,
  }
})

vi.mock('../lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/db')>()
  return { ...actual, createRecipe: vi.fn() }
})

vi.mock('../components/RecipeImage', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} data-testid="recipe-image" />,
}))

vi.mock('../lib/appSettingsService', () => ({
  getAppSettingString: vi.fn().mockResolvedValue('admin-api-key'),
  APP_SETTING_KEYS: { SCRAPING_API_KEY: 'scraping.api_key' },
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
    </ToastProvider>
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RecipeImportPage', () => {
  const mockExtractRecipeFromUrl = vi.mocked(scraper.extractRecipeFromUrl)
  const mockCreateRecipe = vi.mocked(db.createRecipe)

  beforeEach(() => {
    mockExtractRecipeFromUrl.mockResolvedValue({ ok: true, recipe: sampleExtractedRecipe })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCreateRecipe.mockResolvedValue({ id: 'new-recipe-id' } as any)
    mockNavigate.mockClear()
  })

  // ── No admin key gate ──────────────────────────────────────────────────────

  describe('no admin key gate', () => {
    beforeEach(() => {
      vi.mocked(appSettings.getAppSettingString).mockResolvedValue(null)
    })

    afterEach(() => {
      vi.mocked(appSettings.getAppSettingString).mockResolvedValue('admin-api-key')
    })

    it('shows the AI API key not configured banner', async () => {
      renderPage()
      expect(await screen.findByText(/AI API key not configured/i)).toBeInTheDocument()
    })

    it('renders an "Import file" button for file import without admin key', async () => {
      renderPage()
      expect(await screen.findByRole('button', { name: /import file/i })).toBeInTheDocument()
    })

    it('does not render the textarea input when admin key is not configured', async () => {
      renderPage()
      await screen.findByText(/AI API key not configured/i)
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })
  })

  // ── Input form (with API key) ───────────────────────────────────────────────

  describe('input form (with API key)', () => {
    it('renders the Import Recipe heading', async () => {
      renderPage()
      expect(await screen.findByRole('heading', { name: /import recipe/i })).toBeInTheDocument()
    })

    it('renders the textarea input', async () => {
      renderPage()
      expect(await screen.findByRole('textbox')).toBeInTheDocument()
    })

    it('renders an Import submit button', async () => {
      renderPage()
      expect(await screen.findByRole('button', { name: /^import$/i })).toBeInTheDocument()
    })

    it('back link points to the recipes list', async () => {
      renderPage()
      expect(await screen.findByRole('link', { name: /← recipes/i })).toHaveAttribute('href', '/')
    })

    it('Import button is disabled when textarea is empty', async () => {
      renderPage()
      expect(await screen.findByRole('button', { name: /^import$/i })).toBeDisabled()
    })
  })

  // ── Loading state ──────────────────────────────────────────────────────────

  describe('loading state', () => {
    it('shows a loading indicator while extracting', async () => {
      mockExtractRecipeFromUrl.mockReturnValue(new Promise(() => {}))
      const user = userEvent.setup()
      renderPage()

      await user.type(await screen.findByRole('textbox'), 'https://example.com/recipe')
      await user.click(screen.getByRole('button', { name: /^import$/i }))

      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('hides the input form while loading', async () => {
      mockExtractRecipeFromUrl.mockReturnValue(new Promise(() => {}))
      const user = userEvent.setup()
      renderPage()

      await user.type(await screen.findByRole('textbox'), 'https://example.com/recipe')
      await user.click(screen.getByRole('button', { name: /^import$/i }))

      expect(screen.queryByRole('button', { name: /^import$/i })).not.toBeInTheDocument()
    })
  })

  // ── Error handling ─────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('shows the error message when extraction fails', async () => {
      mockExtractRecipeFromUrl.mockResolvedValue({ ok: false, error: 'Page not found' })
      const user = userEvent.setup()
      renderPage()

      await user.type(await screen.findByRole('textbox'), 'https://example.com/bad-url')
      await user.click(screen.getByRole('button', { name: /^import$/i }))

      await waitFor(() => {
        expect(screen.getByText('Page not found')).toBeInTheDocument()
      })
    })

    it('re-shows the input form after a failed extraction', async () => {
      mockExtractRecipeFromUrl.mockResolvedValue({ ok: false, error: 'Some error' })
      const user = userEvent.setup()
      renderPage()

      await user.type(await screen.findByRole('textbox'), 'https://example.com/bad-url')
      await user.click(screen.getByRole('button', { name: /^import$/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^import$/i })).toBeInTheDocument()
      })
    })
  })

  // ── Review screen ──────────────────────────────────────────────────────────

  describe('review screen', () => {
    async function triggerReview() {
      const user = userEvent.setup()
      renderPage()
      await user.type(await screen.findByRole('textbox'), 'https://example.com/recipe')
      await user.click(screen.getByRole('button', { name: /^import$/i }))
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

      await user.type(await screen.findByRole('textbox'), 'https://example.com/recipe')
      await user.click(screen.getByRole('button', { name: /^import$/i }))
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

      await user.type(await screen.findByRole('textbox'), 'https://example.com/recipe')
      await user.click(screen.getByRole('button', { name: /^import$/i }))
      await screen.findByText('Recipe extracted! Review before saving.')

      await user.click(screen.getByRole('button', { name: /save recipe/i }))

      await waitFor(() => {
        expect(mockCreateRecipe).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Pasta Carbonara' })
        )
      })
    })

    it('shows "Saving…" label and disables buttons while saving', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let resolveSave!: (value: any) => void
      mockCreateRecipe.mockReturnValue(
        new Promise((resolve) => {
          resolveSave = resolve
        })
      )

      const user = userEvent.setup()
      renderPage()

      await user.type(await screen.findByRole('textbox'), 'https://example.com/recipe')
      await user.click(screen.getByRole('button', { name: /^import$/i }))
      await screen.findByText('Recipe extracted! Review before saving.')

      await user.click(screen.getByRole('button', { name: /save recipe/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled()
        expect(screen.getByRole('button', { name: /try another/i })).toBeDisabled()
      })

      resolveSave({ id: 'new-recipe-id' })

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/recipes/new-recipe-id')
      })
    })
  })

  // ── Reset flow ─────────────────────────────────────────────────────────────

  describe('reset flow', () => {
    it('clicking "Try another" returns to the input form', async () => {
      const user = userEvent.setup()
      renderPage()

      await user.type(await screen.findByRole('textbox'), 'https://example.com/recipe')
      await user.click(screen.getByRole('button', { name: /^import$/i }))
      await screen.findByText('Recipe extracted! Review before saving.')

      await user.click(screen.getByRole('button', { name: /try another/i }))

      expect(screen.getByRole('button', { name: /^import$/i })).toBeInTheDocument()
      expect(screen.queryByText('Recipe extracted! Review before saving.')).not.toBeInTheDocument()
    })

    it('clears the input when reset', async () => {
      const user = userEvent.setup()
      renderPage()

      await user.type(await screen.findByRole('textbox'), 'https://example.com/recipe')
      await user.click(screen.getByRole('button', { name: /^import$/i }))
      await screen.findByText('Recipe extracted! Review before saving.')

      await user.click(screen.getByRole('button', { name: /try another/i }))

      expect(screen.getByRole('textbox')).toHaveValue('')
    })
  })
})
