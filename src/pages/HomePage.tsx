import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome back</h2>
      <p className="text-gray-500 mb-6">What are you cooking this week?</p>

      <div className="grid grid-cols-1 gap-4">
        <Link
          to="/planner"
          className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow flex items-center gap-4"
        >
          <span className="text-3xl">📅</span>
          <div>
            <p className="font-semibold text-gray-800">Weekly Planner</p>
            <p className="text-sm text-gray-500">Plan your meals for the week</p>
          </div>
        </Link>

        <Link
          to="/recipes"
          className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow flex items-center gap-4"
        >
          <span className="text-3xl">📖</span>
          <div>
            <p className="font-semibold text-gray-800">Recipes</p>
            <p className="text-sm text-gray-500">Browse and add your recipes</p>
          </div>
        </Link>

        <Link
          to="/shopping"
          className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow flex items-center gap-4"
        >
          <span className="text-3xl">🛒</span>
          <div>
            <p className="font-semibold text-gray-800">Shopping List</p>
            <p className="text-sm text-gray-500">Auto-generated from your meal plan</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
