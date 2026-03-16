import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus, Users, Clock, Search, Check, X, UserMinus, Loader2, Globe } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { isSupabaseAvailable } from '../lib/supabase'
import { Avatar } from '../components/ProfileCard'
import {
  getFriends,
  getPendingRequests,
  getSentRequests,
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  unfriend,
  type FriendshipWithProfile,
} from '../lib/friendshipService'
import type { Profile } from '../types/supabase'

type Tab = 'friends' | 'requests' | 'find'

// ─── Sub-components ───────────────────────────────────────────────────────────

function FriendCard({
  item,
  onUnfriend,
}: {
  item: FriendshipWithProfile
  onUnfriend: (id: string) => void
}) {
  const [busy, setBusy] = useState(false)

  async function handleUnfriend() {
    setBusy(true)
    await unfriend(item.id)
    onUnfriend(item.id)
    setBusy(false)
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
      <Link to={`/users/${item.profile.id}`}>
        <Avatar profile={item.profile} size="md" />
      </Link>
      <div className="flex-1 min-w-0">
        <Link
          to={`/users/${item.profile.id}`}
          className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:underline truncate block"
        >
          {item.profile.display_name}
        </Link>
        {item.profile.bio && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.profile.bio}</p>
        )}
      </div>
      <button
        onClick={handleUnfriend}
        disabled={busy}
        title="Unfriend"
        className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400 hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-50"
      >
        {busy ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <UserMinus size={12} strokeWidth={1.75} />
        )}
        Unfriend
      </button>
    </div>
  )
}

function RequestCard({
  item,
  onAccept,
  onReject,
}: {
  item: FriendshipWithProfile
  onAccept: (id: string) => void
  onReject: (id: string) => void
}) {
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null)

  async function handleAccept() {
    setBusy('accept')
    await acceptFriendRequest(item.id)
    onAccept(item.id)
    setBusy(null)
  }

  async function handleReject() {
    setBusy('reject')
    await rejectFriendRequest(item.id)
    onReject(item.id)
    setBusy(null)
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
      <Link to={`/users/${item.profile.id}`}>
        <Avatar profile={item.profile} size="md" />
      </Link>
      <div className="flex-1 min-w-0">
        <Link
          to={`/users/${item.profile.id}`}
          className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:underline truncate block"
        >
          {item.profile.display_name}
        </Link>
        {item.profile.bio && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.profile.bio}</p>
        )}
      </div>
      <div className="shrink-0 flex gap-2">
        <button
          onClick={handleAccept}
          disabled={busy !== null}
          title="Accept"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-700 text-white text-xs font-medium hover:bg-green-800 transition-colors disabled:opacity-50"
        >
          {busy === 'accept' ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Check size={12} strokeWidth={2} />
          )}
          Accept
        </button>
        <button
          onClick={handleReject}
          disabled={busy !== null}
          title="Decline"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-300 hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-50"
        >
          {busy === 'reject' ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <X size={12} strokeWidth={2} />
          )}
          Decline
        </button>
      </div>
    </div>
  )
}

function SentCard({
  item,
  onCancel,
}: {
  item: FriendshipWithProfile
  onCancel: (id: string) => void
}) {
  const [busy, setBusy] = useState(false)

  async function handleCancel() {
    setBusy(true)
    await cancelFriendRequest(item.id)
    onCancel(item.id)
    setBusy(false)
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 opacity-80">
      <Link to={`/users/${item.profile.id}`}>
        <Avatar profile={item.profile} size="md" />
      </Link>
      <div className="flex-1 min-w-0">
        <Link
          to={`/users/${item.profile.id}`}
          className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:underline truncate block"
        >
          {item.profile.display_name}
        </Link>
        <p className="text-xs text-gray-400 dark:text-gray-500">Request pending</p>
      </div>
      <button
        onClick={handleCancel}
        disabled={busy}
        className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400 hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-50"
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : <X size={12} strokeWidth={2} />}
        Cancel
      </button>
    </div>
  )
}

function SearchResultCard({
  user,
  onSent,
}: {
  user: Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'bio'>
  onSent: (userId: string) => void
}) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSend() {
    setStatus('sending')
    const { error } = await sendFriendRequest(user.id)
    if (error) {
      setErrorMsg(error.message)
      setStatus('error')
    } else {
      setStatus('sent')
      onSent(user.id)
    }
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
      <Link to={`/users/${user.id}`}>
        <Avatar profile={user} size="md" />
      </Link>
      <div className="flex-1 min-w-0">
        <Link
          to={`/users/${user.id}`}
          className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:underline truncate block"
        >
          {user.display_name}
        </Link>
        {user.bio && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.bio}</p>
        )}
        {status === 'error' && <p className="text-xs text-red-500">{errorMsg}</p>}
      </div>
      <button
        onClick={handleSend}
        disabled={status === 'sending' || status === 'sent'}
        className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
          status === 'sent'
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
            : 'bg-green-700 text-white hover:bg-green-800'
        }`}
      >
        {status === 'sending' ? (
          <Loader2 size={12} className="animate-spin" />
        ) : status === 'sent' ? (
          <Check size={12} strokeWidth={2} />
        ) : (
          <UserPlus size={12} strokeWidth={1.75} />
        )}
        {status === 'sent' ? 'Sent' : 'Add'}
      </button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FriendsPage() {
  const { user } = useAuth()
  const supAvailable = isSupabaseAvailable()
  const [tab, setTab] = useState<Tab>('friends')

  const [friends, setFriends] = useState<FriendshipWithProfile[]>([])
  const [pending, setPending] = useState<FriendshipWithProfile[]>([])
  const [sent, setSent] = useState<FriendshipWithProfile[]>([])
  const [loading, setLoading] = useState(true)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<
    Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'bio'>[]
  >([])
  const [searching, setSearching] = useState(false)

  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [f, p, s] = await Promise.all([
      getFriends(user.id),
      getPendingRequests(user.id),
      getSentRequests(user.id),
    ])
    setFriends(f)
    setPending(p)
    setSent(s)
    setLoading(false)
  }, [user])

  useEffect(() => {
    reload()
  }, [reload])

  // Debounced search
  useEffect(() => {
    if (!user || searchQuery.trim().length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    const id = setTimeout(async () => {
      const results = await searchUsers(searchQuery, user.id)
      setSearchResults(results)
      setSearching(false)
    }, 300)
    return () => clearTimeout(id)
  }, [searchQuery, user])

  if (!supAvailable) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <Globe size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Connect to Supabase to use friends.
        </p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center text-gray-500">
        <p>Sign in to manage your friends.</p>
      </div>
    )
  }

  const tabClass = (t: Tab) =>
    `flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      tab === t
        ? 'border-green-600 text-green-700 dark:text-green-400'
        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
    }`

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Friends</h1>

      {/* Tabs */}
      <div
        role="tablist"
        className="flex border-b border-gray-200 dark:border-gray-700 mb-5 -mx-4 px-4"
      >
        <button
          role="tab"
          aria-selected={tab === 'friends'}
          aria-controls="tab-panel-friends"
          onClick={() => setTab('friends')}
          className={tabClass('friends')}
        >
          <Users size={14} strokeWidth={1.75} aria-hidden="true" />
          Friends
          {friends.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300">
              {friends.length}
            </span>
          )}
        </button>
        <button
          role="tab"
          aria-selected={tab === 'requests'}
          aria-controls="tab-panel-requests"
          onClick={() => setTab('requests')}
          className={tabClass('requests')}
        >
          <Clock size={14} strokeWidth={1.75} aria-hidden="true" />
          Requests
          {pending.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-xs text-green-700 dark:text-green-400">
              {pending.length}
            </span>
          )}
        </button>
        <button
          role="tab"
          aria-selected={tab === 'find'}
          aria-controls="tab-panel-find"
          onClick={() => setTab('find')}
          className={tabClass('find')}
        >
          <Search size={14} strokeWidth={1.75} aria-hidden="true" />
          Find
        </button>
      </div>

      {/* Friends tab */}
      {tab === 'friends' && (
        <div id="tab-panel-friends" role="tabpanel">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : friends.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <Users size={32} strokeWidth={1.25} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">No friends yet.</p>
              <button
                onClick={() => setTab('find')}
                className="mt-2 text-sm text-green-600 dark:text-green-400 hover:underline"
              >
                Find people to add
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {friends.map((f) => (
                <FriendCard
                  key={f.id}
                  item={f}
                  onUnfriend={(id) => setFriends((prev) => prev.filter((x) => x.id !== id))}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Requests tab */}
      {tab === 'requests' && (
        <div id="tab-panel-requests" role="tabpanel" className="space-y-6">
          {/* Incoming */}
          <div>
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Incoming ({pending.length})
            </h2>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={20} className="animate-spin text-gray-400" />
              </div>
            ) : pending.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 py-4">No incoming requests.</p>
            ) : (
              <div className="space-y-2">
                {pending.map((p) => (
                  <RequestCard
                    key={p.id}
                    item={p}
                    onAccept={(id) => {
                      setPending((prev) => prev.filter((x) => x.id !== id))
                      reload()
                    }}
                    onReject={(id) => setPending((prev) => prev.filter((x) => x.id !== id))}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Outgoing */}
          <div>
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Sent ({sent.length})
            </h2>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={20} className="animate-spin text-gray-400" />
              </div>
            ) : sent.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 py-4">No outgoing requests.</p>
            ) : (
              <div className="space-y-2">
                {sent.map((s) => (
                  <SentCard
                    key={s.id}
                    item={s}
                    onCancel={(id) => setSent((prev) => prev.filter((x) => x.id !== id))}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Find tab */}
      {tab === 'find' && (
        <div id="tab-panel-find" role="tabpanel">
          <div className="relative mb-4">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
              strokeWidth={1.75}
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            {searching && (
              <Loader2
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400"
              />
            )}
          </div>

          {searchQuery.trim().length >= 2 && !searching && searchResults.length === 0 && (
            <p className="text-sm text-center text-gray-400 dark:text-gray-500 py-6">
              No users found for "{searchQuery}".
            </p>
          )}

          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((u) => (
                <SearchResultCard key={u.id} user={u} onSent={() => {}} />
              ))}
            </div>
          )}

          {searchQuery.trim().length < 2 && (
            <p className="text-sm text-center text-gray-400 dark:text-gray-500 py-6">
              Type at least 2 characters to search.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
