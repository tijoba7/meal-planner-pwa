import { useState } from 'react'
import { getStoredApiKey, setStoredApiKey } from '../lib/scraper'
import { useTheme } from '../contexts/ThemeContext'
import { db } from '../lib/db'

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
                <RowDescription>Restore from a previously exported file</RowDescription>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md">
                Coming soon
              </span>
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
    </div>
  )
}
