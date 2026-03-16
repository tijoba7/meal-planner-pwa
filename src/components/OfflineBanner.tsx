import { useState, useEffect } from 'react'
import { WifiOff } from 'lucide-react'

/**
 * Floating pill shown when the browser loses network connectivity.
 * Shows a "You're offline" indicator while offline.
 * Briefly shows "Back online" for 3 seconds when connectivity is restored.
 */
export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [showBackOnline, setShowBackOnline] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setShowBackOnline(true)
      setTimeout(() => setShowBackOnline(false), 3000)
    }
    const handleOffline = () => {
      setIsOnline(false)
      setShowBackOnline(false)
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline && !showBackOnline) return null

  return (
    <div
      className="fixed top-16 md:top-4 inset-x-0 flex justify-center z-40 px-4 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div
        className={`rounded-full px-4 py-2 flex items-center gap-2 text-sm font-medium shadow-lg pointer-events-auto transition-colors ${
          isOnline ? 'bg-green-600 text-white' : 'bg-gray-900 dark:bg-gray-700 text-white'
        }`}
      >
        {isOnline ? (
          <span>Back online</span>
        ) : (
          <>
            <WifiOff size={14} strokeWidth={2} aria-hidden="true" />
            <span>You're offline</span>
          </>
        )}
      </div>
    </div>
  )
}
