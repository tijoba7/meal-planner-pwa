import { Link, useNavigate } from 'react-router-dom'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="flex flex-col items-center text-center max-w-sm">
        <p className="text-7xl font-bold text-green-600 dark:text-green-400 leading-none mb-3">404</p>
        <p className="text-base font-semibold text-gray-800 dark:text-gray-100">Page not found</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          That page doesn't exist. Maybe the URL changed or you followed a broken link.
        </p>
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => navigate(-1)}
            className="text-sm font-medium px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Go back
          </button>
          <Link
            to="/"
            className="text-sm font-medium px-4 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            Go to recipes
          </Link>
        </div>
      </div>
    </div>
  )
}
