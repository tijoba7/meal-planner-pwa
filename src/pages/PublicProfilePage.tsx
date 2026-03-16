import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Loader2, ChevronLeft, UserPlus, Check, UserMinus, UserX, Clock, MessageCircle, Grid3x3 } from 'lucide-react'
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
import { getPublicFeed, type CloudRecipeWithAuthor } from '../lib/recipeShareService'
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

  // Recipe grid data — engineers: replace stub with real per-user query
  const [recipes, setRecipes] = useState<CloudRecipeWithAuthor[]>([])
  const [recipesLoading, setRecipesLoading] = useState(false)

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

  // Load this user's public recipes for the grid
  // engineers: replace getPublicFeed with a per-user query once that exists
  useEffect(() => {
    if (!userId) return
    setRecipesLoading(true)
    getPublicFeed(0, 12)
      .then((items) => setRecipes(items.filter((i) => i.author_id === userId)))
      .catch(() => {})
      .finally(() => setRecipesLoading(false))
  }, [userId])

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
    <div className="max-w-lg mx-auto">
      {/* Back nav */}
      <div className="px-4 pt-4 pb-2">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
        >
          <ChevronLeft size={14} />
          Back
        </Link>
      </div>

      {/* ── Profile header ─────────────────────────────────────────────── */}
      <div className="px-4 pb-4">
        {/* Avatar + stats row */}
        <div className="flex items-center gap-6 mb-4">
          {/* Avatar */}
          <Avatar profile={profile} size="xl" />

          {/* Stats */}
          <div className="flex gap-6 flex-1 justify-around">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">
                {recipesLoading ? '—' : recipes.length}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Recipes</p>
            </div>
            <div className="text-center">
              {/* engineers: wire to followers count */}
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">0</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Followers</p>
            </div>
            <div className="text-center">
              {/* engineers: wire to following count */}
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">0</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Following</p>
            </div>
          </div>
        </div>

        {/* Name + bio */}
        <div className="mb-4">
          <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {profile.display_name}
          </h1>
          {profile.bio && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{profile.bio}</p>
          )}
          {profile.dietary_preferences.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {profile.dietary_preferences.map((pref) => (
                <span
                  key={pref}
                  className="px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs border border-green-200 dark:border-green-800"
                >
                  {pref}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        {!isSelf && user && (
          <div className="flex gap-2">
            {/* Primary follow/friend action */}
            {relation === 'none' && (
              <button
                onClick={handleAdd}
                disabled={actionBusy}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {actionBusy ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <UserPlus size={14} strokeWidth={1.75} />
                )}
                Follow
              </button>
            )}

            {relation === 'pending_sent' && (
              <button
                onClick={handleCancel}
                disabled={actionBusy}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-50"
              >
                {actionBusy ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Clock size={14} strokeWidth={1.75} />
                )}
                Requested
              </button>
            )}

            {relation === 'pending_received' && (
              <div className="flex gap-2 flex-1">
                <button
                  onClick={handleAccept}
                  disabled={actionBusy}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {actionBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={2} />}
                  Accept
                </button>
                <button
                  onClick={handleReject}
                  disabled={actionBusy}
                  className="flex-1 flex items-center justify-center py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            )}

            {relation === 'friends' && (
              <button
                onClick={handleUnfriend}
                disabled={actionBusy}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-50"
              >
                {actionBusy ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <UserMinus size={14} strokeWidth={1.75} />
                )}
                Following
              </button>
            )}

            {relation === 'blocked' && (
              <div className="flex-1 flex items-center justify-center gap-2 py-2 text-sm text-gray-400 dark:text-gray-500">
                <UserX size={14} strokeWidth={1.75} />
                Blocked
              </div>
            )}

            {/* Message button — engineers: wire to DM */}
            {(relation === 'friends' || relation === 'none') && (
              <button
                disabled
                aria-label="Send message (coming soon)"
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-40"
              >
                <MessageCircle size={14} strokeWidth={1.75} />
                Message
              </button>
            )}
          </div>
        )}

        {actionError && (
          <p className="text-xs text-red-500 mt-2">{actionError}</p>
        )}
      </div>

      {/* ── Recipe grid ────────────────────────────────────────────────── */}
      <div className="border-t border-gray-200 dark:border-gray-700">
        {/* Grid header */}
        <div className="flex items-center justify-center py-2 border-b border-gray-200 dark:border-gray-700">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <Grid3x3 size={14} strokeWidth={1.75} aria-hidden="true" />
            Recipes
          </span>
        </div>

        {recipesLoading ? (
          <div className="grid grid-cols-3 gap-0.5">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="aspect-square bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ))}
          </div>
        ) : recipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <Grid3x3 size={36} className="text-gray-300 dark:text-gray-600 mb-3" strokeWidth={1.5} />
            <p className="text-sm text-gray-500 dark:text-gray-400">No public recipes yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-0.5" role="list" aria-label="Recipe grid">
            {recipes.map((item) => {
              const r = item.data
              return (
                <div key={item.id} role="listitem">
                  <Link
                    to={`/shared/${item.id}`}
                    className="block aspect-square bg-gray-100 dark:bg-gray-800 overflow-hidden group"
                    aria-label={r.name}
                  >
                    {r.image ? (
                      <img
                        src={r.imageThumbnailUrl ?? r.image}
                        alt={r.name}
                        className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-200"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 flex items-center justify-center">
                        <span className="text-2xl" role="img" aria-label="Recipe">🍽️</span>
                      </div>
                    )}
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
