import { useState } from 'react'
import { APP_VERSION, checkForUpdate, type UpdateInfo } from '../../lib/updateService'

export default function AdminSystemPage() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null)
  const [checking, setChecking] = useState(false)

  const handleCheck = async () => {
    setChecking(true)
    try {
      const info = await checkForUpdate()
      setUpdate(info)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">System</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Version info, updates, and maintenance.
        </p>
      </div>

      {/* Current version */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Version</h2>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-mono font-bold text-green-600 dark:text-green-400">
            v{APP_VERSION}
          </span>
          <button
            onClick={handleCheck}
            disabled={checking}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {checking ? 'Checking...' : 'Check for updates'}
          </button>
        </div>

        {update && !update.error && !update.updateAvailable && (
          <p className="text-sm text-green-600 dark:text-green-400">You're on the latest version.</p>
        )}

        {update?.error && (
          <p className="text-sm text-amber-600 dark:text-amber-400">{update.error}</p>
        )}

        {update?.updateAvailable && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-2">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Update available: <span className="font-mono">v{update.latestVersion}</span>
            </p>
            {update.publishedAt && (
              <p className="text-xs text-blue-600 dark:text-blue-400">
                Released {new Date(update.publishedAt).toLocaleDateString()}
              </p>
            )}
            {update.releaseUrl && (
              <a
                href={update.releaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sm text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300"
              >
                View release notes
              </a>
            )}
          </div>
        )}
      </section>

      {/* Update instructions */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">How to update</h2>

        <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
          <div>
            <h3 className="font-medium text-gray-800 dark:text-gray-100 mb-1">Docker</h3>
            <pre className="bg-gray-100 dark:bg-gray-900 rounded-lg p-3 overflow-x-auto text-xs font-mono">
{`cd /path/to/meal-planner-pwa
git pull origin main
docker compose build
docker compose up -d`}
            </pre>
          </div>

          <div>
            <h3 className="font-medium text-gray-800 dark:text-gray-100 mb-1">Vercel</h3>
            <p>Updates deploy automatically when you push to <code className="bg-gray-100 dark:bg-gray-900 px-1 rounded text-xs">main</code>.</p>
          </div>

          <div>
            <h3 className="font-medium text-gray-800 dark:text-gray-100 mb-1">Static host</h3>
            <pre className="bg-gray-100 dark:bg-gray-900 rounded-lg p-3 overflow-x-auto text-xs font-mono">
{`git pull origin main
pnpm install
pnpm build
# Copy dist/ to your web server`}
            </pre>
          </div>

          <div>
            <h3 className="font-medium text-gray-800 dark:text-gray-100 mb-1">Database migrations</h3>
            <p>
              After updating, check if new migration files were added in{' '}
              <code className="bg-gray-100 dark:bg-gray-900 px-1 rounded text-xs">supabase/migrations/</code>.
              If so, run them via Supabase CLI (<code className="bg-gray-100 dark:bg-gray-900 px-1 rounded text-xs">npx supabase db push</code>)
              or paste into the SQL Editor.
            </p>
          </div>
        </div>
      </section>

      {/* System info */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">System info</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-gray-500 dark:text-gray-400">Platform</dt>
          <dd className="text-gray-800 dark:text-gray-200 font-mono">{navigator.userAgent.split(' ').slice(0, 3).join(' ')}</dd>

          <dt className="text-gray-500 dark:text-gray-400">Service Worker</dt>
          <dd className="text-gray-800 dark:text-gray-200 font-mono">
            {'serviceWorker' in navigator ? 'Supported' : 'Not supported'}
          </dd>

          <dt className="text-gray-500 dark:text-gray-400">Storage</dt>
          <dd className="text-gray-800 dark:text-gray-200 font-mono">
            {typeof indexedDB !== 'undefined' ? 'IndexedDB available' : 'No local storage'}
          </dd>
        </dl>
      </section>
    </div>
  )
}
