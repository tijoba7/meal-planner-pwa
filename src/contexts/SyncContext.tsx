import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { liveQuery } from 'dexie'
import { db } from '../lib/db'
import { flushMutationQueue } from '../lib/mutationQueue'
import { queryClient } from '../lib/queryClient'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'

interface SyncContextValue {
  /** True when the browser has network connectivity. */
  isOnline: boolean
  /** Number of mutations waiting to be synced to the cloud. */
  pendingCount: number
  /** Manually trigger a sync flush (e.g. after user taps "Sync now"). */
  flushNow: () => Promise<void>
}

const SyncContext = createContext<SyncContextValue | null>(null)

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const toast = useToast()
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)

  // Reactively track pending mutation count via Dexie liveQuery
  useEffect(() => {
    if (!user) {
      setPendingCount(0)
      return
    }
    const subscription = liveQuery(() =>
      db.pendingMutations.where('userId').equals(user.id).count()
    ).subscribe({
      next: setPendingCount,
      error: () => setPendingCount(0),
    })
    return () => subscription.unsubscribe()
  }, [user])

  const flush = useCallback(async () => {
    if (!user || !navigator.onLine) return
    const { synced, failed } = await flushMutationQueue(user.id)

    if (synced.length > 0) {
      // Invalidate queries for all synced entities so UI refreshes from cloud
      const invalidated = new Set<string>()
      for (const m of synced) {
        if (m.entityType === 'shoppingList') {
          if (!invalidated.has('shopping-lists')) {
            queryClient.invalidateQueries({ queryKey: ['shopping-lists', user.id] })
            invalidated.add('shopping-lists')
          }
          queryClient.invalidateQueries({ queryKey: ['shopping-list', m.entityId] })
        } else if (m.entityType === 'mealPlan') {
          if (!invalidated.has('meal-plans')) {
            queryClient.invalidateQueries({ queryKey: ['meal-plans', user.id] })
            invalidated.add('meal-plans')
          }
          queryClient.invalidateQueries({ queryKey: ['meal-plan', m.entityId] })
        }
      }
      toast.success(`${synced.length} change${synced.length === 1 ? '' : 's'} synced`)
    }

    if (failed.length > 0) {
      toast.error(`${failed.length} change${failed.length === 1 ? '' : 's'} failed to sync`)
    }
  }, [user, toast])

  // Auto-flush when connectivity is restored
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      flush()
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [flush])

  // Listen for SW background sync messages
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'BACKGROUND_SYNC') flush()
    }
    navigator.serviceWorker.addEventListener('message', handleMessage)
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage)
  }, [flush])

  return (
    <SyncContext.Provider value={{ isOnline, pendingCount, flushNow: flush }}>
      {children}
    </SyncContext.Provider>
  )
}

export function useSync() {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSync must be used within SyncProvider')
  return ctx
}
