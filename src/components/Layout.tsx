import { Outlet, NavLink } from 'react-router-dom'

export default function Layout() {
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center gap-1 px-4 py-2 text-xs font-medium transition-colors ${
      isActive ? 'text-green-600' : 'text-gray-500 hover:text-gray-700'
    }`

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-lg font-bold text-green-700">Meal Planner</h1>
      </header>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      <nav className="bg-white border-t border-gray-200 flex justify-around">
        <NavLink to="/" end className={navLinkClass}>
          <span className="text-xl">🏠</span>
          Home
        </NavLink>
        <NavLink to="/recipes" className={navLinkClass}>
          <span className="text-xl">📖</span>
          Recipes
        </NavLink>
        <NavLink to="/planner" className={navLinkClass}>
          <span className="text-xl">📅</span>
          Planner
        </NavLink>
        <NavLink to="/shopping" className={navLinkClass}>
          <span className="text-xl">🛒</span>
          Shopping
        </NavLink>
      </nav>
    </div>
  )
}
