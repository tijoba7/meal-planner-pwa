import { Navigate, useLocation } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { isSupabaseAvailable } from '../lib/supabase'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

/**
 * Wraps routes that require authentication.
 * - If Supabase is not configured, shows a setup error page.
 * - Redirects unauthenticated users to /auth/login, preserving the intended destination.
 * - Shows nothing while the auth state is loading (avoids flash of redirect).
 */
export default function ProtectedRoute({ children }: Props) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (!isSupabaseAvailable()) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-md space-y-4 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
            <Settings size={28} className="text-red-600 dark:text-red-400" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Supabase not configured
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            This app requires Supabase to function. Set the following environment variables and
            restart the dev server:
          </p>
          <pre className="text-left text-xs bg-gray-100 dark:bg-gray-800 rounded-lg p-4 text-gray-800 dark:text-gray-200 overflow-x-auto">
            {`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
          </pre>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Add these to a{' '}
            <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">.env.local</code> file in
            the project root.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    // Avoid a flash — render nothing while session is resolving
    return null
  }

  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location.pathname }} replace />
  }

  return <>{children}</>
}
