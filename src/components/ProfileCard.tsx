import { Link } from 'react-router-dom'
import type { Profile } from '../types/supabase'
import { generateAvatar } from '../lib/avatarGenerator'

interface ProfileCardProps {
  profile: Profile
  /** Link to their public profile page. Defaults to true. */
  linkable?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export default function ProfileCard({ profile, linkable = true, size = 'md' }: ProfileCardProps) {
  const avatarSizes = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-16 h-16' }
  const textSizes = { sm: 'text-sm', md: 'text-sm', lg: 'text-base' }

  const avatar = (
    <div
      className={`${avatarSizes[size]} rounded-full flex items-center justify-center shrink-0 overflow-hidden bg-gray-100 dark:bg-gray-700`}
    >
      <img
        src={profile.avatar_url || generateAvatar(profile.display_name)}
        alt={profile.display_name}
        className="w-full h-full object-cover"
        loading="lazy"
      />
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

  return (
    <div
      className={`${sizes[size]} rounded-full flex items-center justify-center shrink-0 overflow-hidden bg-gray-100 dark:bg-gray-700 ${className}`}
    >
      <img
        src={profile.avatar_url || generateAvatar(profile.display_name)}
        alt={profile.display_name}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </div>
  )
}
