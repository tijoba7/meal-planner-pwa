import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Bell, UserPlus, Heart, MessageCircle, Users, Check, Globe, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { isSupabaseAvailable } from '../lib/supabase'
import {
  getNotifications,
  markRead,
  markAllRead,
  subscribeToNotifications,
  getMutedTypes,
  setMutedTypes,
  type AppNotification,
  type NotificationType,
} from '../lib/notificationService'
import { formatDistanceToNow } from '../lib/formatDate'

// ─── Preference config ────────────────────────────────────────────────────────

const PREF_OPTIONS: { type: NotificationType; label: string }[] = [
  { type: 'friend_request',  label: 'Friend requests' },
  { type: 'friend_accepted', label: 'Friend request accepted' },
  { type: 'recipe_reaction', label: 'Reactions on my recipes' },
  { type: 'recipe_comment',  label: 'Comments on my recipes' },
  { type: 'comment_reply',   label: 'Replies to my comments' },
  { type: 'group_invite',    label: 'Group invitations' },
]

// ─── Icon + label helpers ─────────────────────────────────────────────────────

function notificationIcon(type: NotificationType) {
  switch (type) {
    case 'friend_request':
    case 'friend_accepted':
      return <UserPlus size={16} className="text-green-500" />
    case 'recipe_reaction':
      return <Heart size={16} className="text-red-400" />
    case 'recipe_comment':
    case 'comment_reply':
      return <MessageCircle size={16} className="text-gray-500" />
    case 'group_invite':
      return <Users size={16} className="text-green-500" />
    default:
      return <Bell size={16} className="text-gray-400" />
  }
}

function notificationText(n: AppNotification): string {
  const p = n.payload
  switch (n.type) {
    case 'friend_request':
      return 'sent you a friend request.'
    case 'friend_accepted':
      return 'accepted your friend request.'
    case 'recipe_reaction':
      return p.reaction_type === 'like'
        ? 'liked your recipe.'
        : p.reaction_type === 'bookmark'
          ? 'bookmarked your recipe.'
          : `reacted to your recipe.`
    case 'recipe_comment':
      return 'commented on your recipe.'
    case 'comment_reply':
      return 'replied to your comment.'
    case 'group_invite':
      return `added you to "${p.group_name}".`
    default:
      return 'sent you a notification.'
  }
}

function notificationLink(n: AppNotification): string | null {
  const p = n.payload
  switch (n.type) {
    case 'friend_request':
    case 'friend_accepted':
      return p.requester_id ? `/users/${p.requester_id}` : (p.acceptor_id ? `/users/${p.acceptor_id}` : '/friends')
    case 'recipe_reaction':
    case 'recipe_comment':
    case 'comment_reply':
      return p.recipe_id ? `/shared/${p.recipe_id}` : null
    case 'group_invite':
      return p.group_id ? `/groups/${p.group_id}` : '/groups'
    default:
      return null
  }
}

// ─── Single notification row ──────────────────────────────────────────────────

function NotificationRow({
  notification,
  onRead,
}: {
  notification: AppNotification
  onRead: (id: string) => void
}) {
  const isUnread = !notification.read_at
  const link = notificationLink(notification)
  const text = notificationText(notification)
  const age = formatDistanceToNow(new Date(notification.created_at))

  const inner = (
    <div
      className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${
        isUnread
          ? 'bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/30'
          : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700'
      }`}
    >
      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0 mt-0.5">
        {notificationIcon(notification.type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 dark:text-gray-100 leading-snug">{text}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{age}</p>
      </div>
      {isUnread && (
        <div className="w-2 h-2 rounded-full bg-green-500 shrink-0 mt-1.5" aria-label="Unread" />
      )}
    </div>
  )

  function handleClick() {
    if (isUnread) onRead(notification.id)
  }

  if (link) {
    return (
      <li>
        <Link to={link} onClick={handleClick} className="block hover:opacity-90 transition-opacity">
          {inner}
        </Link>
      </li>
    )
  }

  return (
    <li>
      <div
        onClick={handleClick}
        className={isUnread ? 'cursor-pointer' : undefined}
        role={isUnread ? 'button' : undefined}
      >
        {inner}
      </div>
    </li>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { user } = useAuth()
  const supAvailable = isSupabaseAvailable()

  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)
  const [mutedTypes, setMutedTypesState] = useState<NotificationType[]>([])
  const [showPrefs, setShowPrefs] = useState(false)

  const load = useCallback(async () => {
    if (!user || !supAvailable) { setLoading(false); return }
    const [items, muted] = await Promise.all([
      getNotifications(user.id),
      getMutedTypes(user.id),
    ])
    setNotifications(items)
    setMutedTypesState(muted)
    setLoading(false)
  }, [user, supAvailable])

  useEffect(() => { load() }, [load])

  // Realtime subscription: prepend new notifications as they arrive
  useEffect(() => {
    if (!user || !supAvailable) return
    const unsub = subscribeToNotifications(user.id, (n) => {
      setNotifications((prev) => [n, ...prev])
    })
    return unsub
  }, [user, supAvailable])

  async function handleRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n)
    )
    await markRead(id)
  }

  async function handleMarkAllRead() {
    if (!user) return
    setMarkingAll(true)
    const now = new Date().toISOString()
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })))
    await markAllRead(user.id)
    setMarkingAll(false)
  }

  async function handleToggleMute(type: NotificationType) {
    if (!user) return
    const next = mutedTypes.includes(type)
      ? mutedTypes.filter((t) => t !== type)
      : [...mutedTypes, type]
    setMutedTypesState(next)
    await setMutedTypes(user.id, next)
  }

  const unreadCount = notifications.filter((n) => !n.read_at).length

  if (!supAvailable) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <Globe size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Connect to Supabase to see notifications.
        </p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center text-gray-500 text-sm">
        Sign in to see your notifications.
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Notifications</h1>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-green-600 text-white text-xs font-bold">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors disabled:opacity-50"
            >
              {markingAll ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Check size={12} />
              )}
              Mark all as read
            </button>
          )}
          <button
            onClick={() => setShowPrefs((v) => !v)}
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-expanded={showPrefs}
          >
            Preferences
          </button>
        </div>
      </div>

      {/* Notification preferences */}
      {showPrefs && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Notification preferences</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Turn off types you don't want to receive.</p>
          <ul className="space-y-2">
            {PREF_OPTIONS.map(({ type, label }) => {
              const muted = mutedTypes.includes(type)
              return (
                <li key={type} className="flex items-center justify-between gap-3">
                  <span className={`text-sm ${muted ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-700 dark:text-gray-200'}`}>
                    {label}
                  </span>
                  <button
                    onClick={() => handleToggleMute(type)}
                    role="switch"
                    aria-checked={!muted}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                      muted ? 'bg-gray-200 dark:bg-gray-600' : 'bg-green-500'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        muted ? 'translate-x-0' : 'translate-x-4'
                      }`}
                    />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Notification list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16">
          <Bell size={36} strokeWidth={1.25} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No notifications yet. When friends react to your recipes or send you requests, they'll show up here.
          </p>
        </div>
      ) : (
        <ul className="space-y-2" aria-live="polite">
          {notifications.map((n) => (
            <NotificationRow key={n.id} notification={n} onRead={handleRead} />
          ))}
        </ul>
      )}
    </div>
  )
}
