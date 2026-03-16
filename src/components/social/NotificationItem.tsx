import { type ElementType } from 'react'
import { Link } from 'react-router-dom'
import { Heart, MessageCircle, UserPlus, UserCheck, Users, Share2, AtSign } from 'lucide-react'
import { Avatar } from '../ProfileCard'
import type { Profile } from '../../types/supabase'

type NotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'reaction'
  | 'comment'
  | 'recipe_shared'
  | 'group_invite'
  | 'mention'

type NotificationActor = Pick<Profile, 'id' | 'display_name' | 'avatar_url'>

export interface NotificationData {
  id: string
  type: NotificationType | string
  actor?: NotificationActor
  recipeId?: string
  recipeName?: string
  groupId?: string
  groupName?: string
  readAt?: string | null
  createdAt: string
}

interface TypeConfig {
  icon: ElementType
  iconClass: string
  buildText: (n: NotificationData) => string
}

const TYPE_CONFIG: Record<NotificationType, TypeConfig> = {
  friend_request: {
    icon: UserPlus,
    iconClass: 'bg-green-50 text-green-600',
    buildText: (n) => `${n.actor?.display_name ?? 'Someone'} sent you a friend request`,
  },
  friend_accepted: {
    icon: UserCheck,
    iconClass: 'bg-green-50 text-green-600',
    buildText: (n) => `${n.actor?.display_name ?? 'Someone'} accepted your friend request`,
  },
  reaction: {
    icon: Heart,
    iconClass: 'bg-red-50 text-red-500',
    buildText: (n) =>
      `${n.actor?.display_name ?? 'Someone'} reacted to ${n.recipeName ? `"${n.recipeName}"` : 'your recipe'}`,
  },
  comment: {
    icon: MessageCircle,
    iconClass: 'bg-blue-50 text-blue-500',
    buildText: (n) =>
      `${n.actor?.display_name ?? 'Someone'} commented on ${n.recipeName ? `"${n.recipeName}"` : 'your recipe'}`,
  },
  recipe_shared: {
    icon: Share2,
    iconClass: 'bg-green-50 text-green-600',
    buildText: (n) =>
      `${n.actor?.display_name ?? 'Someone'} shared ${n.recipeName ? `"${n.recipeName}"` : 'a recipe'} with you`,
  },
  group_invite: {
    icon: Users,
    iconClass: 'bg-purple-50 text-purple-600',
    buildText: (n) =>
      `${n.actor?.display_name ?? 'Someone'} invited you to join ${n.groupName ? `"${n.groupName}"` : 'a group'}`,
  },
  mention: {
    icon: AtSign,
    iconClass: 'bg-amber-50 text-amber-600',
    buildText: (n) => `${n.actor?.display_name ?? 'Someone'} mentioned you in a comment`,
  },
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

interface NotificationItemProps {
  notification: NotificationData
  /** Called on click, e.g. to mark the notification as read. */
  onClick?: () => void
}

/**
 * Single notification row with actor avatar, description, timestamp, and unread indicator.
 * Renders as a Link when a relevant entity (recipe, user, group) is available.
 *
 * @example
 * <NotificationItem
 *   notification={{ id: '1', type: 'reaction', actor: profile, recipeId: 'r1', createdAt: '...' }}
 *   onClick={() => markRead(notification.id)}
 * />
 */
export default function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const config = TYPE_CONFIG[notification.type as NotificationType]
  const Icon = config?.icon ?? MessageCircle
  const iconClass = config?.iconClass ?? 'bg-gray-100 text-gray-500'
  const text = config?.buildText(notification) ?? 'You have a new notification'
  const isUnread = !notification.readAt

  const inner = (
    <div
      className={`flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50 cursor-pointer ${
        isUnread ? 'bg-green-50/40' : ''
      }`}
      onClick={onClick}
    >
      {/* Actor avatar with notification type badge */}
      <div className="relative shrink-0">
        {notification.actor ? (
          <>
            <Avatar profile={notification.actor} size="md" />
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white ${iconClass}`}
              aria-hidden="true"
            >
              <Icon size={10} strokeWidth={2.5} />
            </span>
          </>
        ) : (
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${iconClass}`}>
            <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm leading-snug ${
            isUnread ? 'text-gray-800 font-medium' : 'text-gray-600'
          }`}
        >
          {text}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">{relativeTime(notification.createdAt)}</p>
      </div>

      {/* Unread dot */}
      {isUnread && (
        <div className="shrink-0 w-2 h-2 rounded-full bg-green-600 mt-1.5" aria-label="Unread" />
      )}
    </div>
  )

  if (notification.recipeId) {
    return <Link to={`/recipes/${notification.recipeId}`}>{inner}</Link>
  }
  if (
    notification.actor?.id &&
    (notification.type === 'friend_request' || notification.type === 'friend_accepted')
  ) {
    return <Link to={`/users/${notification.actor.id}`}>{inner}</Link>
  }
  if (notification.groupId) {
    return <Link to={`/groups/${notification.groupId}`}>{inner}</Link>
  }
  return inner
}
