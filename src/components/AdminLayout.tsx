import { Outlet, NavLink, Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Globe, Settings, ArrowLeft, type LucideIcon } from 'lucide-react'

interface AdminNavItem {
  to: string
  label: string
  icon: LucideIcon
  end: boolean
}

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/scraping', label: 'Scraping', icon: Globe, end: false },
  { to: '/admin/settings', label: 'Settings', icon: Settings, end: false },
]

export default function AdminLayout() {
  const location = useLocation()
  const sidebarLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center justify-center lg:justify-start gap-3 p-2.5 lg:px-3 lg:py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400'
        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-100'
    }`

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-14 lg:w-56 shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 min-h-screen">
        <div className="flex items-center justify-center lg:block px-2 lg:px-4 py-5 border-b border-gray-100 dark:border-gray-700">
          <span className="text-xl font-bold text-green-700 dark:text-green-400 lg:hidden" aria-hidden="true">
            M
          </span>
          <div className="hidden lg:block">
            <h1 className="text-xl font-bold text-green-700 dark:text-green-400">Mise</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Admin Panel</p>
          </div>
        </div>

        <nav aria-label="Admin navigation" className="flex flex-col gap-1 p-2 lg:p-3 flex-1">
          {ADMIN_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={sidebarLinkClass}
              title={item.label}
            >
              <item.icon size={16} strokeWidth={1.75} aria-hidden="true" />
              <span className="hidden lg:block">{item.label}</span>
              <span className="sr-only lg:hidden">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-2 lg:p-3 border-t border-gray-100 dark:border-gray-700">
          <Link
            to="/"
            className="flex items-center justify-center lg:justify-start gap-3 p-2.5 lg:px-3 lg:py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
            title="Back to app"
          >
            <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
            <span className="hidden lg:block">Back to app</span>
            <span className="sr-only lg:hidden">Back to app</span>
          </Link>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="md:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            aria-label="Back to app"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft size={18} strokeWidth={1.75} />
          </Link>
          <h1 className="text-lg font-bold text-green-700 dark:text-green-400">Admin</h1>
        </div>
        <nav aria-label="Admin navigation" className="flex items-center gap-1">
          {ADMIN_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              aria-label={item.label}
              className={({ isActive }) =>
                `min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors ${
                  isActive
                    ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`
              }
            >
              <item.icon size={20} strokeWidth={1.75} aria-hidden="true" />
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Main content */}
      <main id="main-content" className="flex-1 overflow-auto">
        <div key={location.pathname} className="animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
