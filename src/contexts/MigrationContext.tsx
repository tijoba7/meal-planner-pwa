import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import {
  type MigrationStatus,
  type MigrationProgress,
  countLocalRecipes,
  migrateRecipesToCloud,
  skipMigration,
  getPersistedState,
} from '../lib/migrationService'
import { isSupabaseAvailable } from '../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MigrationContextValue {
  /** Current state of the migration flow. */
  status: MigrationStatus
  /** Number of local recipes that would be uploaded. */
  localRecipeCount: number
  /** Upload progress (set during in_progress). */
  progress: MigrationProgress | null
  /** Begin migrating local data to cloud. */
  migrate: () => Promise<void>
  /** Dismiss the prompt without migrating. */
  skip: () => void
}

// ─── Context ──────────────────────────────────────────────────────────────────

const MigrationContext = createContext<MigrationContextValue | null>(null)

export function MigrationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [status, setStatus] = useState<MigrationStatus>('idle')
  const [localRecipeCount, setLocalRecipeCount] = useState(0)
  const [progress, setProgress] = useState<MigrationProgress | null>(null)
  // Prevent double-evaluation if effect fires twice in StrictMode
  const checkedForRef = useRef<string | null>(null)

  useEffect(() => {
    if (!user || !isSupabaseAvailable()) {
      setStatus('idle')
      return
    }

    // Same user already evaluated this session
    if (checkedForRef.current === user.id) return
    checkedForRef.current = user.id

    // Already done or skipped for this user (persisted across sessions)
    const persisted = getPersistedState(user.id)
    if (persisted) {
      setStatus('idle')
      return
    }

    // Count local recipes to decide whether to prompt
    countLocalRecipes().then((count) => {
      setLocalRecipeCount(count)
      setStatus(count > 0 ? 'prompt' : 'idle')
    })
  }, [user])

  async function migrate() {
    if (!user) return

    setStatus('in_progress')
    setProgress({ done: 0, total: localRecipeCount })

    try {
      await migrateRecipesToCloud(user.id, (p) => setProgress(p))
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  function skip() {
    if (!user) return
    skipMigration(user.id)
    setStatus('idle')
  }

  return (
    <MigrationContext.Provider value={{ status, localRecipeCount, progress, migrate, skip }}>
      {children}
    </MigrationContext.Provider>
  )
}

export function useMigration() {
  const ctx = useContext(MigrationContext)
  if (!ctx) throw new Error('useMigration must be used within MigrationProvider')
  return ctx
}
