import { useRef } from 'react'
import { X } from 'lucide-react'
import { useFocusTrap } from '../hooks/useFocusTrap'

interface ShortcutRow {
  keys: string[]
  description: string
}

const SHORTCUT_GROUPS: { heading: string; rows: ShortcutRow[] }[] = [
  {
    heading: 'Global',
    rows: [
      { keys: ['n'], description: 'New recipe' },
      { keys: ['/'], description: 'Open search' },
      { keys: ['⌘', 'K'], description: 'Open search' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
    ],
  },
  {
    heading: 'Recipes',
    rows: [
      { keys: ['/'], description: 'Focus search' },
      { keys: ['Esc'], description: 'Close dialog / go back' },
    ],
  },
  {
    heading: 'Meal Plan',
    rows: [
      { keys: ['←'], description: 'Previous week' },
      { keys: ['→'], description: 'Next week' },
      { keys: ['Esc'], description: 'Close modal' },
    ],
  },
]

interface Props {
  onClose: () => void
}

export default function KeyboardShortcutsDialog({ onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef)

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">
            Keyboard shortcuts
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Shortcut list */}
        <div className="px-5 py-4 space-y-5">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.heading}>
              <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                {group.heading}
              </p>
              <dl className="space-y-2">
                {group.rows.map((row) => (
                  <div
                    key={row.description}
                    className="flex items-center justify-between gap-4"
                  >
                    <dd className="text-sm text-gray-600 dark:text-gray-300">
                      {row.description}
                    </dd>
                    <dt className="flex items-center gap-1 shrink-0">
                      {row.keys.map((k) => (
                        <kbd
                          key={k}
                          className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 text-xs font-mono bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-gray-600 dark:text-gray-300"
                        >
                          {k}
                        </kbd>
                      ))}
                    </dt>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
