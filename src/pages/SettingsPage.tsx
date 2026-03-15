import { useState } from 'react'
import { getStoredApiKey, setStoredApiKey } from '../lib/scraper'

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState(() => getStoredApiKey())
  const [saved, setSaved] = useState(false)

  function handleSaveKey(e: React.FormEvent) {
    e.preventDefault()
    setStoredApiKey(apiKey)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Settings</h2>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {/* AI API Key */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">AI Recipe Import</h3>
          <p className="text-sm text-gray-400 mb-3">
            Used to extract recipes from URLs (Instagram, Pinterest, TikTok, recipe sites). Your
            key is stored locally and never sent anywhere except Anthropic's API.
          </p>
          <form onSubmit={handleSaveKey} className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setSaved(false) }}
              placeholder="sk-ant-…"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 font-mono"
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
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Data</h3>
          <p className="text-sm text-gray-400">All data is stored locally in your browser. No account required.</p>
        </div>
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Export</h3>
          <p className="text-sm text-gray-400">Data export coming soon.</p>
        </div>
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">About</h3>
          <p className="text-sm text-gray-400">Mise — Everything in its place. A local-first meal planner and recipe store.</p>
        </div>
      </div>
    </div>
  )
}
