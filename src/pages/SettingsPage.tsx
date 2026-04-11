import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import {
  SectionHeader,
  SettingsCard,
  SettingsRow,
  RowLabel,
  RowDescription,
  Toggle,
} from '../components/ui/SettingsComponents'
import { useTheme } from '../contexts/ThemeContext'
import { useUnitPreference } from '../hooks/useUnitPreference'
import { db } from '../lib/db'
import type {
  Recipe,
  MealPlan,
  ShoppingList,
  MealPlanTemplate,
  Collection,
  PantryItem,
} from '../types'
import { DIETARY_PREFERENCES, getDietaryPrefs, saveDietaryPrefs } from '../lib/dietary'
import PerformanceDashboard from '../components/PerformanceDashboard'

// ─── Import types ─────────────────────────────────────────────────────────────

interface BackupPayload {
  appVersion?: string
  exportedAt?: string
  recipes?: unknown[]
  mealPlans?: unknown[]
  shoppingLists?: unknown[]
  mealPlanTemplates?: unknown[]
  collections?: unknown[]
  pantryItems?: unknown[]
}

interface ImportPreview {
  appVersion: string
  exportedAt: string
  recipes: Recipe[]
  mealPlans: MealPlan[]
  shoppingLists: ShoppingList[]
  mealPlanTemplates: MealPlanTemplate[]
  collections: Collection[]
  pantryItems: PantryItem[]
}

interface ImportProgress {
  label: string
  pct: number
}

function requireId(items: unknown[], label: string) {
  const bad = (items as Record<string, unknown>[]).find(
    (r) => typeof r !== 'object' || r === null || typeof r['id'] !== 'string'
  )
  if (bad !== undefined) {
    throw new Error(`Invalid backup: some ${label} are missing a required "id" field.`)
  }
}

function parseBackup(raw: unknown): ImportPreview {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Invalid backup: expected a JSON object.')
  }
  const data = raw as BackupPayload

  // At least one collection must be present
  const hasData =
    Array.isArray(data.recipes) ||
    Array.isArray(data.mealPlans) ||
    Array.isArray(data.shoppingLists) ||
    Array.isArray(data.mealPlanTemplates) ||
    Array.isArray(data.collections) ||
    Array.isArray(data.pantryItems)
  if (!hasData) {
    throw new Error('Invalid backup: no recognisable data collections found.')
  }

  const recipes = (Array.isArray(data.recipes) ? data.recipes : []) as Recipe[]
  const mealPlans = (Array.isArray(data.mealPlans) ? data.mealPlans : []) as MealPlan[]
  const shoppingLists = (
    Array.isArray(data.shoppingLists) ? data.shoppingLists : []
  ) as ShoppingList[]
  const mealPlanTemplates = (
    Array.isArray(data.mealPlanTemplates) ? data.mealPlanTemplates : []
  ) as MealPlanTemplate[]
  const collections = (Array.isArray(data.collections) ? data.collections : []) as Collection[]
  const pantryItems = (Array.isArray(data.pantryItems) ? data.pantryItems : []) as PantryItem[]

  // Validate required fields per type
  requireId(recipes, 'recipes')
  requireId(mealPlans, 'meal plans')
  requireId(shoppingLists, 'shopping lists')
  requireId(mealPlanTemplates, 'templates')
  requireId(collections, 'collections')
  requireId(pantryItems, 'pantry items')

  // Detect schema mismatch (v1 recipes used `title` instead of `name`)
  const hasV1Recipe = recipes.some(
    (r) => !('name' in r) && 'title' in (r as Record<string, unknown>)
  )
  if (hasV1Recipe) {
    throw new Error(
      'This backup was created with an older version of Braisely and cannot be imported directly. Please export from the latest version first.'
    )
  }

  return {
    appVersion: data.appVersion ?? 'unknown',
    exportedAt: data.exportedAt ?? '',
    recipes,
    mealPlans,
    shoppingLists,
    mealPlanTemplates,
    collections,
    pantryItems,
  }
}

const BATCH = 50

async function importBatched<T>(
  table: { bulkPut(items: T[]): Promise<unknown> },
  items: T[],
  onProgress: (done: number) => void
) {
  for (let i = 0; i < items.length; i += BATCH) {
    await table.bulkPut(items.slice(i, i + BATCH))
    onProgress(Math.min(i + BATCH, items.length))
    // Yield to the event loop so the progress bar can paint
    await new Promise<void>((res) => setTimeout(res, 0))
  }
}

// ─── Notification preferences ─────────────────────────────────────────────────

const NOTIF_PREFS_KEY = 'notificationPrefs'
const DISPLAY_NAME_KEY = 'displayName'

interface NotificationPrefs {
  pushEnabled: boolean
  mealPlanReminders: boolean
}

function getNotifPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(NOTIF_PREFS_KEY)
    if (raw) return JSON.parse(raw) as NotificationPrefs
  } catch {
    // ignore JSON parse errors
  }
  return { pushEnabled: false, mealPlanReminders: false }
}

function saveNotifPrefs(prefs: NotificationPrefs): void {
  localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(prefs))
}

// ─── Storage estimate ─────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function useStorageEstimate() {
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null)
  useEffect(() => {
    if (!('storage' in navigator) || typeof navigator.storage.estimate !== 'function') return
    navigator.storage
      .estimate()
      .then((est) => {
        setEstimate({ usage: est.usage ?? 0, quota: est.quota ?? 0 })
      })
      .catch(() => {})
  }, [])
  return estimate
}

// ─── Theme options ────────────────────────────────────────────────────────────

const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
] as const

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [unitSystem, setUnitSystem] = useUnitPreference()
  const [clearStep, setClearStep] = useState<0 | 1 | 2>(0)
  const [clearing, setClearing] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge')
  const [importStep, setImportStep] = useState<
    'idle' | 'preview' | 'importing' | 'success' | 'error'
  >('idle')
  const [importError, setImportError] = useState<string | null>(null)
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null)

  // Notifications
  const [notifPrefs, setNotifPrefsState] = useState<NotificationPrefs>(() => getNotifPrefs())
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(
    () => {
      if (typeof Notification === 'undefined') return 'unsupported'
      return Notification.permission
    }
  )

  // Dietary preferences
  const [dietaryPrefs, setDietaryPrefsState] = useState<string[]>(() => getDietaryPrefs())

  function handleToggleDiet(id: string) {
    setDietaryPrefsState((prev) => {
      const next = prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
      saveDietaryPrefs(next)
      return next
    })
  }

  // Display name
  const [displayName, setDisplayName] = useState(() => localStorage.getItem(DISPLAY_NAME_KEY) ?? '')
  const [displayNameSaved, setDisplayNameSaved] = useState(false)

  // Storage
  const storageEstimate = useStorageEstimate()
  const storageUsedPct =
    storageEstimate && storageEstimate.quota > 0
      ? Math.min(100, (storageEstimate.usage / storageEstimate.quota) * 100)
      : null

  async function handleExport() {
    setExporting(true)
    try {
      const [recipes, mealPlans, shoppingLists, mealPlanTemplates, collections, pantryItems] =
        await Promise.all([
          db.recipes.toArray(),
          db.mealPlans.toArray(),
          db.shoppingLists.toArray(),
          db.mealPlanTemplates.toArray(),
          db.collections.toArray(),
          db.pantryItems.toArray(),
        ])
      const payload = {
        appVersion: '1.0.0',
        exportedAt: new Date().toISOString(),
        recipes,
        mealPlans,
        shoppingLists,
        mealPlanTemplates,
        collections,
        pantryItems,
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `braisely-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click()
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so the same file can be re-selected after an error
    e.target.value = ''

    try {
      const text = await file.text()
      const raw: unknown = JSON.parse(text)
      const preview = parseBackup(raw)
      setImportPreview(preview)
      setImportStep('preview')
      setImportError(null)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not read the backup file.')
      setImportStep('error')
    }
  }

  async function handleImportConfirm() {
    if (!importPreview) return
    setImportStep('importing')
    setImportProgress({ label: 'Preparing…', pct: 0 })
    try {
      const { recipes, mealPlans, shoppingLists, mealPlanTemplates, collections, pantryItems } =
        importPreview

      if (importMode === 'replace') {
        setImportProgress({ label: 'Clearing existing data…', pct: 5 })
        await Promise.all([
          db.recipes.clear(),
          db.mealPlans.clear(),
          db.shoppingLists.clear(),
          db.mealPlanTemplates.clear(),
          db.collections.clear(),
          db.pantryItems.clear(),
        ])
      }

      const progress =
        (label: string, base: number, range: number, items: unknown[]) => (done: number) => {
          const pct = base + Math.round((done / items.length) * range)
          setImportProgress({ label: `${label} (${done}/${items.length})…`, pct })
        }

      if (recipes.length > 0) {
        setImportProgress({ label: `Importing recipes (${recipes.length})…`, pct: 10 })
        await importBatched(db.recipes, recipes, progress('Importing recipes', 10, 30, recipes))
      }
      if (mealPlans.length > 0) {
        setImportProgress({ label: `Importing meal plans (${mealPlans.length})…`, pct: 40 })
        await importBatched(
          db.mealPlans,
          mealPlans,
          progress('Importing meal plans', 40, 15, mealPlans)
        )
      }
      if (shoppingLists.length > 0) {
        setImportProgress({ label: `Importing shopping lists (${shoppingLists.length})…`, pct: 55 })
        await importBatched(
          db.shoppingLists,
          shoppingLists,
          progress('Importing shopping lists', 55, 15, shoppingLists)
        )
      }
      if (mealPlanTemplates.length > 0) {
        setImportProgress({ label: `Importing templates (${mealPlanTemplates.length})…`, pct: 70 })
        await importBatched(
          db.mealPlanTemplates,
          mealPlanTemplates,
          progress('Importing templates', 70, 10, mealPlanTemplates)
        )
      }
      if (collections.length > 0) {
        setImportProgress({ label: `Importing collections (${collections.length})…`, pct: 80 })
        await importBatched(
          db.collections,
          collections,
          progress('Importing collections', 80, 10, collections)
        )
      }
      if (pantryItems.length > 0) {
        setImportProgress({ label: `Importing pantry items (${pantryItems.length})…`, pct: 90 })
        await importBatched(
          db.pantryItems,
          pantryItems,
          progress('Importing pantry items', 90, 8, pantryItems)
        )
      }

      setImportProgress({ label: 'Done', pct: 100 })
      setImportStep('success')
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'Import failed. The file may be corrupted.'
      )
      setImportStep('error')
    }
  }

  function handleImportDismiss() {
    setImportStep('idle')
    setImportPreview(null)
    setImportError(null)
    setImportProgress(null)
  }

  async function handleTogglePush(enabled: boolean) {
    if (enabled && notifPermission !== 'granted') {
      if (notifPermission === 'denied') return
      const permission = await Notification.requestPermission()
      setNotifPermission(permission)
      if (permission !== 'granted') return
    }
    const next: NotificationPrefs = {
      pushEnabled: enabled,
      mealPlanReminders: enabled ? notifPrefs.mealPlanReminders : false,
    }
    setNotifPrefsState(next)
    saveNotifPrefs(next)
  }

  function handleToggleMealReminders(enabled: boolean) {
    const next: NotificationPrefs = { ...notifPrefs, mealPlanReminders: enabled }
    setNotifPrefsState(next)
    saveNotifPrefs(next)
  }

  function handleSaveDisplayName(e: React.FormEvent) {
    e.preventDefault()
    localStorage.setItem(DISPLAY_NAME_KEY, displayName)
    setDisplayNameSaved(true)
    setTimeout(() => setDisplayNameSaved(false), 2000)
  }

  async function handleClearData() {
    if (clearStep === 0) {
      setClearStep(1)
      return
    }
    if (clearStep === 1) {
      setClearStep(2)
      return
    }
    // Step 2 — execute
    setClearing(true)
    try {
      await Promise.all([
        db.recipes.clear(),
        db.mealPlans.clear(),
        db.shoppingLists.clear(),
        db.mealPlanTemplates.clear(),
        db.collections.clear(),
        db.pantryItems.clear(),
      ])
      setClearStep(0)
    } finally {
      setClearing(false)
    }
  }

  const clearLabel =
    clearStep === 0
      ? 'Clear all data'
      : clearStep === 1
        ? 'Are you sure? Tap again to confirm'
        : clearing
          ? 'Clearing…'
          : 'This cannot be undone — tap to confirm'

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Settings</h1>

      {/* Appearance */}
      <section>
        <SectionHeader>Appearance</SectionHeader>
        <SettingsCard>
          <SettingsRow>
            <RowLabel>Theme</RowLabel>
            <div className="flex gap-2 mt-2">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    theme === opt.value
                      ? 'bg-green-700 text-white border-green-600'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </SettingsRow>
          <SettingsRow>
            <RowLabel>Units</RowLabel>
            <RowDescription>Ingredient measurements</RowDescription>
            <div className="flex gap-2 mt-2">
              {(
                [
                  { value: 'imperial', label: 'Imperial' },
                  { value: 'metric', label: 'Metric' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setUnitSystem(opt.value)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    unitSystem === opt.value
                      ? 'bg-green-700 text-white border-green-600'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </SettingsRow>
        </SettingsCard>
      </section>

      {/* Dietary Preferences */}
      <section>
        <SectionHeader>Dietary Preferences</SectionHeader>
        <SettingsCard>
          <SettingsRow>
            <RowLabel>Your dietary needs</RowLabel>
            <RowDescription>
              Recipes will be filtered and allergens highlighted based on your selections.
            </RowDescription>
            <div className="flex flex-wrap gap-2 mt-3">
              {DIETARY_PREFERENCES.map((pref) => {
                const selected = dietaryPrefs.includes(pref.id)
                return (
                  <button
                    key={pref.id}
                    type="button"
                    onClick={() => handleToggleDiet(pref.id)}
                    aria-pressed={selected}
                    title={pref.description}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
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
            {dietaryPrefs.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setDietaryPrefsState([])
                  saveDietaryPrefs([])
                }}
                className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 font-medium mt-2"
              >
                Clear all
              </button>
            )}
          </SettingsRow>
        </SettingsCard>
      </section>

      {/* Notifications */}
      <section>
        <SectionHeader>Notifications</SectionHeader>
        <SettingsCard>
          {notifPermission === 'denied' && (
            <SettingsRow>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  Notifications are blocked in your browser. Enable them in your browser settings to
                  use this feature.
                </p>
              </div>
            </SettingsRow>
          )}
          {notifPermission === 'unsupported' ? (
            <SettingsRow>
              <div className="flex items-center justify-between">
                <div>
                  <RowLabel>Push notifications</RowLabel>
                  <RowDescription>Not supported in this browser</RowDescription>
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md">
                  Unavailable
                </span>
              </div>
            </SettingsRow>
          ) : (
            <SettingsRow>
              <div className="flex items-center justify-between">
                <div>
                  <RowLabel>Push notifications</RowLabel>
                  <RowDescription>Allow Braisely to send you reminders</RowDescription>
                </div>
                <Toggle
                  checked={notifPrefs.pushEnabled}
                  onChange={handleTogglePush}
                  disabled={notifPermission === 'denied'}
                  aria-label="Toggle push notifications"
                />
              </div>
            </SettingsRow>
          )}
          <SettingsRow>
            <div className="flex items-center justify-between">
              <div>
                <RowLabel>Meal plan reminders</RowLabel>
                <RowDescription>Daily reminder to check your meal plan</RowDescription>
              </div>
              <Toggle
                checked={notifPrefs.mealPlanReminders}
                onChange={handleToggleMealReminders}
                disabled={!notifPrefs.pushEnabled}
                aria-label="Toggle meal plan reminders"
              />
            </div>
          </SettingsRow>
        </SettingsCard>
      </section>

      {/* Data Management */}
      <section>
        <SectionHeader>Data</SectionHeader>
        <SettingsCard>
          <SettingsRow>
            <RowLabel>Storage usage</RowLabel>
            {storageEstimate ? (
              <div className="mt-2 space-y-1.5">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-700 h-2 rounded-full transition-all"
                    style={{ width: `${storageUsedPct ?? 0}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {formatBytes(storageEstimate.usage)} used of {formatBytes(storageEstimate.quota)}
                </p>
              </div>
            ) : (
              <RowDescription>Calculating…</RowDescription>
            )}
          </SettingsRow>
          <SettingsRow>
            <RowLabel>Local storage</RowLabel>
            <RowDescription>
              All data is stored locally in your browser. No account required.
            </RowDescription>
          </SettingsRow>
          <SettingsRow>
            <div className="flex items-center justify-between">
              <div>
                <RowLabel>Export data</RowLabel>
                <RowDescription>Download all recipes and meal plans as JSON</RowDescription>
              </div>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="text-sm font-medium px-4 py-2 rounded-lg border border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-50"
              >
                {exporting ? 'Exporting…' : 'Export'}
              </button>
            </div>
          </SettingsRow>
          <SettingsRow>
            <div className="flex items-center justify-between">
              <div>
                <RowLabel>Import data</RowLabel>
                <RowDescription>Restore from a previously exported backup file</RowDescription>
              </div>
              <button
                onClick={handleImportClick}
                className="text-sm font-medium px-4 py-2 rounded-lg border border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
              >
                Import
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </SettingsRow>
          <SettingsRow>
            <RowLabel>Clear all data</RowLabel>
            <RowDescription>
              Permanently delete all recipes, meal plans, and shopping lists.
            </RowDescription>
            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={handleClearData}
                disabled={clearing}
                className={`text-sm font-medium px-4 py-2 rounded-lg border transition-colors disabled:opacity-50 ${
                  clearStep === 0
                    ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20'
                    : 'bg-red-600 text-white border-red-600 hover:bg-red-700'
                }`}
              >
                {clearLabel}
              </button>
              {clearStep > 0 && (
                <button
                  onClick={() => setClearStep(0)}
                  className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </SettingsRow>
        </SettingsCard>
      </section>

      {/* Account */}
      <section>
        <SectionHeader>Account</SectionHeader>
        <SettingsCard>
          <SettingsRow>
            <RowLabel>Display name</RowLabel>
            <RowDescription>Shown in exports and shared content</RowDescription>
            <form onSubmit={handleSaveDisplayName} className="flex gap-2 mt-3">
              <label htmlFor="display-name-input" className="sr-only">
                Display name
              </label>
              <input
                id="display-name-input"
                type="text"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value)
                  setDisplayNameSaved(false)
                }}
                placeholder="Your name"
                className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                autoComplete="name"
              />
              <button
                type="submit"
                className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-green-800 transition-colors"
              >
                {displayNameSaved ? 'Saved!' : 'Save'}
              </button>
            </form>
          </SettingsRow>
          <SettingsRow>
            <div className="flex items-center justify-between">
              <div>
                <RowLabel>Cloud sync</RowLabel>
                <RowDescription>Sync recipes across devices with a free account</RowDescription>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md">
                Coming soon
              </span>
            </div>
          </SettingsRow>
        </SettingsCard>
      </section>

      {/* About */}
      <section>
        <SectionHeader>About</SectionHeader>
        <SettingsCard>
          <SettingsRow>
            <div className="flex items-center justify-between">
              <RowLabel>Braisely</RowLabel>
              <span className="text-sm text-gray-400 dark:text-gray-500">v0.1.0</span>
            </div>
            <RowDescription>
              Cook, share, and enjoy — a social recipe platform for food lovers.
            </RowDescription>
          </SettingsRow>
          <SettingsRow>
            <RowLabel>Open source</RowLabel>
            <RowDescription>Built with React, Dexie.js, and Tailwind CSS.</RowDescription>
          </SettingsRow>
          <SettingsRow>
            <RowLabel>Performance</RowLabel>
            <PerformanceDashboard />
          </SettingsRow>
        </SettingsCard>
      </section>

      {/* Import modal */}
      {importStep !== 'idle' && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Import data"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl">
            {importStep === 'preview' && importPreview && (
              <>
                <div className="p-5 border-b border-gray-100 dark:border-gray-700">
                  <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">
                    Import backup
                  </h2>
                  {importPreview.exportedAt && (
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
                      Exported {new Date(importPreview.exportedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="p-5 space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-1.5">
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                      What will be imported
                    </p>
                    {[
                      { label: 'Recipes', count: importPreview.recipes.length },
                      { label: 'Meal plans', count: importPreview.mealPlans.length },
                      { label: 'Shopping lists', count: importPreview.shoppingLists.length },
                      { label: 'Templates', count: importPreview.mealPlanTemplates.length },
                      { label: 'Collections', count: importPreview.collections.length },
                      { label: 'Pantry items', count: importPreview.pantryItems.length },
                    ]
                      .filter(({ count }) => count > 0)
                      .map(({ label, count }) => (
                        <div key={label} className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-300">{label}</span>
                          <span className="font-medium text-gray-800 dark:text-gray-100">
                            {count}
                          </span>
                        </div>
                      ))}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      Import mode
                    </p>
                    {(
                      [
                        {
                          value: 'merge' as const,
                          label: 'Merge',
                          description:
                            'Add items from backup, keeping existing data. Items with the same ID will be overwritten.',
                        },
                        {
                          value: 'replace' as const,
                          label: 'Replace all',
                          description: 'Delete all existing data, then restore from backup.',
                        },
                      ] as const
                    ).map(({ value, label, description }) => (
                      <label
                        key={value}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                          importMode === value
                            ? 'border-green-600 bg-green-50 dark:bg-green-900/20'
                            : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="importMode"
                          value={value}
                          checked={importMode === value}
                          onChange={() => setImportMode(value)}
                          className="mt-0.5 accent-green-600"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                            {label}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {description}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="p-5 pt-0 flex gap-3">
                  <button
                    onClick={handleImportDismiss}
                    className="flex-1 py-2.5 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImportConfirm}
                    className={`flex-1 py-2.5 text-sm font-semibold rounded-xl text-white transition-colors ${
                      importMode === 'replace'
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-green-700 hover:bg-green-800'
                    }`}
                  >
                    {importMode === 'replace' ? 'Replace & Import' : 'Import'}
                  </button>
                </div>
              </>
            )}

            {importStep === 'importing' && (
              <div className="p-8 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                      Importing…
                    </p>
                    <span className="text-sm text-gray-400 dark:text-gray-500">
                      {importProgress?.pct ?? 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-700 h-2 rounded-full transition-all duration-200"
                      style={{ width: `${importProgress?.pct ?? 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                    {importProgress?.label ?? ''}
                  </p>
                </div>
              </div>
            )}

            {importStep === 'success' && (
              <div className="p-6 space-y-4">
                <div className="flex flex-col items-center gap-2 py-2">
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Check
                      size={24}
                      strokeWidth={2}
                      className="text-green-600"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="text-base font-semibold text-gray-800 dark:text-gray-100">
                    Import complete
                  </p>
                  {importPreview && (
                    <p className="text-sm text-gray-400 dark:text-gray-500 text-center">
                      {[
                        importPreview.recipes.length > 0 &&
                          `${importPreview.recipes.length} recipes`,
                        importPreview.mealPlans.length > 0 &&
                          `${importPreview.mealPlans.length} meal plans`,
                        importPreview.shoppingLists.length > 0 &&
                          `${importPreview.shoppingLists.length} shopping lists`,
                        importPreview.collections.length > 0 &&
                          `${importPreview.collections.length} collections`,
                        importPreview.pantryItems.length > 0 &&
                          `${importPreview.pantryItems.length} pantry items`,
                      ]
                        .filter(Boolean)
                        .join(', ')}{' '}
                      restored.
                    </p>
                  )}
                </div>
                <button
                  onClick={handleImportDismiss}
                  className="w-full py-2.5 text-sm font-semibold rounded-xl bg-green-700 text-white hover:bg-green-800 transition-colors"
                >
                  Done
                </button>
              </div>
            )}

            {importStep === 'error' && (
              <div className="p-6 space-y-4">
                <div className="flex flex-col items-center gap-2 py-2">
                  <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <X size={24} strokeWidth={2} className="text-red-600" aria-hidden="true" />
                  </div>
                  <p className="text-base font-semibold text-gray-800 dark:text-gray-100">
                    Import failed
                  </p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 text-center">
                    {importError}
                  </p>
                </div>
                <button
                  onClick={handleImportDismiss}
                  className="w-full py-2.5 text-sm font-semibold rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
