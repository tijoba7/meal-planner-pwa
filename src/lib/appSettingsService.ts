/**
 * App settings service — read and write admin-managed app-wide configuration.
 *
 * All reads/writes go through Supabase RLS:
 *   - Admins can read and write every key, including sensitive ones.
 *   - Regular authenticated users can only read non-sensitive keys.
 *   - Unauthenticated users cannot access the table at all.
 *
 * All functions are graceful no-ops when Supabase is not configured.
 */

import { supabase } from './supabase'
import type { AppSetting } from '../types/supabase'
import type { Json } from '../types/supabase'

// ─── Known setting keys ───────────────────────────────────────────────────────

export const APP_SETTING_KEYS = {
  SCRAPING_API_KEY: 'scraping.api_key',
  SCRAPING_PROVIDER: 'scraping.provider',
  SCRAPING_MODEL: 'scraping.model',
  SCRAPING_RATE_LIMIT: 'scraping.rate_limit',
  FEATURES_SOCIAL: 'features.social',
  FEATURES_GROUPS: 'features.groups',
  FEATURES_DISCOVER: 'features.discover',
  DEFAULTS_DIETARY: 'defaults.dietary_preferences',
  DEFAULTS_NOTIF_PUSH: 'defaults.notifications.push_enabled',
  DEFAULTS_NOTIF_REMINDERS: 'defaults.notifications.meal_plan_reminders',
} as const

export type AppSettingKey = (typeof APP_SETTING_KEYS)[keyof typeof APP_SETTING_KEYS]

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Get a single setting by key. Returns `null` if the key does not exist or is
 * not readable by the current user (sensitive + not admin).
 */
export async function getAppSetting(key: string): Promise<Json | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()

  if (error || !data) return null
  return (data as Pick<AppSetting, 'value'>).value
}

/**
 * Get a setting value typed as a string. Returns `null` when absent / wrong type.
 */
export async function getAppSettingString(key: string): Promise<string | null> {
  const value = await getAppSetting(key)
  return typeof value === 'string' ? value : null
}

/**
 * Get a setting value typed as a number. Returns `null` when absent / wrong type.
 */
export async function getAppSettingNumber(key: string): Promise<number | null> {
  const value = await getAppSetting(key)
  return typeof value === 'number' ? value : null
}

/**
 * Get a setting value typed as a boolean. Returns `null` when absent / wrong type.
 */
export async function getAppSettingBoolean(key: string): Promise<boolean | null> {
  const value = await getAppSetting(key)
  return typeof value === 'boolean' ? value : null
}

/**
 * List all settings readable by the current user (non-sensitive for regular
 * users; all keys for admins).
 */
export async function listAppSettings(): Promise<AppSetting[]> {
  if (!supabase) return []

  const { data } = await supabase
    .from('app_settings')
    .select('*')
    .order('key', { ascending: true })

  return (data as AppSetting[] | null) ?? []
}

// ─── Write (admin only) ───────────────────────────────────────────────────────

/**
 * Upsert a setting. Admin-only — RLS rejects calls from non-admin users.
 * Pass `updatedBy` to record which admin made the change.
 */
export async function setAppSetting(
  key: string,
  value: Json,
  updatedBy: string,
  sensitive?: boolean
): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error('Supabase not configured') }

  const patch: AppSetting = {
    key,
    value,
    sensitive: sensitive ?? false,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  }

  const { error } = await supabase
    .from('app_settings')
    .upsert(patch, { onConflict: 'key' })

  return { error: error ? new Error(error.message) : null }
}

/**
 * Delete a setting by key. Admin-only — RLS rejects non-admin callers.
 */
export async function deleteAppSetting(key: string): Promise<{ error: Error | null }> {
  if (!supabase) return { error: new Error('Supabase not configured') }

  const { error } = await supabase.from('app_settings').delete().eq('key', key)
  return { error: error ? new Error(error.message) : null }
}
