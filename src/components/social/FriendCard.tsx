import { Link } from 'react-router-dom'
import { UserPlus, UserCheck, UserX, Clock } from 'lucide-react'
import { Avatar } from '../ProfileCard'
import type { Profile } from '../../types/supabase'

export type FriendRelation =
  | 'none'
  | 'pending_sent' // current user sent the request
  | 'pending_received' // other user sent the request
  | 'friends'
  | 'blocked'

interface FriendCardProps {
  profile: Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'bio'>
  relation?: FriendRelation
  onAdd?: () => void
  onAccept?: () => void
  onDecline?: () => void
  onRemove?: () => void
  disabled?: boolean
}

/**
 * User card with contextual friendship action buttons.
 *
 * @example
 * <FriendCard
 *   profile={user}
 *   relation="pending_received"
 *   onAccept={() => acceptFriend(user.id)}
 *   onDecline={() => declineFriend(user.id)}
 * />
 */
export default function FriendCard({
  profile,
  relation = 'none',
  onAdd,
  onAccept,
  onDecline,
  onRemove,
  disabled,
}: FriendCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <Link to={`/users/${profile.id}`} aria-label={`View ${profile.display_name}'s profile`}>
        <Avatar profile={profile} size="md" />
      </Link>

      <div className="flex-1 min-w-0">
        <Link
          to={`/users/${profile.id}`}
          className="text-sm font-medium text-gray-800 hover:text-green-600 transition-colors truncate block"
        >
          {profile.display_name}
        </Link>
        {profile.bio && <p className="text-xs text-gray-400 truncate mt-0.5">{profile.bio}</p>}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {relation === 'none' && (
          <button
            onClick={onAdd}
            disabled={disabled}
            aria-label={`Add ${profile.display_name} as a friend`}
            className="flex items-center gap-1.5 bg-green-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <UserPlus size={13} strokeWidth={2} aria-hidden="true" />
            Add
          </button>
        )}

        {relation === 'pending_sent' && (
          <span className="flex items-center gap-1.5 text-gray-400 text-xs font-medium px-3 py-1.5 bg-gray-100 rounded-lg">
            <Clock size={13} strokeWidth={2} aria-hidden="true" />
            Pending
          </span>
        )}

        {relation === 'pending_received' && (
          <>
            <button
              onClick={onAccept}
              disabled={disabled}
              aria-label={`Accept friend request from ${profile.display_name}`}
              className="flex items-center gap-1.5 bg-green-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <UserCheck size={13} strokeWidth={2} aria-hidden="true" />
              Accept
            </button>
            <button
              onClick={onDecline}
              disabled={disabled}
              aria-label={`Decline friend request from ${profile.display_name}`}
              className="border border-gray-200 text-gray-600 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Decline
            </button>
          </>
        )}

        {relation === 'friends' && (
          <button
            onClick={onRemove}
            disabled={disabled}
            aria-label={`Remove ${profile.display_name} as a friend`}
            className="flex items-center gap-1.5 text-green-600 border border-green-600 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50"
          >
            <UserCheck size={13} strokeWidth={2} aria-hidden="true" />
            Friends
          </button>
        )}

        {relation === 'blocked' && (
          <span className="flex items-center gap-1.5 text-red-400 text-xs font-medium px-3 py-1.5 bg-red-50 rounded-lg">
            <UserX size={13} strokeWidth={2} aria-hidden="true" />
            Blocked
          </span>
        )}
      </div>
    </div>
  )
}
