import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  APP_SETTING_KEYS,
  getAppSettingString,
  getAppSettingNumber,
  setAppSetting,
} from '../../lib/appSettingsService'
import {
  SectionHeader,
  SettingsCard,
  SettingsRow,
  RowLabel,
  RowDescription,
} from '../../components/ui/SettingsComponents'

// ─── Constants ────────────────────────────────────────────────────────────────

const PROVIDER_OPTIONS = [{ value: 'anthropic', label: 'Anthropic Claude' }] as const

const MODEL_OPTIONS = [
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (fast, cost-effective)' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (balanced)' },
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6 (most capable)' },
] as const

const DEFAULT_RATE_LIMIT = 10

// ─── API key test ─────────────────────────────────────────────────────────────

async function testApiKey(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    })
    if (res.ok) return { ok: true }
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    const msg = body.error?.message ?? `HTTP ${res.status}`
    return { ok: false, error: msg }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function AdminScrapingPage() {
  const { user } = useAuth()
  const updatedBy = user?.id ?? 'admin'

  // Provider & model
  const [provider, setProvider] = useState('anthropic')
  const [model, setModel] = useState('claude-haiku-4-5-20251001')
  const [providerStatus, setProviderStatus] = useState<SaveStatus>('idle')
  const [providerError, setProviderError] = useState<string | null>(null)

  // API key
  const [apiKey, setApiKeyValue] = useState('')
  const [apiKeyStatus, setApiKeyStatus] = useState<'idle' | 'testing' | 'saved' | 'error'>('idle')
  const [apiKeyError, setApiKeyError] = useState<string | null>(null)
  const [hasExistingKey, setHasExistingKey] = useState(false)

  // Rate limit
  const [rateLimit, setRateLimit] = useState(DEFAULT_RATE_LIMIT)
  const [rateLimitStatus, setRateLimitStatus] = useState<SaveStatus>('idle')
  const [rateLimitError, setRateLimitError] = useState<string | null>(null)

  // Load current settings on mount
  useEffect(() => {
    async function load() {
      const [storedProvider, storedModel, storedRateLimit, storedApiKey] = await Promise.all([
        getAppSettingString(APP_SETTING_KEYS.SCRAPING_PROVIDER),
        getAppSettingString(APP_SETTING_KEYS.SCRAPING_MODEL),
        getAppSettingNumber(APP_SETTING_KEYS.SCRAPING_RATE_LIMIT),
        // We check if a key exists (non-null) without displaying it
        getAppSettingString(APP_SETTING_KEYS.SCRAPING_API_KEY),
      ])
      if (storedProvider) setProvider(storedProvider)
      if (storedModel) setModel(storedModel)
      if (storedRateLimit !== null) setRateLimit(storedRateLimit)
      setHasExistingKey(storedApiKey !== null && storedApiKey.length > 0)
    }
    load()
  }, [])

  // ─── Save handlers ─────────────────────────────────────────────────────────

  async function handleSaveProvider(e: React.FormEvent) {
    e.preventDefault()
    setProviderStatus('saving')
    setProviderError(null)

    const [r1, r2] = await Promise.all([
      setAppSetting(APP_SETTING_KEYS.SCRAPING_PROVIDER, provider, updatedBy),
      setAppSetting(APP_SETTING_KEYS.SCRAPING_MODEL, model, updatedBy),
    ])
    const err = r1.error ?? r2.error
    if (err) {
      setProviderStatus('error')
      setProviderError(err.message)
    } else {
      setProviderStatus('saved')
      setTimeout(() => setProviderStatus('idle'), 2000)
    }
  }

  async function handleSaveApiKey(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = apiKey.trim()
    if (!trimmed) return

    setApiKeyStatus('testing')
    setApiKeyError(null)

    const testResult = await testApiKey(trimmed)
    if (!testResult.ok) {
      setApiKeyStatus('error')
      setApiKeyError(testResult.error ?? 'API key verification failed.')
      return
    }

    const { error } = await setAppSetting(
      APP_SETTING_KEYS.SCRAPING_API_KEY,
      trimmed,
      updatedBy,
      true // sensitive — hidden from non-admin reads
    )
    if (error) {
      setApiKeyStatus('error')
      setApiKeyError(error.message)
    } else {
      setApiKeyStatus('saved')
      setApiKeyValue('')
      setHasExistingKey(true)
      setTimeout(() => setApiKeyStatus('idle'), 2000)
    }
  }

  async function handleSaveRateLimit(e: React.FormEvent) {
    e.preventDefault()
    setRateLimitStatus('saving')
    setRateLimitError(null)

    const { error } = await setAppSetting(APP_SETTING_KEYS.SCRAPING_RATE_LIMIT, rateLimit, updatedBy)
    if (error) {
      setRateLimitStatus('error')
      setRateLimitError(error.message)
    } else {
      setRateLimitStatus('saved')
      setTimeout(() => setRateLimitStatus('idle'), 2000)
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Scraping Config</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Configure the AI provider, model, and API key used for recipe scraping.
        </p>
      </div>

      {/* Provider & Model */}
      <section>
        <SectionHeader>Provider</SectionHeader>
        <SettingsCard>
          <form onSubmit={handleSaveProvider}>
            <SettingsRow>
              <RowLabel>Scraping provider</RowLabel>
              <RowDescription>
                The AI service used to extract recipes from URLs and text.
              </RowDescription>
              <select
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value)
                  setProviderStatus('idle')
                }}
                className="mt-2 w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {PROVIDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </SettingsRow>
            <SettingsRow>
              <RowLabel>Model</RowLabel>
              <RowDescription>
                Claude model for recipe extraction. Haiku is fastest and most cost-effective.
              </RowDescription>
              <select
                value={model}
                onChange={(e) => {
                  setModel(e.target.value)
                  setProviderStatus('idle')
                }}
                className="mt-2 w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {MODEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </SettingsRow>
            <SettingsRow>
              <div className="flex items-center justify-between gap-4">
                <div>
                  {providerStatus === 'error' && providerError && (
                    <p className="text-sm text-red-500">{providerError}</p>
                  )}
                  {providerStatus === 'saved' && (
                    <p className="text-sm text-green-600 dark:text-green-400">Settings saved.</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={providerStatus === 'saving'}
                  className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-green-800 transition-colors disabled:opacity-50 shrink-0"
                >
                  {providerStatus === 'saving'
                    ? 'Saving…'
                    : providerStatus === 'saved'
                      ? 'Saved!'
                      : 'Save'}
                </button>
              </div>
            </SettingsRow>
          </form>
        </SettingsCard>
      </section>

      {/* API Key */}
      <section>
        <SectionHeader>API Key</SectionHeader>
        <SettingsCard>
          <SettingsRow>
            <RowLabel>Anthropic API key</RowLabel>
            <RowDescription>
              {hasExistingKey
                ? 'A key is already configured. Enter a new key below to replace it.'
                : 'Enter an Anthropic API key to enable AI-powered recipe scraping for all users.'}
            </RowDescription>
            <form onSubmit={handleSaveApiKey} className="mt-3 space-y-3">
              <label htmlFor="admin-api-key" className="sr-only">
                Anthropic API key
              </label>
              <input
                id="admin-api-key"
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKeyValue(e.target.value)
                  setApiKeyStatus('idle')
                  setApiKeyError(null)
                }}
                placeholder={hasExistingKey ? 'sk-ant-… (leave blank to keep existing)' : 'sk-ant-…'}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 font-mono"
                autoComplete="off"
              />
              {apiKeyStatus === 'error' && apiKeyError && (
                <p className="text-sm text-red-500">{apiKeyError}</p>
              )}
              {apiKeyStatus === 'saved' && (
                <p className="text-sm text-green-600 dark:text-green-400">
                  Key verified and saved.
                </p>
              )}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!apiKey.trim() || apiKeyStatus === 'testing'}
                  className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-green-800 transition-colors disabled:opacity-50"
                >
                  {apiKeyStatus === 'testing'
                    ? 'Verifying…'
                    : apiKeyStatus === 'saved'
                      ? 'Saved!'
                      : 'Verify & Save'}
                </button>
              </div>
            </form>
          </SettingsRow>
        </SettingsCard>
      </section>

      {/* Rate Limits */}
      <section>
        <SectionHeader>Rate Limits</SectionHeader>
        <SettingsCard>
          <SettingsRow>
            <RowLabel>Max imports per user per hour</RowLabel>
            <RowDescription>
              Maximum AI recipe imports a single user can perform in a rolling 1-hour window.
            </RowDescription>
            <form onSubmit={handleSaveRateLimit} className="mt-3">
              <div className="flex items-center gap-3">
                <label htmlFor="rate-limit-input" className="sr-only">
                  Rate limit
                </label>
                <input
                  id="rate-limit-input"
                  type="number"
                  min={1}
                  max={1000}
                  value={rateLimit}
                  onChange={(e) => {
                    setRateLimit(parseInt(e.target.value, 10) || DEFAULT_RATE_LIMIT)
                    setRateLimitStatus('idle')
                  }}
                  className="w-24 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 text-center"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">requests / hour</span>
                <div className="flex-1" />
                <button
                  type="submit"
                  disabled={rateLimitStatus === 'saving'}
                  className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-green-800 transition-colors disabled:opacity-50"
                >
                  {rateLimitStatus === 'saving'
                    ? 'Saving…'
                    : rateLimitStatus === 'saved'
                      ? 'Saved!'
                      : 'Save'}
                </button>
              </div>
              {rateLimitStatus === 'error' && rateLimitError && (
                <p className="text-sm text-red-500 mt-2">{rateLimitError}</p>
              )}
              {rateLimitStatus === 'saved' && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                  Rate limit saved.
                </p>
              )}
            </form>
          </SettingsRow>
        </SettingsCard>
      </section>
    </div>
  )
}
