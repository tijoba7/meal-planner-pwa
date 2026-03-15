import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom'
import { BookOpen, CalendarDays, ShoppingCart, Settings, LogIn, LogOut, User, type LucideIcon } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { isSupabaseAvailable } from '../lib/supabase'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Recipes', icon: BookOpen, end: true },
  { to: '/meal-plan', label: 'Meal Plan', icon: CalendarDays, end: false },
  { to: '/shopping', label: 'Shopping', icon: ShoppingCart, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
]

export default function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const supIsAvailable = isSupabaseAvailable()

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center gap-1 px-4 py-2 text-xs font-medium transition-colors ${
      isActive ? 'text-green-600' : 'text-gray-500 hover:text-gray-700'
    }`

  const sidebarLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-green-50 text-green-700'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
    }`

  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 bg-white border-r border-gray-200 min-h-screen">
        <div className="px-4 py-5 border-b border-gray-100">
          <h1 className="text-xl font-bold text-green-700">Mise</h1>
          <p className="text-xs text-gray-400 mt-0.5">Everything in its place.</p>
        </div>
        <nav className="flex flex-col gap-1 p-3 flex-1">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={sidebarLinkClass}>
              <item.icon size={16} strokeWidth={1.75} aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Auth section at bottom of sidebar */}
        {supIsAvailable && (
          <div className="p-3 border-t border-gray-100">
            {user ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 truncate">
                  <User size={14} strokeWidth={1.75} className="shrink-0 text-gray-400" />
                  <span className="truncate text-xs text-gray-500">{user.email}</span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors"
                >
                  <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
                  Sign out
                </button>
              </div>
            ) : (
              <Link
                to="/auth/login"
                className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors"
              >
                <LogIn size={16} strokeWidth={1.75} aria-hidden="true" />
                Sign in
              </Link>
            )}
          </div>
        )}
      </aside>

      {/* Mobile header */}
      <header className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-green-700">Mise</h1>
        {supIsAvailable && (
          user ? (
            <button
              onClick={handleSignOut}
              aria-label="Sign out"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <LogOut size={18} strokeWidth={1.75} />
            </button>
          ) : (
            <Link
              to="/auth/login"
              aria-label="Sign in"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <LogIn size={18} strokeWidth={1.75} />
            </Link>
          )
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 flex justify-around z-10">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
            <item.icon size={20} strokeWidth={1.75} aria-hidden="true" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
