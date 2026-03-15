import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { startSync, stopSync, pullFromCloud } from '../lib/syncService'

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

  useEffect(() => {
    if (!user) {
      stopSync()
      syncedForUser.current = null
      return
    }

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

    return () => {
      stopSync()
    }
  }, [user?.id])

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
