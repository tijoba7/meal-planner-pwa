import { useEffect, useState } from 'react'
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom'
import { Bell, BookOpen, CalendarDays, ShoppingCart, Settings, LogIn, LogOut, Compass, Users, UsersRound, User, type LucideIcon } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useProfile } from '../contexts/ProfileContext'
import { isSupabaseAvailable } from '../lib/supabase'
import { Avatar } from './ProfileCard'
import MigrationPrompt from './MigrationPrompt'
import AppUpdateBanner from './AppUpdateBanner'
import PWAInstallBanner from './PWAInstallBanner'
import ToastContainer from './ToastContainer'
import OnboardingWizard, { isOnboardingDone } from './OnboardingWizard'
import OfflineBanner from './OfflineBanner'
import KeyboardShortcutsDialog from './KeyboardShortcutsDialog'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { getUnreadCount, subscribeToNotifications } from '../lib/notificationService'

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
  { to: '/discover', label: 'Discover', icon: Compass, end: false },
  { to: '/friends', label: 'Friends', icon: Users, end: false },
  { to: '/groups', label: 'Groups', icon: UsersRound, end: false },
  { to: '/notifications', label: 'Alerts', icon: Bell, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
]

export default function Layout() {
  const { user, signOut } = useAuth()
  const { profile } = useProfile()
  const navigate = useNavigate()
  const location = useLocation()
  const supIsAvailable = isSupabaseAvailable()
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboardingDone())
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user || !supIsAvailable) return
    getUnreadCount(user.id).then(setUnreadCount)
    const unsub = subscribeToNotifications(user.id, () => {
      setUnreadCount((c) => c + 1)
    })
    return unsub
  }, [user, supIsAvailable])

  useKeyboardShortcuts({
    n: () => navigate('/recipes/new'),
    '?': () => setShowShortcuts((v) => !v),
    Escape: () => setShowShortcuts(false),
  })

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center gap-1 px-4 py-2 text-xs font-medium transition-colors ${
      isActive ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
    }`

  const sidebarLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400'
        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-100'
    }`

  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50 dark:bg-gray-900">
      {/* Skip to main content — keyboard-only visible */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-green-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-medium focus:shadow-lg"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="print:hidden hidden md:flex flex-col w-56 shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 min-h-screen">
        <div className="px-4 py-5 border-b border-gray-100 dark:border-gray-700">
          <h1 className="text-xl font-bold text-green-700 dark:text-green-400">Mise</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Everything in its place.</p>
        </div>
        <nav className="flex flex-col gap-1 p-3 flex-1">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={sidebarLinkClass}>
              <div className="relative">
                <item.icon size={16} strokeWidth={1.75} aria-hidden="true" />
                {item.to === '/notifications' && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-600 text-white text-[9px] font-bold flex items-center justify-center leading-none" aria-hidden="true">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              {item.to === '/notifications' && unreadCount > 0
                ? <>{item.label}<span className="sr-only"> ({unreadCount} unread)</span></>
                : item.label}
            </NavLink>
          ))}
        </nav>

        {/* Keyboard shortcuts hint */}
        <div className="px-3 pb-2">
          <button
            onClick={() => setShowShortcuts(true)}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="Keyboard shortcuts (?)"
          >
            <kbd className="inline-flex items-center justify-center w-5 h-5 text-xs font-mono bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-gray-500 dark:text-gray-400">?</kbd>
            <span>Keyboard shortcuts</span>
          </button>
        </div>

        {/* Auth section at bottom of sidebar */}
        {supIsAvailable && (
          <div className="p-3 border-t border-gray-100 dark:border-gray-700">
            {user ? (
              <div className="space-y-1">
                <Link
                  to="/profile"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {profile && <Avatar profile={profile} size="sm" />}
                  <div className="min-w-0">
                    {profile && (
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">{profile.display_name}</p>
                    )}
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{user.email}</p>
                  </div>
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
                >
                  <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
                  Sign out
                </button>
              </div>
            ) : (
              <Link
                to="/auth/login"
                className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
              >
                <LogIn size={16} strokeWidth={1.75} aria-hidden="true" />
                Sign in
              </Link>
            )}
          </div>
        )}
      </aside>

      {/* Mobile header */}
      <header className="print:hidden md:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-green-700 dark:text-green-400">Mise</h1>
        {supIsAvailable && (
          user ? (
            <Link
              to="/profile"
              aria-label="View profile"
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {profile
                ? <Avatar profile={profile} size="sm" />
                : <User size={18} strokeWidth={1.75} className="text-gray-400 dark:text-gray-500" />
              }
            </Link>
          ) : (
            <Link
              to="/auth/login"
              aria-label="Sign in"
              className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <LogIn size={18} strokeWidth={1.75} />
            </Link>
          )
        )}
      </header>

      {/* Main content */}
      <main id="main-content" className="flex-1 overflow-auto pb-20 md:pb-0 print:pb-0 print:overflow-visible">
        <div key={location.pathname} className="animate-fade-in">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="print:hidden md:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex justify-around z-10">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
            <div className="relative">
              <item.icon size={20} strokeWidth={1.75} aria-hidden="true" />
              {item.to === '/notifications' && unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-600 text-white text-[9px] font-bold flex items-center justify-center leading-none" aria-hidden="true">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            {item.to === '/notifications' && unreadCount > 0
              ? <>{item.label}<span className="sr-only"> ({unreadCount} unread)</span></>
              : item.label}
          </NavLink>
        ))}
      </nav>

      {/* First-time user onboarding wizard */}
      {showOnboarding && <OnboardingWizard onDone={() => setShowOnboarding(false)} />}

      {/* Cloud migration prompt — shown once when user has local data after sign-in */}
      <MigrationPrompt />

      {/* App update notification — shown when a new service worker is ready */}
      <AppUpdateBanner />

      {/* PWA install prompt — shown on 2nd+ visit when browser signals installability */}
      <PWAInstallBanner />

      {/* Offline connectivity indicator */}
      <OfflineBanner />

      {/* Toast notifications */}
      <ToastContainer />

      {/* Keyboard shortcuts help dialog */}
      {showShortcuts && <KeyboardShortcutsDialog onClose={() => setShowShortcuts(false)} />}
    </div>
  )
}
