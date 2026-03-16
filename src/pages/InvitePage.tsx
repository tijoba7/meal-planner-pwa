/**
 * Invite page — /invite/:token
 *
 * When a signed-in user visits this page:
 *   - Resolves the invite token to the inviter's profile.
 *   - Shows "Add [name] as a friend?" confirmation.
 *   - Sends the friend request on confirm.
 *
 * When not signed in:
 *   - Redirects to /auth/signup?invite=TOKEN so the app can process the invite
 *     after sign-up (handled by the auth flow via the `invite` query param).
 */

import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Loader2, UserPlus, Check, ChevronLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Avatar } from '../components/ProfileCard'
import { resolveInviteToken, sendFriendRequest, getFriendRelation } from '../lib/friendshipService'
import type { Profile } from '../types/supabase'

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [inviter, setInviter] = useState<Pick<
    Profile,
    'id' | 'display_name' | 'avatar_url' | 'bio'
  > | null>(null)
  const [loading, setLoading] = useState(true)
  const [invalid, setInvalid] = useState(false)
  const [alreadyFriends, setAlreadyFriends] = useState(false)
  const [isSelf, setIsSelf] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) {
      setInvalid(true)
      setLoading(false)
      return
    }

    // Not signed in — redirect to sign-up with invite token in query params.
    if (!user) {
      navigate(`/auth/signup?invite=${encodeURIComponent(token)}`, { replace: true })
      return
    }

    resolveInviteToken(token).then(async profile => {
      if (!profile) {
        setInvalid(true)
        setLoading(false)
        return
      }

      if (profile.id === user.id) {
        setIsSelf(true)
        setInviter(profile)
        setLoading(false)
        return
      }

      // Check if already friends.
      const { relation } = await getFriendRelation(user.id, profile.id)
      if (relation === 'friends' || relation === 'pending_sent') {
        setAlreadyFriends(true)
      }

      setInviter(profile)
      setLoading(false)
    })
  }, [token, user, navigate])

  async function handleAdd() {
    if (!inviter) return
    setStatus('sending')
    const { error } = await sendFriendRequest(inviter.id)
    if (error) {
      setErrorMsg(error.message)
      setStatus('error')
    } else {
      setStatus('done')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (invalid) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Invite link not found
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          This invite link may have expired or been revoked.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400 hover:underline"
        >
          <ChevronLeft size={14} />
          Back to Mise
        </Link>
      </div>
    )
  }

  if (isSelf) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          That's your own invite link!
        </p>
        <Link
          to="/friends"
          className="text-sm text-green-600 dark:text-green-400 hover:underline"
        >
          Go to Friends
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-8 text-center shadow-sm">
        {inviter && (
          <>
            <div className="flex justify-center mb-4">
              <Avatar profile={inviter} size="xl" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
              {inviter.display_name}
            </h1>
            {inviter.bio && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{inviter.bio}</p>
            )}

            {alreadyFriends ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-sm">
                  <Check size={16} strokeWidth={2} />
                  You're already connected!
                </div>
                <Link
                  to={`/users/${inviter.id}`}
                  className="text-sm text-green-600 dark:text-green-400 hover:underline"
                >
                  View profile
                </Link>
              </div>
            ) : status === 'done' ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-sm font-medium">
                  <Check size={16} strokeWidth={2} />
                  Friend request sent!
                </div>
                <Link
                  to="/friends"
                  className="text-sm text-green-600 dark:text-green-400 hover:underline"
                >
                  Go to Friends
                </Link>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                  {inviter.display_name} wants to connect with you on Mise.
                </p>
                {status === 'error' && (
                  <p className="text-sm text-red-500 mb-3">{errorMsg}</p>
                )}
                <button
                  onClick={handleAdd}
                  disabled={status === 'sending'}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {status === 'sending' ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <UserPlus size={15} strokeWidth={1.75} />
                  )}
                  Add {inviter.display_name} as a friend
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
