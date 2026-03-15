import { useState } from 'react'
import { getStoredApiKey, setStoredApiKey } from '../lib/scraper'
import { useTheme } from '../contexts/ThemeContext'

const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
] as const

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState(() => getStoredApiKey())
  const [saved, setSaved] = useState(false)
  const { theme, setTheme } = useTheme()

  function handleSaveKey(e: React.FormEvent) {
    e.preventDefault()
    setStoredApiKey(apiKey)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Settings</h2>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
        {/* Appearance */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Appearance</h3>
          <div className="flex gap-2">
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
        </div>

        {/* AI API Key */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">AI Recipe Import</h3>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">
            Used to extract recipes from URLs (Instagram, Pinterest, TikTok, recipe sites). Your
            key is stored locally and never sent anywhere except Anthropic's API.
          </p>
          <form onSubmit={handleSaveKey} className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setSaved(false) }}
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
        </div>

        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Data</h3>
          <p className="text-sm text-gray-400 dark:text-gray-500">All data is stored locally in your browser. No account required.</p>
        </div>
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Export</h3>
          <p className="text-sm text-gray-400 dark:text-gray-500">Data export coming soon.</p>
        </div>
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">About</h3>
          <p className="text-sm text-gray-400 dark:text-gray-500">Mise — Everything in its place. A local-first meal planner and recipe store.</p>
        </div>
      </div>
    </div>
  )
}
