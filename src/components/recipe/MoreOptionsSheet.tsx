import { createPortal } from 'react-dom'
import { Copy, Library, Pencil, Printer, Send, Share2, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Recipe } from '../../types'

interface MoreOptionsSheetProps {
  visible: boolean
  onClose: () => void
  recipe: Recipe
  user: { id: string } | null
  cloudMeta: { visibility: string; published: boolean } | null
  duplicatePending: boolean
  onEdit: () => void
  onPost: () => void
  onShare: () => void
  onCollect: () => void
  onDuplicate: () => void
  onDelete: () => void
}

export default function MoreOptionsSheet({
  visible,
  onClose,
  recipe,
  user,
  cloudMeta,
  duplicatePending,
  onPost,
  onShare,
  onCollect,
  onDuplicate,
  onDelete,
}: MoreOptionsSheetProps) {
  if (!visible) return null

  return createPortal(
    <div
      className="print:hidden fixed inset-0 bg-black/50 z-50 flex items-end justify-center animate-fade-in md:hidden"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 w-full rounded-t-2xl shadow-xl animate-slide-up"
        role="dialog"
        aria-modal="true"
        aria-label="Recipe options"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 space-y-1">
          <Link
            to={`/recipes/${recipe.id}/edit`}
            onClick={onClose}
            className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Pencil
              size={18}
              strokeWidth={2}
              className="text-gray-500 dark:text-gray-400 shrink-0"
              aria-hidden="true"
            />
            Edit recipe
          </Link>
          {user && (
            <>
              <button
                onClick={() => {
                  onClose()
                  onPost()
                }}
                className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-left text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <Send
                  size={18}
                  strokeWidth={2}
                  className="text-green-600 dark:text-green-400 shrink-0"
                  aria-hidden="true"
                />
                Post to feed
              </button>
              <button
                onClick={() => {
                  onClose()
                  onShare()
                }}
                className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-left text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <Share2
                  size={18}
                  strokeWidth={2}
                  className="text-gray-500 dark:text-gray-400 shrink-0"
                  aria-hidden="true"
                />
                {cloudMeta && cloudMeta.visibility !== 'private'
                  ? 'Sharing settings'
                  : 'Share recipe'}
              </button>
            </>
          )}
          <button
            onClick={() => {
              onClose()
              onCollect()
            }}
            className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-left text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Library
              size={18}
              strokeWidth={2}
              className="text-gray-500 dark:text-gray-400 shrink-0"
              aria-hidden="true"
            />
            Add to collection
          </button>
          <button
            onClick={() => {
              onClose()
              window.print()
            }}
            className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-left text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Printer
              size={18}
              strokeWidth={2}
              className="text-gray-500 dark:text-gray-400 shrink-0"
              aria-hidden="true"
            />
            Print recipe
          </button>
          <button
            onClick={() => {
              onClose()
              onDuplicate()
            }}
            disabled={duplicatePending}
            className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-left text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <Copy
              size={18}
              strokeWidth={2}
              className="text-gray-500 dark:text-gray-400 shrink-0"
              aria-hidden="true"
            />
            {duplicatePending ? 'Duplicating…' : 'Duplicate recipe'}
          </button>
          <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
          <button
            onClick={() => {
              onClose()
              onDelete()
            }}
            className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-left text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 size={18} strokeWidth={2} className="shrink-0" aria-hidden="true" />
            Delete recipe
          </button>
        </div>
        <div className="pb-[env(safe-area-inset-bottom)]" />
      </div>
    </div>,
    document.body
  )
}
