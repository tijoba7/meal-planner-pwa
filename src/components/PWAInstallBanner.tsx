import { X } from 'lucide-react'
import { usePWAInstall } from '../hooks/usePWAInstall'

/**
 * Non-intrusive install prompt shown after a user's second visit when the
 * browser signals the app is installable. Dismissed state is persisted in
 * localStorage so the banner never nags after being closed.
 *
 * Positioned above the mobile bottom tab bar (bottom-20) and near the
 * viewport edge on desktop (bottom-4). z-30 matches AppUpdateBanner.
 */
export default function PWAInstallBanner() {
  const { canShow, install, dismiss } = usePWAInstall()

  if (!canShow) return null

  return (
    <div className="fixed bottom-20 md:bottom-4 inset-x-0 flex justify-center z-30 px-4 pointer-events-none">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 max-w-sm w-full pointer-events-auto">
        <img src="/favicon.svg" alt="Braisely" className="w-10 h-10 rounded-xl shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100 leading-tight">
            Add Braisely to your home screen
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Works offline · Quick access · No app store
          </p>
        </div>
        <button
          onClick={() => void install()}
          className="text-xs font-medium bg-green-700 hover:bg-green-800 text-white px-3 py-1.5 rounded-lg transition-colors shrink-0"
        >
          Install
        </button>
        <button
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  )
}
