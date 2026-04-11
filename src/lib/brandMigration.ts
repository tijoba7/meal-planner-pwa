/**
 * One-time migration of localStorage keys from "mise" to "braisely".
 * Runs at app startup. Idempotent — skips keys that already exist under the new name.
 */

const MIGRATION_DONE_KEY = 'braisely:brand-migration-done'

const KEY_RENAMES: [string, string][] = [
  ['mise_onboarding_done', 'braisely_onboarding_done'],
  ['mise-recipe-sort', 'braisely-recipe-sort'],
  ['mise-dietary-prefs', 'braisely-dietary-prefs'],
]

// Prefix-based keys (mise:migration:{userId}) need pattern matching
const OLD_PREFIX = 'mise:migration:'
const NEW_PREFIX = 'braisely:migration:'

export function migrateBrandKeys(): void {
  if (localStorage.getItem(MIGRATION_DONE_KEY)) return

  // Rename exact keys
  for (const [oldKey, newKey] of KEY_RENAMES) {
    const value = localStorage.getItem(oldKey)
    if (value != null && localStorage.getItem(newKey) == null) {
      localStorage.setItem(newKey, value)
      localStorage.removeItem(oldKey)
    }
  }

  // Rename prefixed keys (mise:migration:* → braisely:migration:*)
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(OLD_PREFIX)) {
      const suffix = key.slice(OLD_PREFIX.length)
      const newKey = `${NEW_PREFIX}${suffix}`
      const value = localStorage.getItem(key)
      if (value != null && localStorage.getItem(newKey) == null) {
        localStorage.setItem(newKey, value)
        localStorage.removeItem(key)
        i-- // adjust index after removal
      }
    }
  }

  localStorage.setItem(MIGRATION_DONE_KEY, '1')
}
