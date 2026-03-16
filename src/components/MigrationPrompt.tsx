import { useEffect } from 'react'
import { CloudUpload, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react'
import { useMigration } from '../contexts/MigrationContext'

/**
 * Modal that appears once when an authenticated user has local recipes that
 * haven't been uploaded to cloud yet. Handles the full migration flow:
 * prompt → in_progress → done/error.
 */
export default function MigrationPrompt() {
  const { status, localRecipeCount, progress, migrate, skip } = useMigration()

  // Auto-dismiss after a short pause on success
  useEffect(() => {
    if (status !== 'done') return
    const t = setTimeout(skip, 2500)
    return () => clearTimeout(t)
  }, [status, skip])

  if (status === 'idle') return null

  const isDone = status === 'done'
  const isError = status === 'error'
  const isRunning = status === 'in_progress'
  const canDismiss = status === 'prompt' || isError

  const recipeWord = localRecipeCount === 1 ? 'recipe' : 'recipes'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {isDone ? (
              <CheckCircle className="text-green-600 dark:text-green-400 shrink-0" size={22} strokeWidth={1.75} />
            ) : isError ? (
              <AlertCircle className="text-red-500 dark:text-red-400 shrink-0" size={22} strokeWidth={1.75} />
            ) : (
              <CloudUpload className="text-green-600 dark:text-green-400 shrink-0" size={22} strokeWidth={1.75} />
            )}
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 leading-tight">
              {isDone && 'Recipes uploaded'}
              {isError && 'Upload failed'}
              {isRunning && 'Uploading recipes…'}
              {status === 'prompt' && 'Back up your recipes?'}
            </h2>
          </div>
          {canDismiss && (
            <button
              onClick={skip}
              aria-label="Dismiss"
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X size={18} strokeWidth={1.75} />
            </button>
          )}
        </div>

        {/* Body */}
        {status === 'prompt' && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            You have{' '}
            <span className="font-medium text-gray-800 dark:text-gray-200">
              {localRecipeCount} local {recipeWord}
            </span>{' '}
            saved on this device. Upload them to your account so they're available everywhere.
          </p>
        )}

        {isRunning && progress && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>
                {progress.done} / {progress.total} {recipeWord}
              </span>
              <span>{Math.round((progress.done / progress.total) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-300"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {isDone && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Your {localRecipeCount} {recipeWord} are now backed up to your account.
          </p>
        )}

        {isError && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Something went wrong during upload. Your local data is safe — you can try again or skip
            for now.
          </p>
        )}

        {/* Actions */}
        {status === 'prompt' && (
          <div className="flex gap-3">
            <button
              onClick={skip}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Skip
            </button>
            <button
              onClick={migrate}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
            >
              Upload
            </button>
          </div>
        )}

        {isRunning && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 size={15} className="animate-spin" />
            <span>Please don't close the app…</span>
          </div>
        )}

        {isError && (
          <div className="flex gap-3">
            <button
              onClick={skip}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Skip
            </button>
            <button
              onClick={migrate}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
