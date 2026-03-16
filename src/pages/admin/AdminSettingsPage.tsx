import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { APP_SETTING_KEYS, listAppSettings, setAppSetting } from '../../lib/appSettingsService'
import { DIETARY_PREFERENCES } from '../../lib/dietary'
import { isSupabaseAvailable } from '../../lib/supabase'
import type { Json } from '../../types/supabase'

// ─── UI helpers ────────────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 px-1">
      {children}
    </h2>
  )
}

function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
      {children}
    </div>
  )
}

function SettingsRow({ children }: { children: React.ReactNode }) {
  return <div className="p-4">{children}</div>
}

function RowLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-0.5">{children}</p>
}

function RowDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-400 dark:text-gray-500">{children}</p>
}

function Toggle({
  checked,
  onChange,
  disabled,
  'aria-label': ariaLabel,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  'aria-label': string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? 'bg-green-700' : 'bg-gray-200 dark:bg-gray-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  const { user } = useAuth()
  const supabaseAvailable = isSupabaseAvailable()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  // Feature flags (default: all enabled)
  const [socialEnabled, setSocialEnabled] = useState(true)
  const [groupsEnabled, setGroupsEnabled] = useState(true)
  const [discoverEnabled, setDiscoverEnabled] = useState(true)

  // Notification defaults
  const [defaultPushEnabled, setDefaultPushEnabled] = useState(false)
  const [defaultMealReminders, setDefaultMealReminders] = useState(false)

  // Default dietary preferences for new users
  const [defaultDietary, setDefaultDietary] = useState<string[]>([])

  useEffect(() => {
    listAppSettings().then((settings) => {
      const map = new Map<string, Json>(settings.map((s) => [s.key, s.value]))

      if (map.has(APP_SETTING_KEYS.FEATURES_SOCIAL))
        setSocialEnabled(map.get(APP_SETTING_KEYS.FEATURES_SOCIAL) as boolean)
      if (map.has(APP_SETTING_KEYS.FEATURES_GROUPS))
        setGroupsEnabled(map.get(APP_SETTING_KEYS.FEATURES_GROUPS) as boolean)
      if (map.has(APP_SETTING_KEYS.FEATURES_DISCOVER))
        setDiscoverEnabled(map.get(APP_SETTING_KEYS.FEATURES_DISCOVER) as boolean)

      if (map.has(APP_SETTING_KEYS.DEFAULTS_NOTIF_PUSH))
        setDefaultPushEnabled(map.get(APP_SETTING_KEYS.DEFAULTS_NOTIF_PUSH) as boolean)
      if (map.has(APP_SETTING_KEYS.DEFAULTS_NOTIF_REMINDERS))
        setDefaultMealReminders(map.get(APP_SETTING_KEYS.DEFAULTS_NOTIF_REMINDERS) as boolean)

      const dietaryVal = map.get(APP_SETTING_KEYS.DEFAULTS_DIETARY)
      if (Array.isArray(dietaryVal)) setDefaultDietary(dietaryVal as string[])

      setLoading(false)
    })
  }, [])

  async function saveBool(key: string, value: boolean, setState: (v: boolean) => void) {
    setState(value)
    if (!user) return
    setSaving(key)
    await setAppSetting(key, value, user.id)
    setSaving(null)
  }

  async function handlePushToggle(v: boolean) {
    setDefaultPushEnabled(v)
    if (!v) setDefaultMealReminders(false)
    if (!user) return
    setSaving(APP_SETTING_KEYS.DEFAULTS_NOTIF_PUSH)
    await setAppSetting(APP_SETTING_KEYS.DEFAULTS_NOTIF_PUSH, v, user.id)
    if (!v) await setAppSetting(APP_SETTING_KEYS.DEFAULTS_NOTIF_REMINDERS, false, user.id)
    setSaving(null)
  }

  async function handleDietaryToggle(id: string) {
    const next = defaultDietary.includes(id)
      ? defaultDietary.filter((d) => d !== id)
      : [...defaultDietary, id]
    setDefaultDietary(next)
    if (!user) return
    setSaving(APP_SETTING_KEYS.DEFAULTS_DIETARY)
    await setAppSetting(APP_SETTING_KEYS.DEFAULTS_DIETARY, next, user.id)
    setSaving(null)
  }

  async function handleClearDietary() {
    setDefaultDietary([])
    if (!user) return
    setSaving(APP_SETTING_KEYS.DEFAULTS_DIETARY)
    await setAppSetting(APP_SETTING_KEYS.DEFAULTS_DIETARY, [], user.id)
    setSaving(null)
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-48">
        <p className="text-sm text-gray-400 dark:text-gray-500">Loading settings…</p>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">App Settings</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Global configuration applied app-wide.
        </p>
      </div>

      {!supabaseAvailable && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Supabase is not configured — changes will not be persisted.
          </p>
        </div>
      )}

      {/* Feature Flags */}
      <section>
        <SectionHeader>Feature Flags</SectionHeader>
        <SettingsCard>
          <SettingsRow>
            <div className="flex items-center justify-between">
              <div>
                <RowLabel>Social features</RowLabel>
                <RowDescription>Reactions, comments, and recipe sharing between users</RowDescription>
              </div>
              <Toggle
                checked={socialEnabled}
                onChange={(v) =>
                  saveBool(APP_SETTING_KEYS.FEATURES_SOCIAL, v, setSocialEnabled)
                }
                disabled={saving === APP_SETTING_KEYS.FEATURES_SOCIAL}
                aria-label="Toggle social features"
              />
            </div>
          </SettingsRow>
          <SettingsRow>
            <div className="flex items-center justify-between">
              <div>
                <RowLabel>Groups</RowLabel>
                <RowDescription>Collaborative group meal planning</RowDescription>
              </div>
              <Toggle
                checked={groupsEnabled}
                onChange={(v) =>
                  saveBool(APP_SETTING_KEYS.FEATURES_GROUPS, v, setGroupsEnabled)
                }
                disabled={saving === APP_SETTING_KEYS.FEATURES_GROUPS}
                aria-label="Toggle groups feature"
              />
            </div>
          </SettingsRow>
          <SettingsRow>
            <div className="flex items-center justify-between">
              <div>
                <RowLabel>Discover</RowLabel>
                <RowDescription>Public recipe discovery feed</RowDescription>
              </div>
              <Toggle
                checked={discoverEnabled}
                onChange={(v) =>
                  saveBool(APP_SETTING_KEYS.FEATURES_DISCOVER, v, setDiscoverEnabled)
                }
                disabled={saving === APP_SETTING_KEYS.FEATURES_DISCOVER}
                aria-label="Toggle discover feature"
              />
            </div>
          </SettingsRow>
        </SettingsCard>
      </section>

      {/* New User Defaults — Dietary */}
      <section>
        <SectionHeader>New User Defaults</SectionHeader>
        <SettingsCard>
          <SettingsRow>
            <RowLabel>Default dietary preferences</RowLabel>
            <RowDescription>
              Applied to new accounts on sign-up. Users can update their own preferences at any
              time.
            </RowDescription>
            <div className="flex flex-wrap gap-2 mt-3">
              {DIETARY_PREFERENCES.map((pref) => {
                const selected = defaultDietary.includes(pref.id)
                return (
                  <button
                    key={pref.id}
                    type="button"
                    onClick={() => handleDietaryToggle(pref.id)}
                    aria-pressed={selected}
                    title={pref.description}
                    disabled={saving === APP_SETTING_KEYS.DEFAULTS_DIETARY}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50 ${
                      selected
                        ? 'bg-green-700 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {pref.label}
                  </button>
                )
              })}
            </div>
            {defaultDietary.length > 0 && (
              <button
                type="button"
                disabled={saving === APP_SETTING_KEYS.DEFAULTS_DIETARY}
                onClick={handleClearDietary}
                className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 font-medium mt-2 disabled:opacity-50"
              >
                Clear all
              </button>
            )}
          </SettingsRow>
        </SettingsCard>
      </section>

      {/* Notification Defaults */}
      <section>
        <SectionHeader>Notification Defaults</SectionHeader>
        <SettingsCard>
          <SettingsRow>
            <div className="flex items-center justify-between">
              <div>
                <RowLabel>Push notifications</RowLabel>
                <RowDescription>Enable push notifications for new users by default</RowDescription>
              </div>
              <Toggle
                checked={defaultPushEnabled}
                onChange={handlePushToggle}
                disabled={saving === APP_SETTING_KEYS.DEFAULTS_NOTIF_PUSH}
                aria-label="Toggle default push notifications"
              />
            </div>
          </SettingsRow>
          <SettingsRow>
            <div className="flex items-center justify-between">
              <div>
                <RowLabel>Meal plan reminders</RowLabel>
                <RowDescription>
                  Enable daily meal plan reminders for new users by default
                </RowDescription>
              </div>
              <Toggle
                checked={defaultMealReminders}
                onChange={(v) =>
                  saveBool(APP_SETTING_KEYS.DEFAULTS_NOTIF_REMINDERS, v, setDefaultMealReminders)
                }
                disabled={
                  !defaultPushEnabled || saving === APP_SETTING_KEYS.DEFAULTS_NOTIF_REMINDERS
                }
                aria-label="Toggle default meal plan reminders"
              />
            </div>
          </SettingsRow>
        </SettingsCard>
      </section>
    </div>
  )
}
