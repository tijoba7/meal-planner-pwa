import { Link } from 'react-router-dom'
import type { Profile } from '../types/supabase'

// ─── Fun default avatars ─────────────────────────────────────────────────────
// Deterministic food emoji + color based on display_name hash.
// Every user gets their own "spirit food" — playful and on-brand.

const AVATAR_FOODS = [
  '🍕', '🍣', '🌮', '🍩', '🧁', '🍜', '🍔', '🥑',
  '🍪', '🧀', '🥐', '🍇', '🌶️', '🍰', '🥞', '🍱',
  '🫕', '🥨', '🍿', '🧆', '🥗', '🍝', '🥟', '🍦',
]

const AVATAR_COLORS = [
  'bg-rose-100 dark:bg-rose-900/40',
  'bg-orange-100 dark:bg-orange-900/40',
  'bg-amber-100 dark:bg-amber-900/40',
  'bg-emerald-100 dark:bg-emerald-900/40',
  'bg-teal-100 dark:bg-teal-900/40',
  'bg-cyan-100 dark:bg-cyan-900/40',
  'bg-blue-100 dark:bg-blue-900/40',
  'bg-violet-100 dark:bg-violet-900/40',
  'bg-purple-100 dark:bg-purple-900/40',
  'bg-pink-100 dark:bg-pink-900/40',
  'bg-fuchsia-100 dark:bg-fuchsia-900/40',
  'bg-indigo-100 dark:bg-indigo-900/40',
]

function hashName(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function getAvatarFood(name: string): string {
  return AVATAR_FOODS[hashName(name) % AVATAR_FOODS.length]
}

function getAvatarColor(name: string): string {
  return AVATAR_COLORS[hashName(name + '_c') % AVATAR_COLORS.length]
}

interface ProfileCardProps {
  profile: Profile
  /** Link to their public profile page. Defaults to true. */
  linkable?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export default function ProfileCard({ profile, linkable = true, size = 'md' }: ProfileCardProps) {
  const avatarSizes = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-16 h-16' }
  const emojiSizes = { sm: 'text-sm', md: 'text-base', lg: 'text-2xl' }
  const textSizes = { sm: 'text-sm', md: 'text-sm', lg: 'text-base' }

  const avatar = (
    <div
      className={`${avatarSizes[size]} rounded-full flex items-center justify-center shrink-0 overflow-hidden ${
        profile.avatar_url ? 'bg-gray-100 dark:bg-gray-700' : getAvatarColor(profile.display_name)
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
        <span className={`${emojiSizes[size]} select-none leading-none`} role="img" aria-label={profile.display_name}>
          {getAvatarFood(profile.display_name)}
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
  const emojiSizes = { xs: 'text-[10px]', sm: 'text-sm', md: 'text-base', lg: 'text-2xl', xl: 'text-4xl' }

  return (
    <div
      className={`${sizes[size]} rounded-full flex items-center justify-center shrink-0 overflow-hidden ${
        profile.avatar_url ? 'bg-gray-100 dark:bg-gray-700' : getAvatarColor(profile.display_name)
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
        <span className={`${emojiSizes[size]} select-none leading-none`} role="img" aria-label={profile.display_name}>
          {getAvatarFood(profile.display_name)}
        </span>
      )}
    </div>
  )
}
