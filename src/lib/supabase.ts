import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/supabase'

// ─── Supabase client ──────────────────────────────────────────────────────────
//
// Only initialised when env vars are present. Guards throughout the codebase
// must check `supabase !== null` before making any calls — this preserves full
// local-only functionality for users who never connect to Supabase.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null

/** True when the Supabase client is configured and available. */
export function isSupabaseAvailable(): boolean {
  return supabase !== null
}
