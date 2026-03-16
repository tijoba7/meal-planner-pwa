import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<{ error: Error | null }>
  resetPassword: (email: string) => Promise<{ error: Error | null }>
  updatePassword: (password: string) => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Fake user for E2E test mode (VITE_TEST_BYPASS_AUTH=true)
const TEST_USER = {
  id: 'test-user-id',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
} as User

const isTestMode = import.meta.env.VITE_TEST_BYPASS_AUTH === 'true'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(isTestMode ? TEST_USER : null)
  const [session, setSession] = useState<Session | null>(null)
  // When Supabase is not configured, auth is always "resolved" (no user)
  const [loading, setLoading] = useState(isTestMode ? false : supabase !== null)

  useEffect(() => {
    if (isTestMode || !supabase) return

    // Get the initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signUp(email: string, password: string) {
    if (!supabase) return { error: new Error('Supabase not configured') }
    const { error } = await supabase.auth.signUp({ email, password })
    return { error }
  }

  async function signIn(email: string, password: string) {
    if (!supabase) return { error: new Error('Supabase not configured') }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signInWithMagicLink(email: string) {
    if (!supabase) return { error: new Error('Supabase not configured') }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    return { error }
  }

  async function signOut() {
    if (!supabase) return { error: new Error('Supabase not configured') }
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  async function resetPassword(email: string) {
    if (!supabase) return { error: new Error('Supabase not configured') }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    return { error }
  }

  async function updatePassword(password: string) {
    if (!supabase) return { error: new Error('Supabase not configured') }
    const { error } = await supabase.auth.updateUser({ password })
    return { error }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signUp,
        signIn,
        signInWithMagicLink,
        signOut,
        resetPassword,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
