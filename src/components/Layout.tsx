import { useEffect, useRef, useState } from 'react'
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom'
import {
  Bell,
  BookOpen,
  CalendarDays,
  Library,
  MessageSquare,
  Rss,
  ShoppingCart,
  Settings,
  LogIn,
  LogOut,
  Compass,
  Users,
  UsersRound,
  User,
  Package,
  HelpCircle,
  ShieldCheck,
  CloudUpload,
  type LucideIcon,
} from 'lucide-react'
import { useAdmin } from '../contexts/AdminContext'
import { useAuth } from '../contexts/AuthContext'
import { useProfile } from '../contexts/ProfileContext'
import { Avatar } from './ProfileCard'
import MigrationPrompt from './MigrationPrompt'
import AppUpdateBanner from './AppUpdateBanner'
import PWAInstallBanner from './PWAInstallBanner'
import ToastContainer from './ToastContainer'
import OnboardingWizard, { isOnboardingDone } from './OnboardingWizard'
import OfflineBanner from './OfflineBanner'
import KeyboardShortcutsDialog from './KeyboardShortcutsDialog'
import SearchDialog from './SearchDialog'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useFeatureFlags } from '../hooks/useFeatureFlags'
import { useSync } from '../contexts/SyncContext'
import { getUnreadCount, subscribeToNotifications } from '../lib/notificationService'
import { getUnreadDmCount, subscribeToDirectMessages } from '../lib/dmService'

// Prefetch map — warming the chunk cache on hover/focus avoids a loading flash
// when the user navigates to a lazy-loaded route.
const PREFETCH_MAP: Record<string, () => Promise<unknown>> = {
  '/recipes': () => import('../pages/RecipesPage'),
  '/collections': () => import('../pages/CollectionsPage'),
  '/meal-plan': () => import('../pages/PlannerPage'),
  '/shopping': () => import('../pages/ShoppingListPage'),
  '/pantry': () => import('../pages/PantryPage'),
  '/discover': () => import('../pages/DiscoverPage'),
  '/friends': () => import('../pages/FriendsPage'),
  '/groups': () => import('../pages/GroupsPage'),
  '/notifications': () => import('../pages/NotificationsPage'),
  '/messages': () => import('../pages/MessagesPage'),
  '/settings': () => import('../pages/SettingsPage'),
}

function prefetch(to: string) {
  PREFETCH_MAP[to]?.()
}

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Feed', icon: Rss, end: true },
  { to: '/recipes', label: 'Recipes', icon: BookOpen, end: false },
  { to: '/collections', label: 'Collections', icon: Library, end: false },
  { to: '/meal-plan', label: 'Meal Plan', icon: CalendarDays, end: false },
  { to: '/shopping', label: 'Shopping', icon: ShoppingCart, end: false },
  { to: '/pantry', label: 'Pantry', icon: Package, end: false },
  { to: '/discover', label: 'Discover', icon: Compass, end: false },
  { to: '/friends', label: 'Friends', icon: Users, end: false },
  { to: '/groups', label: 'Groups', icon: UsersRound, end: false },
  { to: '/messages', label: 'Messages', icon: MessageSquare, end: false },
  { to: '/notifications', label: 'Notifications', icon: Bell, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
]

export default function Layout() {
  const { user, signOut } = useAuth()
  const { profile } = useProfile()
  const { isAdmin } = useAdmin()
  const { social, groups, discover } = useFeatureFlags()
  const { pendingCount, flushNow } = useSync()
  const navigate = useNavigate()
  const location = useLocation()

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.to === '/discover') return discover
    if (item.to === '/groups') return groups
    if (item.to === '/' || item.to === '/friends' || item.to === '/messages') return social
    return true
  })
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboardingDone())
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [unreadDmCount, setUnreadDmCount] = useState(0)

  // Swipe gesture tracking for mobile tab switching
  const swipeStartX = useRef<number | null>(null)
  const SWIPE_THRESHOLD = 60

  function haptic() {
    navigator.vibrate?.(8)
  }

  function handleSwipeStart(e: React.TouchEvent) {
    swipeStartX.current = e.touches[0].clientX
  }

  function handleSwipeEnd(e: React.TouchEvent) {
    if (swipeStartX.current === null) return
    const delta = e.changedTouches[0].clientX - swipeStartX.current
    swipeStartX.current = null
    if (Math.abs(delta) < SWIPE_THRESHOLD) return

    const currentIndex = visibleNavItems.findIndex(
      (item) =>
        item.end
          ? location.pathname === item.to
          : location.pathname === item.to || location.pathname.startsWith(item.to + '/'),
    )
    if (currentIndex === -1) return

    if (delta < 0 && currentIndex < visibleNavItems.length - 1) {
      // swipe left → next tab
      haptic()
      navigate(visibleNavItems[currentIndex + 1].to)
    } else if (delta > 0 && currentIndex > 0) {
      // swipe right → previous tab
      haptic()
      navigate(visibleNavItems[currentIndex - 1].to)
    }
  }

  useEffect(() => {
    if (!user) return
    getUnreadCount(user.id).then(setUnreadCount)
    const unsub = subscribeToNotifications(user.id, () => {
      setUnreadCount((c) => c + 1)
    })
    return unsub
  }, [user])

  useEffect(() => {
    if (!user) return
    getUnreadDmCount(user.id).then(setUnreadDmCount)
    const unsub = subscribeToDirectMessages(user.id, () => {
      setUnreadDmCount((c) => c + 1)
    })
    return unsub
  }, [user])

  // Cmd+K / Ctrl+K opens search — useKeyboardShortcuts skips metaKey/ctrlKey combos
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch((v) => !v)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useKeyboardShortcuts({
    n: () => navigate('/recipes/new'),
    '/': () => setShowSearch(true),
    '?': () => setShowShortcuts((v) => !v),
    Escape: () => {
      setShowSearch(false)
      setShowShortcuts(false)
    },
  })

  // 48px min touch target: py-3 (24px) + icon (20px) + gap + label ≈ 56px
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center gap-0.5 px-3 py-3 min-h-12 text-xs font-medium transition-colors ${
      isActive
        ? 'text-green-700 dark:text-green-400'
        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
    }`

  const sidebarLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center justify-center lg:justify-start gap-3 p-2.5 lg:px-3 lg:py-2.5 rounded-lg text-sm font-medium transition-colors ${
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

      {/* Sidebar — icon-only on tablet (md), full labels on desktop (lg+) */}
      <aside className="print:hidden hidden md:flex flex-col w-14 lg:w-56 shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 min-h-screen">
        <div className="flex items-center justify-center lg:justify-start gap-2.5 px-2 lg:px-4 py-5 border-b border-gray-100 dark:border-gray-700">
          <img src="/favicon.svg" alt="Braisely" className="w-8 h-8 rounded-lg" />
          <div className="hidden lg:flex lg:flex-1 items-center justify-between min-w-0">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-gray-800 dark:text-gray-100">Braisely</h1>
              <p className="text-[10px] text-gray-600 dark:text-gray-400 -mt-0.5 tracking-wide uppercase">
                cook &middot; share &middot; enjoy
              </p>
            </div>
            {pendingCount > 0 && (
              <button
                onClick={flushNow}
                title={`${pendingCount} pending change${pendingCount === 1 ? '' : 's'} — tap to sync`}
                aria-label={`${pendingCount} pending change${pendingCount === 1 ? '' : 's'}, tap to sync`}
                className="relative flex-shrink-0 p-1 rounded-md text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
              >
                <CloudUpload size={16} strokeWidth={1.75} aria-hidden="true" />
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500 text-white text-[8px] font-bold flex items-center justify-center leading-none">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              </button>
            )}
          </div>
          {/* Tablet: show sync dot when there are pending mutations */}
          {pendingCount > 0 && (
            <button
              onClick={flushNow}
              title={`${pendingCount} pending changes`}
              aria-label={`${pendingCount} pending changes, tap to sync`}
              className="lg:hidden relative p-1 rounded-md text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
            >
              <CloudUpload size={14} strokeWidth={1.75} aria-hidden="true" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500" aria-hidden="true" />
            </button>
          )}
        </div>
        <nav aria-label="Main navigation" className="flex flex-col gap-1 p-2 lg:p-3 flex-1">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={sidebarLinkClass}
              title={item.label}
              onMouseEnter={() => prefetch(item.to)}
              onFocus={() => prefetch(item.to)}
            >
              <div className="relative">
                <item.icon size={16} strokeWidth={1.75} aria-hidden="true" />
                {item.to === '/notifications' && unreadCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-600 text-white text-[9px] font-bold flex items-center justify-center leading-none"
                    aria-hidden="true"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
                {item.to === '/messages' && unreadDmCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-600 text-white text-[9px] font-bold flex items-center justify-center leading-none"
                    aria-hidden="true"
                  >
                    {unreadDmCount > 9 ? '9+' : unreadDmCount}
                  </span>
                )}
              </div>
              <span className="hidden lg:block">
                {item.to === '/notifications' && unreadCount > 0 ? (
                  <>
                    {item.label}
                    <span className="sr-only"> ({unreadCount} unread)</span>
                  </>
                ) : item.to === '/messages' && unreadDmCount > 0 ? (
                  <>
                    {item.label}
                    <span className="sr-only"> ({unreadDmCount} unread)</span>
                  </>
                ) : (
                  item.label
                )}
              </span>
              {/* Always-visible screen reader label on tablet */}
              <span className="sr-only lg:hidden">
                {item.to === '/notifications' && unreadCount > 0
                  ? `${item.label} (${unreadCount} unread)`
                  : item.to === '/messages' && unreadDmCount > 0
                    ? `${item.label} (${unreadDmCount} unread)`
                    : item.label}
              </span>
            </NavLink>
          ))}
          {/* Help — sidebar only (not in mobile tab bar) */}
          <NavLink to="/help" end={false} className={sidebarLinkClass} title="Help">
            <HelpCircle size={16} strokeWidth={1.75} aria-hidden="true" />
            <span className="hidden lg:block">Help</span>
            <span className="sr-only lg:hidden">Help</span>
          </NavLink>
          {/* Admin — sidebar only, visible to admins */}
          {isAdmin && (
            <NavLink to="/admin" end={false} className={sidebarLinkClass} title="Admin">
              <ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true" />
              <span className="hidden lg:block">Admin</span>
              <span className="sr-only lg:hidden">Admin</span>
            </NavLink>
          )}
        </nav>

        {/* Keyboard shortcuts hint — desktop only */}
        <div className="hidden lg:block px-3 pb-2">
          <button
            onClick={() => setShowShortcuts(true)}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="Keyboard shortcuts (?)"
          >
            <kbd className="inline-flex items-center justify-center w-5 h-5 text-xs font-mono bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-gray-500 dark:text-gray-400">
              ?
            </kbd>
            <span>Keyboard shortcuts</span>
          </button>
        </div>

        {/* Auth section at bottom of sidebar */}
        <div className="p-2 lg:p-3 border-t border-gray-100 dark:border-gray-700">
          {user ? (
            <div className="space-y-1">
              <Link
                to="/profile"
                aria-label="View profile"
                className="flex items-center justify-center lg:justify-start gap-2 p-2 lg:px-3 lg:py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {profile ? (
                  <Avatar profile={profile} size="sm" />
                ) : (
                  <User
                    size={16}
                    strokeWidth={1.75}
                    className="text-gray-400 dark:text-gray-500"
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0 hidden lg:block">
                  {profile && (
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">
                      {profile.display_name}
                    </p>
                  )}
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {user.email}
                  </p>
                </div>
              </Link>
              <button
                onClick={handleSignOut}
                aria-label="Sign out"
                className="flex items-center justify-center lg:justify-start gap-3 w-full p-2 lg:px-3 lg:py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
              >
                <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
                <span className="hidden lg:block">Sign out</span>
              </button>
            </div>
          ) : (
            <Link
              to="/auth/login"
              aria-label="Sign in"
              className="flex items-center justify-center lg:justify-start gap-3 w-full p-2 lg:px-3 lg:py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
            >
              <LogIn size={16} strokeWidth={1.75} aria-hidden="true" />
              <span className="hidden lg:block">Sign in</span>
            </Link>
          )}
        </div>
      </aside>

      {/* Mobile header */}
      <header className="print:hidden md:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" alt="Braisely" className="w-7 h-7 rounded-lg" />
          <h1 className="text-lg font-bold tracking-tight text-gray-800 dark:text-gray-100">Braisely</h1>
        </div>
        <div className="flex items-center gap-1">
          {pendingCount > 0 && (
            <button
              onClick={flushNow}
              title={`${pendingCount} pending change${pendingCount === 1 ? '' : 's'} — tap to sync`}
              aria-label={`${pendingCount} pending change${pendingCount === 1 ? '' : 's'}, tap to sync`}
              className="relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
            >
              <CloudUpload size={18} strokeWidth={1.75} aria-hidden="true" />
              <span className="absolute top-2 right-2 w-3 h-3 rounded-full bg-amber-500 text-white text-[7px] font-bold flex items-center justify-center leading-none">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            </button>
          )}
          {user ? (
            <Link
              to="/profile"
              aria-label="View profile"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {profile ? (
                <Avatar profile={profile} size="sm" />
              ) : (
                <User size={18} strokeWidth={1.75} className="text-gray-400 dark:text-gray-500" />
              )}
            </Link>
          ) : (
            <Link
              to="/auth/login"
              aria-label="Sign in"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <LogIn size={18} strokeWidth={1.75} />
            </Link>
          )}
        </div>
      </header>

      {/* Main content — pb accounts for bottom tab bar + iOS safe area inset */}
      <main
        id="main-content"
        className="flex-1 overflow-auto pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0 print:pb-0 print:overflow-visible"
      >
        <div key={location.pathname} className="animate-fade-in-up">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom tab bar — pb handles iOS home indicator safe area */}
      <nav
        aria-label="Mobile navigation"
        className="print:hidden md:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex justify-around z-nav pb-[env(safe-area-inset-bottom)]"
        onTouchStart={handleSwipeStart}
        onTouchEnd={handleSwipeEnd}
      >
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={linkClass}
            onClick={haptic}
            onMouseEnter={() => prefetch(item.to)}
            onFocus={() => prefetch(item.to)}
          >
            <div className="relative">
              <item.icon size={20} strokeWidth={1.75} aria-hidden="true" />
              {item.to === '/notifications' && unreadCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-600 text-white text-[9px] font-bold flex items-center justify-center leading-none"
                  aria-hidden="true"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
              {item.to === '/messages' && unreadDmCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-600 text-white text-[9px] font-bold flex items-center justify-center leading-none"
                  aria-hidden="true"
                >
                  {unreadDmCount > 9 ? '9+' : unreadDmCount}
                </span>
              )}
            </div>
            {item.to === '/notifications' && unreadCount > 0 ? (
              <>
                {item.label}
                <span className="sr-only"> ({unreadCount} unread)</span>
              </>
            ) : item.to === '/messages' && unreadDmCount > 0 ? (
              <>
                {item.label}
                <span className="sr-only"> ({unreadDmCount} unread)</span>
              </>
            ) : (
              item.label
            )}
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

      {/* Global search dialog */}
      {showSearch && <SearchDialog onClose={() => setShowSearch(false)} />}

      {/* Keyboard shortcuts help dialog */}
      {showShortcuts && <KeyboardShortcutsDialog onClose={() => setShowShortcuts(false)} />}
    </div>
  )
}
