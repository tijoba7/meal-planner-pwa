import { createContext, useContext, useEffect, useState, createElement, type ReactNode } from 'react'
import { getAppSettingBoolean, APP_SETTING_KEYS } from '../lib/appSettingsService'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FeatureFlags {
  social: boolean
  groups: boolean
  discover: boolean
}

// ─── Defaults ─────────────────────────────────────────────────────────────────
// All features default to enabled — graceful degradation when settings can't
// be loaded (e.g. Supabase not configured, network error, unauthenticated).

const DEFAULT_FLAGS: FeatureFlags = { social: true, groups: true, discover: true }

// ─── Context ──────────────────────────────────────────────────────────────────

const FeatureFlagsContext = createContext<FeatureFlags>(DEFAULT_FLAGS)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS)

  useEffect(() => {
    Promise.all([
      getAppSettingBoolean(APP_SETTING_KEYS.FEATURES_SOCIAL),
      getAppSettingBoolean(APP_SETTING_KEYS.FEATURES_GROUPS),
      getAppSettingBoolean(APP_SETTING_KEYS.FEATURES_DISCOVER),
    ])
      .then(([social, groups, discover]) => {
        setFlags({
          social: social ?? true,
          groups: groups ?? true,
          discover: discover ?? true,
        })
      })
      .catch(() => {
        // Keep defaults — all features enabled
      })
  }, [])

  return createElement(FeatureFlagsContext.Provider, { value: flags }, children)
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFeatureFlags(): FeatureFlags {
  return useContext(FeatureFlagsContext)
}
