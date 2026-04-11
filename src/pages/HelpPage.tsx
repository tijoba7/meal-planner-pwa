import { useState, useMemo } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Search,
  HelpCircle,
  BookOpen,
  CalendarDays,
  ShoppingCart,
  Package,
  Keyboard,
  Info,
} from 'lucide-react'
import { PageHeader } from '../components/ui'
import { Card, CardBody } from '../components/ui'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HelpItemData {
  question: string
  answer: string
}

interface HelpSection {
  id: string
  title: string
  icon: React.ReactNode
  items: HelpItemData[]
}

// ─── Content ──────────────────────────────────────────────────────────────────

const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: <HelpCircle size={18} strokeWidth={1.75} aria-hidden="true" />,
    items: [
      {
        question: 'What is Braisely?',
        answer:
          'Braisely is a social recipe platform where you can discover, cook, and share recipes with friends. Plan meals, build shopping lists, and connect with other food lovers.',
      },
      {
        question: 'Do I need to create an account?',
        answer:
          'No. All data is stored locally on your device by default. You can optionally sign in to sync across devices and share recipes with friends.',
      },
      {
        question: 'How do I navigate the app?',
        answer:
          'Use the sidebar on desktop or the bottom tab bar on mobile. Recipes is the home screen. Press ? at any time to see keyboard shortcuts.',
      },
      {
        question: 'Can I use Braisely offline?',
        answer:
          'Yes. Braisely is a Progressive Web App (PWA) and works fully offline. You can also install it to your home screen for a native app experience.',
      },
    ],
  },
  {
    id: 'recipes',
    title: 'Recipes',
    icon: <BookOpen size={18} strokeWidth={1.75} aria-hidden="true" />,
    items: [
      {
        question: 'How do I add a recipe?',
        answer:
          'Tap the + button on the Recipes page, or press N on your keyboard. Fill in the title, ingredients, and instructions. All fields except the title are optional.',
      },
      {
        question: 'Can I import recipes from a website?',
        answer:
          'Yes — use Recipes → Import URL. Paste a recipe URL and Braisely will attempt to extract the recipe automatically. This requires an AI API key configured in Settings.',
      },
      {
        question: 'How do I organise recipes into collections?',
        answer:
          'Open a recipe and tap "Add to collection", or go to the Collections page to create a collection and add recipes to it. Collections are great for groupings like "Weeknight dinners" or "Baking".',
      },
      {
        question: 'Can I scale recipe servings?',
        answer:
          'Yes. On the recipe detail page use the serving size selector to scale ingredient quantities up or down. The scaling is calculated automatically.',
      },
      {
        question: 'How do dietary tags work?',
        answer:
          "You can tag each recipe with dietary labels (vegan, gluten-free, etc). Go to Settings → Dietary preferences to set your household's needs — Braisely will then highlight any mismatches when you plan meals.",
      },
    ],
  },
  {
    id: 'meal-planning',
    title: 'Meal Planning',
    icon: <CalendarDays size={18} strokeWidth={1.75} aria-hidden="true" />,
    items: [
      {
        question: 'How does the weekly planner work?',
        answer:
          'The Meal Plan page shows a 7-day grid. Drag recipes from your library onto any slot (breakfast, lunch, dinner, snack), or tap a slot to search and add a recipe.',
      },
      {
        question: 'What are meal plan templates?',
        answer:
          'Templates let you save a full week\'s plan and re-apply it later. Create a template from the current plan using the "Save as template" option, then load it any week.',
      },
      {
        question: 'Can I copy a meal plan to the next week?',
        answer:
          'Yes. Use the "Copy week" action on the Meal Plan page to duplicate the current week\'s plan into the next week.',
      },
      {
        question: 'How do I generate a shopping list from my plan?',
        answer:
          'On the Meal Plan page, tap "Generate shopping list". Braisely combines all ingredient quantities for the week and creates a list on the Shopping page, grouped by category.',
      },
    ],
  },
  {
    id: 'shopping',
    title: 'Shopping Lists',
    icon: <ShoppingCart size={18} strokeWidth={1.75} aria-hidden="true" />,
    items: [
      {
        question: 'How are shopping lists generated?',
        answer:
          'Lists are generated from your meal plan. Ingredients from all meals in the selected week are combined, duplicate items are merged, and quantities are summed. You can also create a list manually.',
      },
      {
        question: 'Can I add items manually to a list?',
        answer:
          'Yes. Open a shopping list and use the "Add item" field at the bottom to type in any item. Manually added items are shown alongside generated items.',
      },
      {
        question: 'How do categories work?',
        answer:
          'Items are automatically categorised (produce, dairy, pantry, etc.) based on common ingredient names. You can tap the category label on any item to change it.',
      },
      {
        question: 'How do I check off items while shopping?',
        answer:
          'Tap the circle next to any item to mark it as bought. Checked items move to the bottom of their category. Tap again to uncheck.',
      },
    ],
  },
  {
    id: 'pantry',
    title: 'Pantry',
    icon: <Package size={18} strokeWidth={1.75} aria-hidden="true" />,
    items: [
      {
        question: 'What is the pantry for?',
        answer:
          'The Pantry tracks what ingredients you have at home, including quantity and expiry dates. This helps you avoid buying duplicates and alerts you when items are expiring soon.',
      },
      {
        question: 'How do I add items to my pantry?',
        answer:
          'Go to the Pantry page and tap "Add item". Enter the ingredient name, quantity, and an optional expiry date. You can also move items from a shopping list into the pantry after a shop.',
      },
      {
        question: 'How do expiry alerts work?',
        answer:
          "Items expiring within 7 days are highlighted in amber. Items that have expired are shown in red. You'll also see a count in the Pantry nav link when items need attention.",
      },
    ],
  },
  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    icon: <Keyboard size={18} strokeWidth={1.75} aria-hidden="true" />,
    items: [
      {
        question: 'Global shortcuts',
        answer: [
          'N — New recipe',
          '/ — Open search',
          'Cmd+K / Ctrl+K — Open search',
          '? — Open/close this shortcuts dialog',
          'Esc — Close modal or dialog',
        ].join('\n'),
      },
    ],
  },
  {
    id: 'about',
    title: 'About',
    icon: <Info size={18} strokeWidth={1.75} aria-hidden="true" />,
    items: [
      {
        question: 'App version',
        answer: 'Braisely v1.0.0',
      },
      {
        question: 'What does "local-first" mean?',
        answer:
          "Your data lives in your browser's IndexedDB storage by default. Nothing is sent to a server unless you sign in. You own your data.",
      },
      {
        question: 'How do I back up my data?',
        answer:
          'Go to Settings → Data & storage → Export backup. This downloads a JSON file containing all your recipes, plans, and lists. You can restore it later from the same screen.',
      },
      {
        question: 'Where can I report a bug or request a feature?',
        answer: 'Open an issue on GitHub. We welcome feedback and contributions.',
      },
    ],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function matches(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase())
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HelpItem({
  question,
  answer,
  defaultOpen,
}: {
  question: string
  answer: string
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  // Re-open when search forces it
  if (defaultOpen && !open) setOpen(true)

  return (
    <div className="border-b border-gray-100 dark:border-gray-700 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        aria-expanded={open}
      >
        <span>{question}</span>
        {open ? (
          <ChevronDown
            size={16}
            strokeWidth={2}
            className="shrink-0 text-gray-400 dark:text-gray-500"
            aria-hidden="true"
          />
        ) : (
          <ChevronRight
            size={16}
            strokeWidth={2}
            className="shrink-0 text-gray-400 dark:text-gray-500"
            aria-hidden="true"
          />
        )}
      </button>
      {open && (
        <div className="px-4 pb-3 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  )
}

function SectionCard({ section, searchQuery }: { section: HelpSection; searchQuery: string }) {
  const [sectionOpen, setSectionOpen] = useState(true)

  const visibleItems = useMemo(() => {
    if (!searchQuery) return section.items
    return section.items.filter(
      (item) => matches(item.question, searchQuery) || matches(item.answer, searchQuery)
    )
  }, [section.items, searchQuery])

  if (visibleItems.length === 0) return null

  return (
    <Card>
      <button
        onClick={() => setSectionOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left rounded-t-xl hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
        aria-expanded={sectionOpen}
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
          <span className="text-green-600 dark:text-green-400">{section.icon}</span>
          {section.title}
          <span className="text-xs font-normal text-gray-400 dark:text-gray-500 ml-1">
            {visibleItems.length} {visibleItems.length === 1 ? 'item' : 'items'}
          </span>
        </div>
        {sectionOpen ? (
          <ChevronDown
            size={16}
            strokeWidth={2}
            className="shrink-0 text-gray-400 dark:text-gray-500"
            aria-hidden="true"
          />
        ) : (
          <ChevronRight
            size={16}
            strokeWidth={2}
            className="shrink-0 text-gray-400 dark:text-gray-500"
            aria-hidden="true"
          />
        )}
      </button>
      {sectionOpen && (
        <div className="border-t border-gray-100 dark:border-gray-700">
          {visibleItems.map((item) => (
            <HelpItem
              key={item.question}
              question={item.question}
              answer={item.answer}
              defaultOpen={!!searchQuery}
            />
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('')

  const visibleSections = useMemo(() => {
    if (!searchQuery) return HELP_SECTIONS
    return HELP_SECTIONS.filter(
      (section) =>
        matches(section.title, searchQuery) ||
        section.items.some(
          (item) => matches(item.question, searchQuery) || matches(item.answer, searchQuery)
        )
    )
  }, [searchQuery])

  const totalResults = useMemo(() => {
    if (!searchQuery) return null
    return visibleSections.reduce((acc, s) => {
      return (
        acc +
        s.items.filter(
          (item) => matches(item.question, searchQuery) || matches(item.answer, searchQuery)
        ).length
      )
    }, 0)
  }, [searchQuery, visibleSections])

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <PageHeader title="Help & Support" />

      {/* Search */}
      <div className="relative mb-4">
        <Search
          size={16}
          strokeWidth={1.75}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Search help topics…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full border border-gray-200 dark:border-gray-600 rounded-lg pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
          aria-label="Search help topics"
        />
      </div>

      {/* Results summary */}
      {searchQuery && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          {totalResults === 0
            ? 'No results found.'
            : `${totalResults} result${totalResults === 1 ? '' : 's'} for "${searchQuery}"`}
        </p>
      )}

      {/* Sections */}
      <div className="space-y-3">
        {visibleSections.length > 0
          ? visibleSections.map((section) => (
              <SectionCard key={section.id} section={section} searchQuery={searchQuery} />
            ))
          : searchQuery && (
              <Card>
                <CardBody>
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    No help topics match "{searchQuery}".
                  </p>
                </CardBody>
              </Card>
            )}
      </div>
    </div>
  )
}
