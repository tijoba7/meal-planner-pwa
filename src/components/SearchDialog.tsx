import { useRef, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, CalendarDays, ShoppingCart, Search } from 'lucide-react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { searchAll, type SearchResult, type SearchResults } from '../lib/search'
import { SearchNoResultsIllustration } from './EmptyStateIllustrations'

interface Props {
  onClose: () => void
}

const SECTION_META = {
  recipes: { label: 'Recipes', Icon: BookOpen },
  mealPlans: { label: 'Meal Plans', Icon: CalendarDays },
  shoppingLists: { label: 'Shopping Lists', Icon: ShoppingCart },
} as const

function flattenResults(results: SearchResults): SearchResult[] {
  return [...results.recipes, ...results.mealPlans, ...results.shoppingLists]
}

export default function SearchDialog({ onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  useFocusTrap(dialogRef)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults(null)
      setActiveIdx(0)
      return
    }
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await searchAll(query)
        setResults(res)
        setActiveIdx(0)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const flat = results ? flattenResults(results) : []
  const totalResults = flat.length
  const hasResults = totalResults > 0
  const showEmpty = results !== null && !loading && !hasResults

  const handleSelect = useCallback(
    (result: SearchResult) => {
      navigate(result.href)
      onClose()
    },
    [navigate, onClose],
  )

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose()
      return
    }
    if (!hasResults) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => (i + 1) % totalResults)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => (i - 1 + totalResults) % totalResults)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selected = flat[activeIdx]
      if (selected) handleSelect(selected)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-[10vh] px-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg animate-scale-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <Search size={18} className="text-gray-400 dark:text-gray-500 shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search recipes, meal plans, shopping lists…"
            className="flex-1 bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none"
            aria-label="Search"
            aria-autocomplete="list"
            aria-activedescendant={hasResults ? `search-result-${activeIdx}` : undefined}
          />
          {loading && (
            <span className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-green-500 rounded-full animate-spin shrink-0" aria-hidden="true" />
          )}
          <kbd className="hidden sm:inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-mono bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-gray-400 dark:text-gray-500 shrink-0">
            esc
          </kbd>
        </div>

        {/* Results */}
        {results && hasResults && (
          <div className="max-h-[60vh] overflow-y-auto py-2" role="listbox" aria-label="Search results">
            {(Object.entries(SECTION_META) as [keyof SearchResults, typeof SECTION_META[keyof typeof SECTION_META]][]).map(
              ([key, { label, Icon }]) => {
                const items = results[key]
                if (!items.length) return null
                // Calculate offset into flat array for active index tracking
                const sectionOffset =
                  key === 'recipes'
                    ? 0
                    : key === 'mealPlans'
                      ? results.recipes.length
                      : results.recipes.length + results.mealPlans.length

                return (
                  <div key={key}>
                    <p className="px-4 pt-2 pb-1 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Icon size={11} aria-hidden="true" />
                      {label}
                    </p>
                    {items.map((result, i) => {
                      const flatIdx = sectionOffset + i
                      const isActive = flatIdx === activeIdx
                      return (
                        <button
                          key={result.id}
                          id={`search-result-${flatIdx}`}
                          role="option"
                          aria-selected={isActive}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            isActive
                              ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                              : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          }`}
                          onClick={() => handleSelect(result)}
                          onMouseEnter={() => setActiveIdx(flatIdx)}
                        >
                          <Icon
                            size={15}
                            className={isActive ? 'text-green-500' : 'text-gray-400 dark:text-gray-500'}
                            aria-hidden="true"
                          />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-medium truncate">{result.title}</span>
                            {result.subtitle && (
                              <span className="block text-xs text-gray-400 dark:text-gray-500 truncate">
                                {result.subtitle}
                              </span>
                            )}
                          </span>
                          {isActive && (
                            <kbd className="shrink-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-mono bg-green-100 dark:bg-green-900/50 border border-green-200 dark:border-green-700 rounded text-green-600 dark:text-green-400">
                              ↵
                            </kbd>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              },
            )}
          </div>
        )}

        {/* Empty state */}
        {showEmpty && (
          <div className="flex flex-col items-center gap-3 py-10 px-4 text-center">
            <div className="w-16 h-16">
              <SearchNoResultsIllustration />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No results for <span className="font-medium text-gray-700 dark:text-gray-200">"{query}"</span>
            </p>
          </div>
        )}

        {/* Initial state hint */}
        {!results && !loading && (
          <div className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 flex items-center justify-between">
            <span>Search recipes, ingredients, meal plans, and lists</span>
            <span className="flex items-center gap-1">
              <kbd className="inline-flex items-center justify-center px-1 py-0.5 font-mono bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-gray-400 dark:text-gray-500">↑</kbd>
              <kbd className="inline-flex items-center justify-center px-1 py-0.5 font-mono bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-gray-400 dark:text-gray-500">↓</kbd>
              <span className="ml-0.5">to navigate</span>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
