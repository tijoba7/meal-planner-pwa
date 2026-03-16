import { Navigate } from 'react-router-dom'
import { useAdmin } from '../contexts/AdminContext'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

/**
 * Wraps routes that require admin role.
 * - Shows nothing while profile is loading (avoids flash of redirect).
 * - Redirects non-admins to /.
 * - In test bypass mode (VITE_TEST_BYPASS_AUTH=true), always allows through.
 */
export default function AdminRoute({ children }: Props) {
  const { isAdmin, loading } = useAdmin()

  if (loading) return null

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
