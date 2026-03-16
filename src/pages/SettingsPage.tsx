import { useRef, useState } from 'react'
import { getStoredApiKey, setStoredApiKey } from '../lib/scraper'
import { useTheme } from '../contexts/ThemeContext'
import { db } from '../lib/db'
import type { Recipe, MealPlan, ShoppingList, MealPlanTemplate } from '../types'

// ─── Import types ─────────────────────────────────────────────────────────────

interface BackupPayload {
  appVersion?: string
  exportedAt?: string
  recipes?: unknown[]
  mealPlans?: unknown[]
  shoppingLists?: unknown[]
  mealPlanTemplates?: unknown[]
}

interface ImportPreview {
  appVersion: string
  exportedAt: string
  recipes: Recipe[]
  mealPlans: MealPlan[]
  shoppingLists: ShoppingList[]
  mealPlanTemplates: MealPlanTemplate[]
  versionMismatch: boolean
}

function parseBackup(raw: unknown): ImportPreview {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Invalid backup: expected a JSON object.')
  }
  const data = raw as BackupPayload

  // At least one collection must be present
  const hasCollections =
    Array.isArray(data.recipes) ||
    Array.isArray(data.mealPlans) ||
    Array.isArray(data.shoppingLists) ||
    Array.isArray(data.mealPlanTemplates)
  if (!hasCollections) {
    throw new Error('Invalid backup: no recognisable data collections found.')
  }

  // Basic per-item validation for recipes
  const recipes = (Array.isArray(data.recipes) ? data.recipes : []) as Recipe[]
  const invalidRecipe = recipes.find((r) => typeof r !== 'object' || r === null || !('id' in r))
  if (invalidRecipe !== undefined) {
    throw new Error('Invalid backup: some recipes are missing required fields.')
  }

  // Detect schema mismatch (v1 recipes used `title` instead of `name`)
  const versionMismatch = recipes.some(
    (r) => !('name' in r) && 'title' in (r as Record<string, unknown>),
  )
  if (versionMismatch) {
    throw new Error(
      'This backup was created with an older version of Mise and cannot be imported directly. Please export from the latest version first.',
    )
  }

  return {
    appVersion: data.appVersion ?? 'unknown',
    exportedAt: data.exportedAt ?? '',
    recipes,
    mealPlans: (Array.isArray(data.mealPlans) ? data.mealPlans : []) as MealPlan[],
    shoppingLists: (Array.isArray(data.shoppingLists) ? data.shoppingLists : []) as ShoppingList[],
    mealPlanTemplates: (
      Array.isArray(data.mealPlanTemplates) ? data.mealPlanTemplates : []
    ) as MealPlanTemplate[],
    versionMismatch: false,
  }
}

const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
] as const

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

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState(() => getStoredApiKey())
  const [saved, setSaved] = useState(false)
  const { theme, setTheme } = useTheme()
  const [clearStep, setClearStep] = useState<0 | 1 | 2>(0)
  const [clearing, setClearing] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge')
  const [importStep, setImportStep] = useState<'idle' | 'preview' | 'importing' | 'success' | 'error'>('idle')
  const [importError, setImportError] = useState<string | null>(null)

  async function handleExport() {
    setExporting(true)
    try {
      const [recipes, mealPlans, shoppingLists, mealPlanTemplates] = await Promise.all([
        db.recipes.toArray(),
        db.mealPlans.toArray(),
        db.shoppingLists.toArray(),
        db.mealPlanTemplates.toArray(),
      ])
      const payload = {
        appVersion: '0.1.0',
        exportedAt: new Date().toISOString(),
        recipes,
        mealPlans,
        shoppingLists,
        mealPlanTemplates,
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mise-backup-${new Date().toISOString().slice(0, 10)}.json`
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
    try {
      if (importMode === 'replace') {
        await Promise.all([
          db.recipes.clear(),
          db.mealPlans.clear(),
          db.shoppingLists.clear(),
          db.mealPlanTemplates.clear(),
        ])
      }
      await db.transaction('rw', [db.recipes, db.mealPlans, db.shoppingLists, db.mealPlanTemplates], async () => {
        if (importPreview.recipes.length > 0) await db.recipes.bulkPut(importPreview.recipes)
        if (importPreview.mealPlans.length > 0) await db.mealPlans.bulkPut(importPreview.mealPlans)
        if (importPreview.shoppingLists.length > 0) await db.shoppingLists.bulkPut(importPreview.shoppingLists)
        if (importPreview.mealPlanTemplates.length > 0) await db.mealPlanTemplates.bulkPut(importPreview.mealPlanTemplates)
      })
      setImportStep('success')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed. The file may be corrupted.')
      setImportStep('error')
    }
  }

  function handleImportDismiss() {
    setImportStep('idle')
    setImportPreview(null)
    setImportError(null)
  }

  function handleSaveKey(e: React.FormEvent) {
    e.preventDefault()
    setStoredApiKey(apiKey)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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
      await db.recipes.clear()
      await db.mealPlans.clear()
      await db.shoppingLists.clear()
      await db.mealPlanTemplates.clear()
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
                      ? 'bg-green-600 text-white border-green-600'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </SettingsRow>
          <SettingsRow>
            <div className="flex items-center justify-between">
              <div>
                <RowLabel>Units</RowLabel>
                <RowDescription>Ingredient measurements</RowDescription>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md">
                Coming soon
              </span>
            </div>
          </SettingsRow>
        </SettingsCard>
      </section>

      {/* Data Management */}
      <section>
        <SectionHeader>Data Management</SectionHeader>
        <SettingsCard>
          <SettingsRow>
            <RowLabel>Local storage</RowLabel>
            <RowDescription>All data is stored locally in your browser. No account required.</RowDescription>
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
            <RowDescription>Permanently delete all recipes, meal plans, and shopping lists.</RowDescription>
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

      {/* API Keys */}
      <section>
        <SectionHeader>API Keys</SectionHeader>
        <SettingsCard>
          <SettingsRow>
            <RowLabel>AI Recipe Import</RowLabel>
            <RowDescription>
              Used to extract recipes from URLs (Instagram, Pinterest, TikTok, recipe sites). Your key is stored
              locally and never sent anywhere except Anthropic's API.
            </RowDescription>
            <form onSubmit={handleSaveKey} className="flex gap-2 mt-3">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  setSaved(false)
                }}
                placeholder="sk-ant-…"
                className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 font-mono"
                autoComplete="off"
              />
              <button
                type="submit"
                className="bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                {saved ? 'Saved!' : 'Save'}
              </button>
            </form>
          </SettingsRow>
        </SettingsCard>
      </section>

      {/* Account (future) */}
      <section>
        <SectionHeader>Account</SectionHeader>
        <SettingsCard>
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
              <RowLabel>Mise</RowLabel>
              <span className="text-sm text-gray-400 dark:text-gray-500">v0.1.0</span>
            </div>
            <RowDescription>Everything in its place — a local-first meal planner and recipe store.</RowDescription>
          </SettingsRow>
          <SettingsRow>
            <RowLabel>Open source</RowLabel>
            <RowDescription>Built with React, Dexie.js, and Tailwind CSS.</RowDescription>
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
                  <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Import backup</h2>
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
                    ].map(({ label, count }) => (
                      <div key={label} className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-300">{label}</span>
                        <span className="font-medium text-gray-800 dark:text-gray-100">{count}</span>
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
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{label}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{description}</p>
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
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {importMode === 'replace' ? 'Replace & Import' : 'Import'}
                  </button>
                </div>
              </>
            )}

            {importStep === 'importing' && (
              <div className="p-8 flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Importing…</p>
              </div>
            )}

            {importStep === 'success' && (
              <div className="p-6 space-y-4">
                <div className="flex flex-col items-center gap-2 py-2">
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-green-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-base font-semibold text-gray-800 dark:text-gray-100">Import complete</p>
                  {importPreview && (
                    <p className="text-sm text-gray-400 dark:text-gray-500 text-center">
                      {importPreview.recipes.length} recipes,{' '}
                      {importPreview.mealPlans.length} meal plans, and{' '}
                      {importPreview.shoppingLists.length} shopping lists restored.
                    </p>
                  )}
                </div>
                <button
                  onClick={handleImportDismiss}
                  className="w-full py-2.5 text-sm font-semibold rounded-xl bg-green-600 text-white hover:bg-green-700 transition-colors"
                >
                  Done
                </button>
              </div>
            )}

            {importStep === 'error' && (
              <div className="p-6 space-y-4">
                <div className="flex flex-col items-center gap-2 py-2">
                  <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-red-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-base font-semibold text-gray-800 dark:text-gray-100">Import failed</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 text-center">{importError}</p>
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
