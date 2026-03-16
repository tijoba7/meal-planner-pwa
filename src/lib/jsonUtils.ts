import type { Json } from '../types/supabase'

/**
 * Serialize an app-level object for storage in a Supabase JSONB column.
 *
 * Supabase types JSONB columns as `Json` (a deeply recursive union), but our
 * serializable app types are structurally JSON-compatible at runtime.
 * TypeScript cannot verify deep recursive JSON assignability for complex
 * interfaces, so this single helper contains the necessary type assertion
 * rather than scattering `as unknown as Json` casts across the codebase.
 */
export function toJson<T extends object>(value: T): Json {
  // Intentional: app types are JSON-serializable; TS cannot verify deep assignability.
  return value as unknown as Json
}

/**
 * Deserialize a typed app object from a Supabase JSONB column.
 *
 * The shape is guaranteed by the application's write path — only use this
 * for JSONB columns where the stored data is known to match type `T`.
 */
export function fromJson<T>(value: Json): T {
  // Intentional: value was written by our own write path and matches type T.
  return value as unknown as T
}
