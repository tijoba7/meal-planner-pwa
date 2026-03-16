import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { startSync, stopSync, pullFromCloud } from '../lib/syncService'

/** Pull from cloud every 5 minutes while the tab is open. */
const BACKGROUND_SYNC_INTERVAL_MS = 5 * 60 * 1000

interface SyncContextValue {
  /** True while the initial pull from cloud is running after sign-in. */
  isSyncing: boolean
  /** Timestamp of the last successful pull, or null before the first sync. */
  lastSynced: Date | null
  /** Non-null when the last sync attempt failed. */
  syncError: string | null
}

const SyncContext = createContext<SyncContextValue | null>(null)

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState<Date | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  // Prevent duplicate sync if React double-invokes the effect in dev
  const syncedForUser = useRef<string | null>(null)
  const userIdRef = useRef<string | null>(null)

  /** Run a background pull (no loading spinner) and update lastSynced on success. */
  const backgroundPull = useCallback(async (userId: string) => {
    try {
      await pullFromCloud(userId)
      setLastSynced(new Date())
    } catch {
      // Background pull failures are silent — don't overwrite the last known error
    }
  }, [])

  useEffect(() => {
    if (!user) {
      stopSync()
      syncedForUser.current = null
      userIdRef.current = null
      return
    }

    userIdRef.current = user.id

    if (syncedForUser.current === user.id) return
    syncedForUser.current = user.id

    setIsSyncing(true)
    setSyncError(null)

    startSync(user.id)
      .then(() => pullFromCloud(user.id))
      .then(() => setLastSynced(new Date()))
      .catch((err: unknown) => {
        setSyncError(err instanceof Error ? err.message : 'Sync failed')
      })
      .finally(() => setIsSyncing(false))

    // Sync on tab focus (visibilitychange → visible)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && userIdRef.current) {
        void backgroundPull(userIdRef.current)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // Periodic background sync every BACKGROUND_SYNC_INTERVAL_MS
    const intervalId = setInterval(() => {
      if (userIdRef.current) void backgroundPull(userIdRef.current)
    }, BACKGROUND_SYNC_INTERVAL_MS)

    // Register Background Sync API tag when going offline so the browser can
    // wake the service worker and trigger a pull when connectivity is restored —
    // even if the tab is not visible at that moment.
    const handleOnline = () => {
      if (userIdRef.current) void backgroundPull(userIdRef.current)
    }
    const handleOffline = () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready
          .then((reg) => (reg as unknown as { sync: { register(tag: string): Promise<void> } }).sync.register('mise-pull'))
          .catch(() => {
            // BackgroundSync not supported — rely on window.online fallback
          })
      }
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Listen for BACKGROUND_SYNC messages from the service worker (fired when
    // the SW handles a sync event while the app is in the background).
    const handleSwMessage = (event: MessageEvent<{ type: string }>) => {
      if (event.data?.type === 'BACKGROUND_SYNC' && userIdRef.current) {
        void backgroundPull(userIdRef.current)
      }
    }
    navigator.serviceWorker?.addEventListener('message', handleSwMessage)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      clearInterval(intervalId)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      navigator.serviceWorker?.removeEventListener('message', handleSwMessage)
      stopSync()
    }
  }, [user?.id, backgroundPull])

  return (
    <SyncContext.Provider value={{ isSyncing, lastSynced, syncError }}>
      {children}
    </SyncContext.Provider>
  )
}

export function useSync() {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSync must be used within SyncProvider')
  return ctx
}
