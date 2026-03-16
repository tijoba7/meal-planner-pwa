import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Mail } from 'lucide-react'

/**
 * Two-mode page:
 *  1. "request" — user enters their email; we send a reset link
 *  2. "update"  — user arrived via the reset link (session detected); they set a new password
 */
export default function ResetPasswordPage() {
  const { resetPassword, updatePassword, user } = useAuth()
  const navigate = useNavigate()

  // Detect recovery session: Supabase puts type=recovery in the URL hash
  const [isRecovery, setIsRecovery] = useState(false)

  useEffect(() => {
    if (!supabase) return

    // The hash contains #access_token=...&type=recovery after clicking the link
    const hash = window.location.hash
    if (hash.includes('type=recovery')) {
      setIsRecovery(true)
    }

    // Also listen — Supabase fires PASSWORD_RECOVERY event when the link is used
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  // If user is already logged in and lands here without recovery flow, redirect home
  useEffect(() => {
    if (user && !isRecovery) navigate('/', { replace: true })
  }, [user, isRecovery, navigate])

  return isRecovery ? (
    <UpdatePasswordForm updatePassword={updatePassword} navigate={navigate} />
  ) : (
    <RequestResetForm resetPassword={resetPassword} />
  )
}

function RequestResetForm({
  resetPassword,
}: {
  resetPassword: (email: string) => Promise<{ error: Error | null }>
}) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await resetPassword(email)
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
            <Mail size={28} className="text-green-600 dark:text-green-400" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Email sent</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Check <strong>{email}</strong> for a password reset link.
          </p>
          <Link
            to="/auth/login"
            className="block text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Reset your password
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            Enter your email and we'll send a reset link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <p className="text-center text-sm">
          <Link
            to="/auth/login"
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            ← Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

function UpdatePasswordForm({
  updatePassword,
  navigate,
}: {
  updatePassword: (password: string) => Promise<{ error: Error | null }>
  navigate: ReturnType<typeof useNavigate>
}) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    const { error } = await updatePassword(password)
    setLoading(false)

    if (error) setError(error.message)
    else navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Set new password</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            Choose a strong password for your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="new-password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              New password
            </label>
            <input
              id="new-password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
