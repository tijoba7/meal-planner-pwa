import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Non-intrusive toast banner shown when a new service worker version is ready.
 * Sits at z-30 — below CookingMode (z-50), so it won't interrupt active cooking sessions.
 * Users see it naturally when they return from cooking mode.
 */
export default function AppUpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  const [dismissed, setDismissed] = useState(false)

  if (!needRefresh || dismissed) return null

  return (
    <div className="fixed bottom-20 md:bottom-4 inset-x-0 flex justify-center z-30 px-4 pointer-events-none">
      <div className="bg-gray-900 dark:bg-gray-800 text-white rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 max-w-sm w-full pointer-events-auto">
        <p className="flex-1 text-sm">A new version of mise is ready.</p>
        <button
          onClick={() => setDismissed(true)}
          className="text-xs text-gray-400 hover:text-gray-200 transition-colors shrink-0"
        >
          Later
        </button>
        <button
          onClick={() => updateServiceWorker(true)}
          className="text-xs font-medium bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg transition-colors shrink-0"
        >
          Update now
        </button>
      </div>
    </div>
  )
}
