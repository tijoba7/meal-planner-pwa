import { Outlet, NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/', label: 'Recipes', icon: '📖', end: true },
  { to: '/meal-plan', label: 'Meal Plan', icon: '📅', end: false },
  { to: '/shopping', label: 'Shopping', icon: '🛒', end: false },
  { to: '/settings', label: 'Settings', icon: '⚙️', end: false },
]

export default function Layout() {
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

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 bg-white border-r border-gray-200 min-h-screen">
        <div className="px-4 py-5 border-b border-gray-100">
          <h1 className="text-xl font-bold text-green-700">Mise</h1>
          <p className="text-xs text-gray-400 mt-0.5">Everything in its place.</p>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={sidebarLinkClass}>
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Mobile header */}
      <header className="md:hidden bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-lg font-bold text-green-700">Mise</h1>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 flex justify-around z-10">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
            <span className="text-xl">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
