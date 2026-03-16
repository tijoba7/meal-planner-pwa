import { Link } from 'react-router-dom'
import { Users, LogIn, LogOut, Lock } from 'lucide-react'
import type { Tables } from '../../types/supabase'

type Group = Tables<'groups'>

export type GroupMembership = 'none' | 'member' | 'admin' | 'invited'

export interface GroupCardData {
  group: Pick<Group, 'id' | 'name' | 'description' | 'avatar_url'>
  memberCount: number
  membership?: GroupMembership
  /** If true, the group is private (invite-only). */
  isPrivate?: boolean
}

interface GroupCardProps {
  data: GroupCardData
  onJoin?: (groupId: string) => void
  onLeave?: (groupId: string) => void
  /** Called when user accepts an invite. */
  onAcceptInvite?: (groupId: string) => void
  disabled?: boolean
}

/**
 * Group / cooking circle card. Displays group avatar, name, description,
 * member count, and a contextual join/leave/pending action button.
 *
 * @example
 * <GroupCard
 *   data={{ group, memberCount: 12, membership: 'none' }}
 *   onJoin={(id) => joinGroup(id)}
 * />
 */
export default function GroupCard({ data, onJoin, onLeave, onAcceptInvite, disabled }: GroupCardProps) {
  const { group, memberCount, membership = 'none', isPrivate } = data

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 hover:shadow-sm transition-shadow">
      {/* Group avatar */}
      <Link to={`/groups/${group.id}`} aria-label={`Open ${group.name}`} className="shrink-0">
        <div className="w-12 h-12 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center overflow-hidden">
          {group.avatar_url ? (
            <img src={group.avatar_url} alt={group.name} className="w-full h-full object-cover" />
          ) : (
            <Users size={22} strokeWidth={1.75} className="text-green-600" aria-hidden="true" />
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Link
            to={`/groups/${group.id}`}
            className="text-sm font-semibold text-gray-800 hover:text-green-600 transition-colors truncate"
          >
            {group.name}
          </Link>
          {isPrivate && (
            <Lock size={11} strokeWidth={2} className="text-gray-400 shrink-0" aria-label="Private group" />
          )}
        </div>
        {group.description && (
          <p className="text-xs text-gray-500 truncate mt-0.5">{group.description}</p>
        )}
        <p className="text-xs text-gray-400 mt-0.5">
          {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </p>
      </div>

      {/* Action */}
      <div className="shrink-0">
        {membership === 'none' && !isPrivate && (
          <button
            onClick={() => onJoin?.(group.id)}
            disabled={disabled}
            aria-label={`Join ${group.name}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <LogIn size={12} strokeWidth={2} aria-hidden="true" />
            Join
          </button>
        )}

        {membership === 'invited' && (
          <button
            onClick={() => onAcceptInvite?.(group.id)}
            disabled={disabled}
            aria-label={`Accept invite to ${group.name}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            Join
          </button>
        )}

        {membership === 'member' && (
          <button
            onClick={() => onLeave?.(group.id)}
            disabled={disabled}
            aria-label={`Leave ${group.name}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:text-red-500 hover:border-red-300 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <LogOut size={12} strokeWidth={2} aria-hidden="true" />
            Leave
          </button>
        )}

        {membership === 'admin' && (
          <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 border border-green-200">
            Admin
          </span>
        )}
      </div>
    </div>
  )
}
