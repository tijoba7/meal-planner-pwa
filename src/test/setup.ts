import '@testing-library/jest-dom'
import { beforeEach } from 'vitest'
// Install fake-indexeddb globally so all Dexie instances use it automatically.
// This must be imported before any module that opens a Dexie database.
import 'fake-indexeddb/auto'

// Always provide a reliable localStorage implementation for tests.
// jsdom's built-in Storage can be non-functional depending on origin config,
// so we unconditionally install a simple in-memory shim.
const _lsStore: Record<string, string> = {}
const _localStorage = {
  getItem: (key: string) => _lsStore[key] ?? null,
  setItem: (key: string, value: string) => {
    _lsStore[key] = String(value)
  },
  removeItem: (key: string) => {
    delete _lsStore[key]
  },
  clear: () => {
    Object.keys(_lsStore).forEach((k) => delete _lsStore[k])
  },
  get length() {
    return Object.keys(_lsStore).length
  },
  key: (index: number) => Object.keys(_lsStore)[index] ?? null,
}
Object.defineProperty(globalThis, 'localStorage', {
  value: _localStorage,
  writable: true,
  configurable: true,
})

// Clear the import rate-limit timestamps before each test so tests don't
// exhaust the per-hour quota and interfere with each other.
beforeEach(() => {
  try {
    localStorage.removeItem('mise_import_timestamps')
  } catch {
    // localStorage may be stubbed away in individual tests — that's fine.
  }
})
