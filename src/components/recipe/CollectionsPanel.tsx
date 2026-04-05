import { Check, Library, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Collection } from '../../types'

interface CollectionsPanelProps {
  visible: boolean
  onClose: () => void
  recipeId: string
  collections: Collection[]
  togglingId: string | null
  onToggle: (collectionId: string) => void
}

export default function CollectionsPanel({
  visible,
  onClose,
  recipeId,
  collections,
  togglingId,
  onToggle,
}: CollectionsPanelProps) {
  if (!visible) return null

  return (
    <div className="print:hidden fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in">
      <div
        className="bg-white dark:bg-gray-800 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[80vh] shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="collections-panel-title"
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h4
            id="collections-panel-title"
            className="font-bold text-gray-800 dark:text-gray-100"
          >
            Add to Collection
          </h4>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            aria-label="Close"
          >
            <X size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">
          {collections.length === 0 ? (
            <div className="text-center py-6">
              <Library
                size={36}
                strokeWidth={1.5}
                className="mx-auto mb-3 text-gray-300 dark:text-gray-600"
                aria-hidden="true"
              />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                No collections yet
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                Create a collection to organize your recipes.
              </p>
              <Link
                to="/collections"
                onClick={onClose}
                className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 font-medium"
              >
                Go to Collections →
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {collections.map((col) => {
                const inCollection = col.recipeIds.includes(recipeId)
                const busy = togglingId === col.id
                return (
                  <li key={col.id}>
                    <button
                      onClick={() => onToggle(col.id)}
                      disabled={busy}
                      aria-pressed={inCollection}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors disabled:opacity-50 ${
                        inCollection
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          inCollection
                            ? 'bg-green-700 border-green-600'
                            : 'border-gray-300 dark:border-gray-500'
                        }`}
                      >
                        {inCollection && <Check size={12} strokeWidth={3} aria-hidden="true" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium truncate ${inCollection ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-200'}`}
                        >
                          {col.name}
                        </p>
                        {col.description && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                            {col.description}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                        {col.recipeIds.length} recipe{col.recipeIds.length !== 1 ? 's' : ''}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <div className="p-4 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
