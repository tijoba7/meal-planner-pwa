import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

/**
 * Wraps routes that require authentication.
 * - Redirects unauthenticated users to /auth/login, preserving the intended destination.
 * - Shows nothing while the auth state is loading (avoids flash of redirect).
 */
export default function ProtectedRoute({ children }: Props) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    // Avoid a flash — render nothing while session is resolving
    return null
  }

  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location.pathname }} replace />
  }

  return <>{children}</>
}
