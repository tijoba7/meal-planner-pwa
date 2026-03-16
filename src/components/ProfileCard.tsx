import { Link } from 'react-router-dom'
import type { Profile } from '../types/supabase'

// ─── Notion-style default avatars ────────────────────────────────────────────
// Deterministic color based on display_name hash. Warm, friendly palette.

const AVATAR_COLORS = [
  { bg: 'bg-rose-100 dark:bg-rose-900/40', text: 'text-rose-600 dark:text-rose-300' },
  { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-600 dark:text-orange-300' },
  { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-600 dark:text-amber-300' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-600 dark:text-emerald-300' },
  { bg: 'bg-teal-100 dark:bg-teal-900/40', text: 'text-teal-600 dark:text-teal-300' },
  { bg: 'bg-cyan-100 dark:bg-cyan-900/40', text: 'text-cyan-600 dark:text-cyan-300' },
  { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-600 dark:text-blue-300' },
  { bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-600 dark:text-violet-300' },
  { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-600 dark:text-purple-300' },
  { bg: 'bg-pink-100 dark:bg-pink-900/40', text: 'text-pink-600 dark:text-pink-300' },
  { bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/40', text: 'text-fuchsia-600 dark:text-fuchsia-300' },
  { bg: 'bg-indigo-100 dark:bg-indigo-900/40', text: 'text-indigo-600 dark:text-indigo-300' },
]

function hashName(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (name[0] ?? '?').toUpperCase()
}

function getAvatarColor(name: string) {
  return AVATAR_COLORS[hashName(name) % AVATAR_COLORS.length]
}

interface ProfileCardProps {
  profile: Profile
  /** Link to their public profile page. Defaults to true. */
  linkable?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export default function ProfileCard({ profile, linkable = true, size = 'md' }: ProfileCardProps) {
  const avatarSizes = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-16 h-16' }
  const fontSizes = { sm: 'text-xs', md: 'text-sm', lg: 'text-lg' }
  const textSizes = { sm: 'text-sm', md: 'text-sm', lg: 'text-base' }
  const color = getAvatarColor(profile.display_name)

  const avatar = (
    <div
      className={`${avatarSizes[size]} rounded-full flex items-center justify-center shrink-0 overflow-hidden ${
        profile.avatar_url ? 'bg-gray-100 dark:bg-gray-700' : color.bg
      }`}
    >
      {profile.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={profile.display_name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <span className={`${fontSizes[size]} font-semibold ${color.text} select-none`}>
          {getInitials(profile.display_name)}
        </span>
      )}
    </div>
  )

  const content = (
    <div className="flex items-center gap-2.5 min-w-0">
      {avatar}
      <div className="min-w-0">
        <p className={`${textSizes[size]} font-medium text-gray-800 dark:text-gray-200 truncate`}>
          {profile.display_name}
        </p>
        {size === 'lg' && profile.bio && (
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">{profile.bio}</p>
        )}
      </div>
    </div>
  )

  if (!linkable) return content

  return (
    <Link to={`/users/${profile.id}`} className="hover:opacity-80 transition-opacity">
      {content}
    </Link>
  )
}

// ─── Standalone avatar ─────────────────────────────────────────────────────────

interface AvatarProps {
  profile: Pick<Profile, 'display_name' | 'avatar_url'>
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export function Avatar({ profile, size = 'md', className = '' }: AvatarProps) {
  const sizes = { xs: 'w-5 h-5', sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-16 h-16', xl: 'w-24 h-24' }
  const fontSizes = { xs: 'text-[8px]', sm: 'text-xs', md: 'text-sm', lg: 'text-lg', xl: 'text-2xl' }
  const color = getAvatarColor(profile.display_name)

  return (
    <div
      className={`${sizes[size]} rounded-full flex items-center justify-center shrink-0 overflow-hidden ${
        profile.avatar_url ? 'bg-gray-100 dark:bg-gray-700' : color.bg
      } ${className}`}
    >
      {profile.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={profile.display_name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <span className={`${fontSizes[size]} font-semibold ${color.text} select-none leading-none`}>
          {getInitials(profile.display_name)}
        </span>
      )}
    </div>
  )
}
