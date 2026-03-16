import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Loader2, ChevronLeft, UserPlus, Check, UserMinus, UserX, Clock } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Avatar } from '../components/ProfileCard'
import {
  getFriendRelation,
  sendFriendRequest,
  cancelFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  unfriend,
  type FriendRelation,
} from '../lib/friendshipService'
import type { Profile } from '../types/supabase'

export default function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const { user } = useAuth()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [relation, setRelation] = useState<FriendRelation>('none')
  const [friendshipId, setFriendshipId] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId || !supabase) {
      setLoading(false)
      setNotFound(true)
      return
    }
    setLoading(true)
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setNotFound(true)
        } else {
          setProfile(data as Profile)
        }
        setLoading(false)
      })
  }, [userId])

  useEffect(() => {
    if (!user || !userId || user.id === userId) return
    getFriendRelation(user.id, userId).then(({ relation: r, friendshipId: fid }) => {
      setRelation(r)
      setFriendshipId(fid)
    })
  }, [user, userId])

  async function handleAdd() {
    if (!userId) return
    setActionBusy(true)
    setActionError(null)
    const { data, error } = await sendFriendRequest(userId)
    setActionBusy(false)
    if (error) {
      setActionError(error.message)
    } else if (data) {
      setRelation('pending_sent')
      setFriendshipId(data.id)
    }
  }

  async function handleCancel() {
    if (!friendshipId) return
    setActionBusy(true)
    await cancelFriendRequest(friendshipId)
    setRelation('none')
    setFriendshipId(null)
    setActionBusy(false)
  }

  async function handleAccept() {
    if (!friendshipId) return
    setActionBusy(true)
    await acceptFriendRequest(friendshipId)
    setRelation('friends')
    setActionBusy(false)
  }

  async function handleReject() {
    if (!friendshipId) return
    setActionBusy(true)
    await rejectFriendRequest(friendshipId)
    setRelation('none')
    setFriendshipId(null)
    setActionBusy(false)
  }

  async function handleUnfriend() {
    if (!friendshipId) return
    setActionBusy(true)
    await unfriend(friendshipId)
    setRelation('none')
    setFriendshipId(null)
    setActionBusy(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center text-gray-500 dark:text-gray-400">
        <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">
          Profile not found
        </p>
        <p className="text-sm mb-6">This user may not exist or their profile is private.</p>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400 hover:underline"
        >
          <ChevronLeft size={14} />
          Back to recipes
        </Link>
      </div>
    )
  }

  const isSelf = user?.id === userId

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 mb-6"
      >
        <ChevronLeft size={14} />
        Back
      </Link>

      <div className="flex flex-col items-center gap-4 mb-8">
        <Avatar profile={profile} size="xl" />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            {profile.display_name}
          </h1>
          {profile.bio && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 max-w-sm">{profile.bio}</p>
          )}
        </div>

        {/* Friend action — only shown when viewing another user's profile */}
        {!isSelf && user && (
          <div className="flex flex-col items-center gap-1">
            {relation === 'none' && (
              <button
                onClick={handleAdd}
                disabled={actionBusy}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {actionBusy ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <UserPlus size={14} strokeWidth={1.75} />
                )}
                Add friend
              </button>
            )}

            {relation === 'pending_sent' && (
              <button
                onClick={handleCancel}
                disabled={actionBusy}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-50"
              >
                {actionBusy ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Clock size={14} strokeWidth={1.75} />
                )}
                Request sent · Cancel
              </button>
            )}

            {relation === 'pending_received' && (
              <div className="flex gap-2">
                <button
                  onClick={handleAccept}
                  disabled={actionBusy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {actionBusy ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Check size={13} strokeWidth={2} />
                  )}
                  Accept
                </button>
                <button
                  onClick={handleReject}
                  disabled={actionBusy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            )}

            {relation === 'friends' && (
              <button
                onClick={handleUnfriend}
                disabled={actionBusy}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-50"
              >
                {actionBusy ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <UserMinus size={14} strokeWidth={1.75} />
                )}
                Friends · Unfriend
              </button>
            )}

            {relation === 'blocked' && (
              <span className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
                <UserX size={14} strokeWidth={1.75} />
                Blocked
              </span>
            )}

            {actionError && <p className="text-xs text-red-500 mt-1">{actionError}</p>}
          </div>
        )}
      </div>

      {profile.dietary_preferences.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Dietary preferences
          </p>
          <div className="flex flex-wrap gap-1.5">
            {profile.dietary_preferences.map((pref) => (
              <span
                key={pref}
                className="px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium border border-green-200 dark:border-green-800"
              >
                {pref}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
