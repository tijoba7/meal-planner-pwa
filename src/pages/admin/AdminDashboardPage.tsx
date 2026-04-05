import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  Calendar,
  ChevronRight,
  FolderOpen,
  Globe,
  LayoutTemplate,
  Monitor,
  Package,
  Settings,
  ShoppingCart,
} from 'lucide-react'
import { db } from '../../lib/db'
import { listAppSettings, APP_SETTING_KEYS } from '../../lib/appSettingsService'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface LocalStats {
  recipes: number
  mealPlans: number
  templates: number
  shoppingLists: number
  pantryItems: number
  collections: number
}

interface FlagStatus {
  social: boolean
  groups: boolean
  discover: boolean
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string
  value: number | undefined
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
  href: string
}) {
  return (
    <Link
      to={href}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:border-green-300 dark:hover:border-green-700 hover:shadow-sm transition-all group"
    >
      <Icon
        size={16}
        strokeWidth={1.75}
        className="text-gray-400 dark:text-gray-500 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors mb-2"
        aria-hidden="true"
      />
      <div className="text-2xl font-bold text-gray-800 dark:text-gray-100 tabular-nums">
        {value === undefined ? (
          <span className="inline-block w-8 h-7 bg-gray-100 dark:bg-gray-700 rounded animate-pulse align-middle" />
        ) : (
          value
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </Link>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<LocalStats | null>(null)
  const [flags, setFlags] = useState<FlagStatus | null>(null)

  useEffect(() => {
    Promise.all([
      db.recipes.count(),
      db.mealPlans.count(),
      db.mealPlanTemplates.count(),
      db.shoppingLists.count(),
      db.pantryItems.count(),
      db.collections.count(),
    ]).then(([recipes, mealPlans, templates, shoppingLists, pantryItems, collections]) => {
      setStats({ recipes, mealPlans, templates, shoppingLists, pantryItems, collections })
    })
  }, [])

  useEffect(() => {
    listAppSettings().then((settings) => {
      const map = new Map(settings.map((s) => [s.key, s.value]))
      setFlags({
        social: (map.get(APP_SETTING_KEYS.FEATURES_SOCIAL) as boolean) ?? true,
        groups: (map.get(APP_SETTING_KEYS.FEATURES_GROUPS) as boolean) ?? true,
        discover: (map.get(APP_SETTING_KEYS.FEATURES_DISCOVER) as boolean) ?? true,
      })
    })
  }, [])

  const statCards = [
    { label: 'Recipes', value: stats?.recipes, icon: BookOpen, href: '/recipes' },
    { label: 'Meal Plans', value: stats?.mealPlans, icon: Calendar, href: '/meal-plan' },
    { label: 'Templates', value: stats?.templates, icon: LayoutTemplate, href: '/meal-plan' },
    { label: 'Shopping Lists', value: stats?.shoppingLists, icon: ShoppingCart, href: '/shopping' },
    { label: 'Pantry Items', value: stats?.pantryItems, icon: Package, href: '/pantry' },
    { label: 'Collections', value: stats?.collections, icon: FolderOpen, href: '/collections' },
  ]

  const adminSections = [
    {
      label: 'Settings',
      description: 'Feature flags, dietary defaults, notifications',
      icon: Settings,
      href: '/admin/settings',
    },
    {
      label: 'Scraping',
      description: 'Recipe import API configuration',
      icon: Globe,
      href: '/admin/scraping',
    },
    {
      label: 'System',
      description: 'Version info, updates, system health',
      icon: Monitor,
      href: '/admin/system',
    },
  ]

  const flagRows: { key: keyof FlagStatus; label: string }[] = [
    { key: 'social', label: 'Social features' },
    { key: 'groups', label: 'Groups' },
    { key: 'discover', label: 'Discover' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Overview of app data and configuration.
        </p>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          You are in the admin panel. Changes here affect all users.
        </p>
      </div>

      {/* Local data stats */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Local Data
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {statCards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>
      </section>

      {/* Feature flag status */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Feature Flags
          </h2>
          <Link
            to="/admin/settings"
            className="text-xs text-green-600 dark:text-green-400 hover:underline font-medium"
          >
            Edit in Settings
          </Link>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-100 dark:divide-gray-700">
          {flagRows.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
              {flags === null ? (
                <span className="inline-block w-10 h-5 bg-gray-100 dark:bg-gray-700 rounded-full animate-pulse" />
              ) : (
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    flags[key]
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {flags[key] ? 'On' : 'Off'}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Admin section links */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Admin Sections
        </h2>
        <div className="space-y-2">
          {adminSections.map(({ label, description, icon: Icon, href }) => (
            <Link
              key={label}
              to={href}
              className="flex items-center gap-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 hover:border-green-300 dark:hover:border-green-700 hover:shadow-sm transition-all group"
            >
              <Icon
                size={18}
                strokeWidth={1.75}
                className="text-gray-400 dark:text-gray-500 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors shrink-0"
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
              </div>
              <ChevronRight
                size={16}
                className="text-gray-300 dark:text-gray-600 shrink-0"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
