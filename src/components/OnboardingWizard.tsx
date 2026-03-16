import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, CalendarDays, ShoppingCart, Utensils, X } from 'lucide-react'

const STORAGE_KEY = 'mise_onboarding_done'

export function isOnboardingDone(): boolean {
  return localStorage.getItem(STORAGE_KEY) === '1'
}

function markOnboardingDone() {
  localStorage.setItem(STORAGE_KEY, '1')
}

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Mise',
    subtitle: 'Everything in its place.',
    body: 'Your personal meal planning companion. Save recipes, plan your week, and build shopping lists — all in one place, right on your device.',
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

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Mise"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          {/* Progress dots */}
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`block w-2 h-2 rounded-full transition-colors ${
                  i === step
                    ? 'bg-green-600'
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
                <Utensils size={28} strokeWidth={1.5} className="text-green-600 dark:text-green-400" aria-hidden="true" />
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
                      <f.icon size={18} strokeWidth={1.75} className="text-green-600 dark:text-green-400" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{f.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{f.description}</p>
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
                <BookOpen size={28} strokeWidth={1.5} className="text-green-600 dark:text-green-400" aria-hidden="true" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {current.title}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                {current.subtitle}
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={goAddRecipe}
                  className="w-full bg-green-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-green-700 transition-colors"
                >
                  Add a recipe manually
                </button>
                <button
                  onClick={goImport}
                  className="w-full border border-green-600 dark:border-green-500 text-green-600 dark:text-green-400 text-sm font-semibold py-2.5 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
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
              className="flex-1 bg-green-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-green-700 transition-colors"
            >
              {step === 0 ? 'Get started' : 'Next'}
            </button>
          )}
          {isLast && (
            <button
              onClick={dismiss}
              className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Maybe later
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
