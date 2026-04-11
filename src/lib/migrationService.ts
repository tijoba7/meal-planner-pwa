import { db } from './db'
import { supabase } from './supabase'
import { toJson } from './jsonUtils'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MigrationStatus = 'idle' | 'prompt' | 'in_progress' | 'done' | 'skipped' | 'error'

export interface MigrationProgress {
  done: number
  total: number
}

interface PersistedState {
  status: 'done' | 'skipped'
  completedAt: string
}

// ─── Persistence ──────────────────────────────────────────────────────────────

const KEY_PREFIX = 'braisely:migration:'

function storageKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`
}

export function getPersistedState(userId: string): PersistedState | null {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    return raw ? (JSON.parse(raw) as PersistedState) : null
  } catch {
    return null
  }
}

function persistState(userId: string, state: PersistedState): void {
  localStorage.setItem(storageKey(userId), JSON.stringify(state))
}

// ─── Core logic ───────────────────────────────────────────────────────────────

/** Count local recipes available for migration. */
export async function countLocalRecipes(): Promise<number> {
  return db.recipes.count()
}

/**
 * Upload local recipes to Supabase.
 *
 * Conflict strategy: compare dateModified (local) vs updated_at (cloud).
 * If local is strictly newer, update cloud. Otherwise skip (cloud wins).
 * Uses the same UUID for local and cloud so IDs stay stable across devices.
 */
export async function migrateRecipesToCloud(
  userId: string,
  onProgress: (progress: MigrationProgress) => void
): Promise<void> {

  const localRecipes = await db.recipes.toArray()
  const total = localRecipes.length

  if (total === 0) {
    persistState(userId, { status: 'done', completedAt: new Date().toISOString() })
    return
  }

  // Fetch existing cloud recipes for this user (id + updated_at only)
  const { data: cloudRows, error: fetchError } = await supabase
    .from('recipes_cloud')
    .select('id, updated_at')
    .eq('author_id', userId)

  if (fetchError) throw new Error(`Failed to fetch cloud recipes: ${fetchError.message}`)

  const cloudMap = new Map((cloudRows ?? []).map((r) => [r.id, r.updated_at]))

  let done = 0
  onProgress({ done, total })

  for (const recipe of localRecipes) {
    const cloudUpdatedAt = cloudMap.get(recipe.id)

    if (cloudUpdatedAt) {
      // Conflict: recipe exists on both sides — local wins only if strictly newer
      const localMs = new Date(recipe.dateModified).getTime()
      const cloudMs = new Date(cloudUpdatedAt).getTime()

      if (localMs > cloudMs) {
        const { error } = await supabase
          .from('recipes_cloud')
          .update({ data: toJson(recipe), updated_at: new Date().toISOString() })
          .eq('id', recipe.id)

        if (error) throw new Error(`Failed to update recipe "${recipe.name}": ${error.message}`)
      }
      // cloud is same age or newer — skip
    } else {
      // No cloud copy — insert with the same UUID
      const { error } = await supabase.from('recipes_cloud').insert({
        id: recipe.id,
        author_id: userId,
        data: toJson(recipe),
        visibility: 'private',
      })

      if (error) throw new Error(`Failed to upload recipe "${recipe.name}": ${error.message}`)
    }

    done++
    onProgress({ done, total })
  }

  persistState(userId, { status: 'done', completedAt: new Date().toISOString() })
}

/** Record that the user chose to skip migration. */
export function skipMigration(userId: string): void {
  persistState(userId, { status: 'skipped', completedAt: new Date().toISOString() })
}
