import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, CalendarDays, ShoppingCart, Utensils, X } from 'lucide-react'
import { useCreateRecipe } from '../hooks/useRecipes'
import { useFocusTrap } from '../hooks/useFocusTrap'

const STORAGE_KEY = 'mise_onboarding_done'

export function isOnboardingDone(): boolean {
  return localStorage.getItem(STORAGE_KEY) === '1'
}

function markOnboardingDone() {
  localStorage.setItem(STORAGE_KEY, '1')
}

const SAMPLE_RECIPE = {
  name: 'Classic Tomato Pasta',
  description: 'A simple weeknight pasta with a rich tomato sauce. Ready in under 30 minutes.',
  recipeYield: '4',
  prepTime: 'PT5M',
  cookTime: 'PT20M',
  recipeIngredient: [
    { name: 'spaghetti', amount: 400, unit: 'g' },
    { name: 'canned crushed tomatoes', amount: 400, unit: 'g' },
    { name: 'garlic cloves', amount: 3, unit: '' },
    { name: 'olive oil', amount: 2, unit: 'tbsp' },
    { name: 'salt', amount: 1, unit: 'tsp' },
    { name: 'black pepper', amount: 0.5, unit: 'tsp' },
    { name: 'fresh basil', amount: 1, unit: 'handful' },
  ],
  recipeInstructions: [
    {
      '@type': 'HowToStep' as const,
      text: 'Boil a large pot of salted water. Cook spaghetti according to package directions until al dente.',
    },
    {
      '@type': 'HowToStep' as const,
      text: 'Heat olive oil in a skillet over medium heat. Add minced garlic and cook 1 minute until fragrant.',
    },
    {
      '@type': 'HowToStep' as const,
      text: 'Add crushed tomatoes, salt, and pepper. Simmer 15 minutes, stirring occasionally.',
    },
    {
      '@type': 'HowToStep' as const,
      text: 'Drain pasta, toss with sauce. Tear fresh basil on top and serve.',
    },
  ],
  keywords: ['pasta', 'italian', 'vegetarian', 'quick'],
  isFavorite: false,
}

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to mise 🍲',
    subtitle: 'Cook. Share. Enjoy.',
    body: 'Discover and share recipes with friends, plan your week, and build shopping lists — all in one place.',
    icon: null as null,
  },
  {
    id: 'features',
    title: 'What you can do',
    subtitle: null as null,
    body: null as null,
    icon: null as null,
  },
  {
    id: 'start',
    title: 'Ready to start?',
    subtitle: 'Add your first recipe to get going.',
    body: null as null,
    icon: null as null,
  },
]

const FEATURES = [
  {
    icon: BookOpen,
    title: 'Recipe storage',
    description: 'Save recipes manually or import directly from any URL.',
  },
  {
    icon: CalendarDays,
    title: 'Meal planning',
    description: 'Assign recipes to your week with a simple weekly calendar.',
  },
  {
    icon: ShoppingCart,
    title: 'Shopping lists',
    description: 'Auto-generate grocery lists from your planned meals.',
  },
]

interface OnboardingWizardProps {
  onDone: () => void
}

export default function OnboardingWizard({ onDone }: OnboardingWizardProps) {
  const [step, setStep] = useState(0)
  const navigate = useNavigate()
  const dialogRef = useRef<HTMLDivElement>(null)
  const createRecipeMutation = useCreateRecipe()
  useFocusTrap(dialogRef)
  const saving = createRecipeMutation.isPending

  function dismiss() {
    markOnboardingDone()
    onDone()
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep(step + 1)
    } else {
      dismiss()
    }
  }

  function goAddRecipe() {
    dismiss()
    navigate('/recipes/new')
  }

  function goImport() {
    dismiss()
    navigate('/recipes/import')
  }

  async function goSampleRecipe() {
    if (saving) return
    try {
      const recipe = await createRecipeMutation.mutateAsync(SAMPLE_RECIPE)
      dismiss()
      navigate(`/recipes/${recipe.id}`)
    } catch {
      // ignore — saving state resets automatically via isPending
    }
  }

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to mise"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          {/* Progress dots */}
          <div className="flex gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((_, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={`block w-2 h-2 rounded-full transition-colors ${
                  i === step
                    ? 'bg-green-700'
                    : i < step
                      ? 'bg-green-300 dark:bg-green-700'
                      : 'bg-gray-200 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>
          <button
            onClick={dismiss}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1"
            aria-label="Skip onboarding"
          >
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 flex-1">
          {/* Step: Welcome */}
          {current.id === 'welcome' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <Utensils
                  size={28}
                  strokeWidth={1.5}
                  className="text-green-600 dark:text-green-400"
                  aria-hidden="true"
                />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                {current.title}
              </h2>
              <p className="text-green-600 dark:text-green-400 font-medium text-sm mb-4">
                {current.subtitle}
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                {current.body}
              </p>
            </div>
          )}

          {/* Step: Features */}
          {current.id === 'features' && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-5">
                {current.title}
              </h2>
              <ul className="space-y-4">
                {FEATURES.map((f) => (
                  <li key={f.title} className="flex gap-4 items-start">
                    <div className="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center shrink-0">
                      <f.icon
                        size={18}
                        strokeWidth={1.75}
                        className="text-green-600 dark:text-green-400"
                        aria-hidden="true"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                        {f.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                        {f.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Step: Get Started */}
          {current.id === 'start' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <BookOpen
                  size={28}
                  strokeWidth={1.5}
                  className="text-green-600 dark:text-green-400"
                  aria-hidden="true"
                />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {current.title}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{current.subtitle}</p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={goSampleRecipe}
                  disabled={saving}
                  className="w-full bg-green-700 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-green-800 disabled:opacity-60 transition-colors"
                >
                  {saving ? 'Adding…' : 'Try a sample recipe'}
                </button>
                <button
                  onClick={goAddRecipe}
                  className="w-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Add a recipe manually
                </button>
                <button
                  onClick={goImport}
                  className="w-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Import from URL
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Back
            </button>
          )}
          {!isLast && (
            <button
              onClick={next}
              className="flex-1 bg-green-700 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-green-800 transition-colors"
            >
              {step === 0 ? 'Get started' : 'Next'}
            </button>
          )}
          {isLast && (
            <button
              onClick={dismiss}
              className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Skip for now
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
