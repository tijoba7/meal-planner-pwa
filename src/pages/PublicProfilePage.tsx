import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Loader2, ChevronLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Avatar } from '../components/ProfileCard'
import type { Profile } from '../types/supabase'

export default function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

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
        <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">Profile not found</p>
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

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-6"
      >
        <ChevronLeft size={14} />
        Back
      </Link>

      <div className="flex flex-col items-center gap-4 mb-8">
        <Avatar profile={profile} size="xl" />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{profile.display_name}</h1>
          {profile.bio && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 max-w-sm">{profile.bio}</p>
          )}
        </div>
      </div>

      {profile.dietary_preferences.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Dietary preferences
          </p>
          <div className="flex flex-wrap gap-1.5">
            {profile.dietary_preferences.map(pref => (
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
