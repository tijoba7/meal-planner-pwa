import { createPortal } from 'react-dom'

interface DeleteConfirmDialogProps {
  visible: boolean
  recipeName: string
  isPending: boolean
  onCancel: () => void
  onConfirm: () => void
}

export default function DeleteConfirmDialog({
  visible,
  recipeName,
  isPending,
  onCancel,
  onConfirm,
}: DeleteConfirmDialogProps) {
  if (!visible) return null

  return createPortal(
    <div className="print:hidden fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-sm w-full shadow-xl animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-recipe-dialog-title"
      >
        <h4
          id="delete-recipe-dialog-title"
          className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2"
        >
          Delete recipe?
        </h4>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          "{recipeName}" will be permanently deleted. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 bg-red-500 text-white text-sm font-medium py-2 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
