import '@testing-library/jest-dom'
import { beforeEach } from 'vitest'
// Install fake-indexeddb globally so all Dexie instances use it automatically.
// This must be imported before any module that opens a Dexie database.
import 'fake-indexeddb/auto'

// Provide a localStorage implementation for jsdom environments where it may
// be unavailable (e.g. opaque origins without a configured URL).
if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
  const store: Record<string, string> = {}
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = String(value) },
      removeItem: (key: string) => { delete store[key] },
      clear: () => { Object.keys(store).forEach(k => delete store[k]) },
      get length() { return Object.keys(store).length },
      key: (index: number) => Object.keys(store)[index] ?? null,
    },
    writable: true,
  })
}

// Clear the import rate-limit timestamps before each test so tests don't
// exhaust the per-hour quota and interfere with each other.
beforeEach(() => {
  try {
    localStorage.removeItem('mise_import_timestamps')
  } catch {
    // localStorage may be stubbed away in individual tests — that's fine.
  }
})
