import '@testing-library/jest-dom'
// Install fake-indexeddb globally so all Dexie instances use it automatically.
// This must be imported before any module that opens a Dexie database.
import 'fake-indexeddb/auto'
