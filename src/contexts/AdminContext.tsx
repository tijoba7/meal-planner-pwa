import { createContext, useContext, type ReactNode } from 'react'
import { useProfile } from './ProfileContext'

interface AdminContextValue {
  isAdmin: boolean
  loading: boolean
}

const AdminContext = createContext<AdminContextValue | null>(null)

// The `role` column is added by MEA-168 migration. Cast to include it while the
// generated supabase.ts types are regenerated after that migration lands.
type ProfileWithRole = { role?: 'user' | 'admin' } | null

export function AdminProvider({ children }: { children: ReactNode }) {
  const { profile, loading } = useProfile()

  const isAdmin = (profile as ProfileWithRole)?.role === 'admin'

  return (
    <AdminContext.Provider value={{ isAdmin: isAdmin ?? false, loading }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider')
  return ctx
}
