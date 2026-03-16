import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  Camera,
  Check,
  Loader2,
  Pencil,
  Sparkles,
  X,
  Users,
  Link2,
  Copy,
  RefreshCw,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useProfile } from '../contexts/ProfileContext'
import { useAuth } from '../contexts/AuthContext'
import { Avatar } from '../components/ProfileCard'
import { getFriendCount, getOrCreateInviteLink, revokeInviteLink } from '../lib/friendshipService'

const DIETARY_OPTIONS = [
  'Vegetarian',
  'Vegan',
  'Gluten-free',
  'Dairy-free',
  'Nut-free',
  'Keto',
  'Paleo',
  'Kosher',
  'Halal',
  'Low-sodium',
  'Low-carb',
]

export default function ProfilePage() {
  const { user } = useAuth()
  const { profile, loading, updateProfile, uploadAvatar } = useProfile()

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Form state (mirrors profile fields)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [dietary, setDietary] = useState<string[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Social stats
  const [friendCount, setFriendCount] = useState(0)
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!user) return
    getFriendCount(user.id).then(setFriendCount)
  }, [user])

  async function handleGetInviteLink() {
    if (!user) return
    setInviteLoading(true)
    const { token } = await getOrCreateInviteLink(user.id)
    setInviteToken(token)
    setInviteLoading(false)
  }

  async function handleRevokeInvite() {
    if (!user) return
    setInviteLoading(true)
    await revokeInviteLink(user.id)
    setInviteToken(null)
    setInviteLoading(false)
  }

  function handleCopyInvite() {
    if (!inviteToken) return
    const url = `${window.location.origin}/invite/${inviteToken}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Detect "fresh" profile (trigger created it with just email prefix, no bio/avatar)
  const isNewProfile =
    profile && !profile.bio && !profile.avatar_url && profile.dietary_preferences.length === 0

  function startEditing() {
    if (!profile) return
    setDisplayName(profile.display_name)
    setBio(profile.bio ?? '')
    setDietary([...profile.dietary_preferences])
    setError(null)
    setSuccess(false)
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
    setError(null)
  }

  function toggleDietary(pref: string) {
    setDietary((prev) => (prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref]))
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!displayName.trim()) {
      setError('Display name is required.')
      return
    }
    setSaving(true)
    setError(null)
    const { error } = await updateProfile({
      display_name: displayName.trim(),
      bio: bio.trim() || null,
      dietary_preferences: dietary,
    })
    setSaving(false)
    if (error) {
      setError(error.message)
    } else {
      setEditing(false)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  async function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.')
      return
    }
    setUploadingAvatar(true)
    setError(null)
    const { error } = await uploadAvatar(file)
    setUploadingAvatar(false)
    if (error) setError(error.message)
    // Reset file input so the same file can be re-selected
    e.target.value = ''
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center text-gray-500">
        <p>Sign in to view your profile.</p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center text-gray-500">
        <p>Profile not found.</p>
      </div>
    )
  }

  const inviteUrl = inviteToken ? `${window.location.origin}/invite/${inviteToken}` : null

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* Onboarding banner */}
      {isNewProfile && !editing && (
        <div className="mb-6 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 flex gap-3">
          <Sparkles
            size={20}
            className="text-green-600 dark:text-green-400 shrink-0 mt-0.5"
            strokeWidth={1.75}
          />
          <div>
            <p className="text-sm font-medium text-green-800 dark:text-green-300">
              Welcome to Mise!
            </p>
            <p className="text-sm text-green-700 dark:text-green-400 mt-0.5">
              Add a photo, bio, and dietary preferences so others can find and connect with you.
            </p>
            <button
              onClick={startEditing}
              className="mt-2 text-sm font-medium text-green-700 dark:text-green-400 underline underline-offset-2 hover:text-green-800 dark:hover:text-green-300"
            >
              Complete your profile
            </button>
          </div>
        </div>
      )}

      {/* Avatar */}
      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="relative">
          <Avatar profile={profile} size="xl" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            aria-label="Upload avatar"
            className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 shadow flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            {uploadingAvatar ? (
              <Loader2 size={14} className="animate-spin text-gray-500 dark:text-gray-400" />
            ) : (
              <Camera size={14} strokeWidth={1.75} className="text-gray-600 dark:text-gray-300" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleAvatarChange}
          />
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400 dark:text-gray-500">{user.email}</p>
        </div>
        {/* Friend count */}
        <Link
          to="/friends"
          className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-green-700 dark:hover:text-green-400 transition-colors"
        >
          <Users size={14} strokeWidth={1.75} />
          <span className="font-medium">{friendCount}</span>
          <span className="text-gray-400 dark:text-gray-500">
            {friendCount === 1 ? 'friend' : 'friends'}
          </span>
        </Link>
      </div>

      {/* Profile info / edit form */}
      {editing ? (
        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label
              htmlFor="profile-display-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
            >
              Display name{' '}
              <span className="text-red-500" aria-hidden="true">
                *
              </span>
              <span className="sr-only">(required)</span>
            </label>
            <input
              id="profile-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={60}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Your name"
            />
          </div>

          <div>
            <label
              htmlFor="profile-bio"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
            >
              Bio
            </label>
            <textarea
              id="profile-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={200}
              rows={3}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              placeholder="Tell others a bit about yourself and your cooking style…"
              aria-describedby="profile-bio-count"
            />
            <p
              id="profile-bio-count"
              className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-right"
              aria-live="polite"
            >
              {bio.length}/200
            </p>
          </div>

          <div>
            <p
              id="dietary-label"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Dietary preferences
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="dietary-label">
              {DIETARY_OPTIONS.map((pref) => {
                const active = dietary.includes(pref)
                return (
                  <button
                    key={pref}
                    type="button"
                    onClick={() => toggleDietary(pref)}
                    aria-pressed={active}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-green-600 border-green-600 text-white'
                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-400'
                    }`}
                  >
                    {pref}
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} strokeWidth={2} />
              )}
              Save
            </button>
            <button
              type="button"
              onClick={cancelEditing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <X size={14} strokeWidth={2} />
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {profile.display_name}
              </h2>
              {profile.bio && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{profile.bio}</p>
              )}
            </div>
            <button
              onClick={startEditing}
              aria-label="Edit profile"
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Pencil size={13} strokeWidth={1.75} />
              Edit
            </button>
          </div>

          {profile.dietary_preferences.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Dietary preferences
              </p>
              <div className="flex flex-wrap gap-1.5">
                {profile.dietary_preferences.map((pref) => (
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

          {success && (
            <p className="text-sm text-green-600 flex items-center gap-1.5">
              <Check size={14} strokeWidth={2} />
              Profile saved.
            </p>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          {/* Invite link section */}
          <div className="border-t border-gray-100 dark:border-gray-700 pt-5">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Link2 size={12} strokeWidth={1.75} />
              Invite link
            </p>
            {!inviteToken ? (
              <button
                onClick={handleGetInviteLink}
                disabled={inviteLoading}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {inviteLoading ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Link2 size={13} strokeWidth={1.75} />
                )}
                Generate invite link
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <p className="flex-1 text-xs text-gray-500 dark:text-gray-400 truncate font-mono">
                    {inviteUrl}
                  </p>
                  <button
                    onClick={handleCopyInvite}
                    title="Copy link"
                    className="shrink-0 flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                  >
                    {copied ? (
                      <Check size={12} strokeWidth={2} />
                    ) : (
                      <Copy size={12} strokeWidth={1.75} />
                    )}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <button
                  onClick={handleRevokeInvite}
                  disabled={inviteLoading}
                  className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors disabled:opacity-50"
                >
                  {inviteLoading ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <RefreshCw size={11} strokeWidth={1.75} />
                  )}
                  Revoke link
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
