import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  UsersRound,
  Rss,
  Users,
  Plus,
  Trash2,
  LogOut,
  UserMinus,
  Crown,
  Loader2,
  ChevronLeft,
  Settings,
  X,
  Heart,
  Star,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { isSupabaseAvailable } from '../lib/supabase'
import { Avatar } from '../components/ProfileCard'
import {
  getGroup,
  getGroupMembers,
  getMyGroupRole,
  getGroupFeed,
  inviteMember,
  removeMember,
  updateMemberRole,
  leaveGroup,
  updateGroup,
  deleteGroup,
  shareRecipeToGroup,
  removeRecipeFromGroup,
  getGroupRecipeIds,
  type GroupMemberWithProfile,
} from '../lib/groupService'
import { getFriends } from '../lib/friendshipService'
import { getEngagementStats, type EngagementStats } from '../lib/engagementService'
import { durationToMinutes } from '../lib/db'
import { supabase } from '../lib/supabase'
import type { Group } from '../types/supabase'
import type { CloudRecipeWithAuthor } from '../lib/recipeShareService'

// ─── Recipe card (group feed) ─────────────────────────────────────────────────

function GroupRecipeCard({
  item,
  engagement,
  isAdmin,
  onRemove,
}: {
  item: CloudRecipeWithAuthor
  engagement?: EngagementStats
  isAdmin: boolean
  onRemove: (id: string) => void
}) {
  const recipe = item.data
  const prepMins = durationToMinutes(recipe.prepTime)
  const cookMins = durationToMinutes(recipe.cookTime)
  const [removing, setRemoving] = useState(false)

  return (
    <li className="flex gap-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <Link to={`/shared/${item.id}`} className="flex gap-3 flex-1 min-w-0 hover:opacity-90">
        {recipe.image && (
          <img
            src={recipe.imageThumbnailUrl ?? recipe.image}
            alt={recipe.name}
            className="w-14 h-14 shrink-0 rounded-lg object-cover bg-gray-100 dark:bg-gray-700"
            loading="lazy"
            decoding="async"
          />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-100 leading-tight">
            {recipe.name}
          </h3>
          <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
            by {item.profiles?.display_name ?? 'Unknown'}
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 dark:text-gray-500 flex-wrap">
            <span>{prepMins + cookMins} min</span>
            {engagement && engagement.likeCount > 0 && (
              <>
                <span>·</span>
                <span className="flex items-center gap-0.5">
                  <Heart size={9} className="text-red-400" fill="currentColor" />
                  {engagement.likeCount}
                </span>
              </>
            )}
            {engagement && engagement.avgRating !== null && (
              <>
                <span>·</span>
                <span className="flex items-center gap-0.5">
                  <Star size={9} className="text-yellow-400" fill="currentColor" />
                  {engagement.avgRating}
                </span>
              </>
            )}
          </div>
        </div>
      </Link>
      {isAdmin && (
        <button
          onClick={async () => {
            setRemoving(true)
            await onRemove(item.id)
            setRemoving(false)
          }}
          disabled={removing}
          title="Remove from group"
          className="shrink-0 self-start p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
        >
          {removing ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
        </button>
      )}
    </li>
  )
}

// ─── Member card ──────────────────────────────────────────────────────────────

function MemberCard({
  member,
  isCurrentUser,
  isAdmin,
  onRemove,
  onToggleRole,
}: {
  member: GroupMemberWithProfile
  isCurrentUser: boolean
  isAdmin: boolean
  onRemove: (userId: string) => void
  onToggleRole: (userId: string, newRole: 'admin' | 'member') => void
}) {
  const [busy, setBusy] = useState<'remove' | 'role' | null>(null)

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
      <Link to={`/users/${member.user_id}`}>
        <Avatar profile={member.profile} size="md" />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Link
            to={`/users/${member.user_id}`}
            className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:underline truncate"
          >
            {member.profile.display_name}
          </Link>
          {member.role === 'admin' && (
            <Crown size={11} className="text-yellow-500 shrink-0" fill="currentColor" />
          )}
          {isCurrentUser && <span className="text-xs text-gray-400 dark:text-gray-500">(you)</span>}
        </div>
        {member.profile.bio && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{member.profile.bio}</p>
        )}
      </div>

      {/* Admin actions (hidden for self) */}
      {isAdmin && !isCurrentUser && (
        <div className="shrink-0 flex gap-1.5">
          <button
            onClick={async () => {
              setBusy('role')
              await onToggleRole(member.user_id, member.role === 'admin' ? 'member' : 'admin')
              setBusy(null)
            }}
            disabled={busy !== null}
            title={member.role === 'admin' ? 'Demote to member' : 'Promote to admin'}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400 hover:border-yellow-300 hover:text-yellow-600 transition-colors disabled:opacity-50"
          >
            {busy === 'role' ? <Loader2 size={11} className="animate-spin" /> : <Crown size={11} />}
            {member.role === 'admin' ? 'Demote' : 'Promote'}
          </button>
          <button
            onClick={async () => {
              setBusy('remove')
              await onRemove(member.user_id)
              setBusy(null)
            }}
            disabled={busy !== null}
            title="Remove member"
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400 hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-50"
          >
            {busy === 'remove' ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <UserMinus size={11} />
            )}
            Remove
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Share recipe modal ───────────────────────────────────────────────────────

function ShareRecipeModal({
  groupId,
  userId,
  onDone,
  onClose,
}: {
  groupId: string
  userId: string
  onDone: () => void
  onClose: () => void
}) {
  const [recipes, setRecipes] = useState<CloudRecipeWithAuthor[]>([])
  const [shared, setShared] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    Promise.all([
      supabase
        .from('recipes_cloud')
        .select('*, profiles(display_name, avatar_url)')
        .eq('author_id', userId)
        .neq('visibility', 'private')
        .order('updated_at', { ascending: false }),
      getGroupRecipeIds(groupId),
    ]).then(([{ data }, sharedIds]) => {
      setRecipes((data as unknown as CloudRecipeWithAuthor[]) ?? [])
      setShared(sharedIds)
      setLoading(false)
    })
  }, [groupId, userId])

  async function handleShare(recipeId: string) {
    setSharing(recipeId)
    setError('')
    const { error: err } = await shareRecipeToGroup(groupId, recipeId, userId)
    if (err) {
      setError(err.message)
    } else {
      setShared((prev) => new Set([...prev, recipeId]))
      onDone()
    }
    setSharing(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[80vh] animate-slide-up sm:animate-scale-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Share a recipe
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 size={22} className="animate-spin text-gray-400" />
            </div>
          ) : recipes.length === 0 ? (
            <p className="text-sm text-center text-gray-400 dark:text-gray-500 py-10">
              No published recipes to share. Publish a recipe first.
            </p>
          ) : (
            <ul className="space-y-2">
              {recipes.map((r) => {
                const alreadyShared = shared.has(r.id)
                return (
                  <li
                    key={r.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800"
                  >
                    {r.data.image && (
                      <img
                        src={r.data.imageThumbnailUrl ?? r.data.image}
                        alt={r.data.name}
                        className="w-10 h-10 rounded-lg object-cover bg-gray-100 dark:bg-gray-700 shrink-0"
                        loading="lazy"
                      />
                    )}
                    <p className="flex-1 min-w-0 text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                      {r.data.name}
                    </p>
                    <button
                      onClick={() => handleShare(r.id)}
                      disabled={alreadyShared || sharing === r.id}
                      className={`shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                        alreadyShared
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                          : 'bg-green-700 text-white hover:bg-green-800'
                      }`}
                    >
                      {sharing === r.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : alreadyShared ? (
                        'Shared'
                      ) : (
                        'Share'
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
        </div>
      </div>
    </div>
  )
}

// ─── Invite member modal ──────────────────────────────────────────────────────

function InviteMemberModal({
  groupId,
  userId,
  existingMemberIds,
  onInvited,
  onClose,
}: {
  groupId: string
  userId: string
  existingMemberIds: Set<string>
  onInvited: () => void
  onClose: () => void
}) {
  const [friends, setFriends] = useState<
    { id: string; display_name: string; avatar_url: string | null; bio: string | null }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState<string | null>(null)
  const [invited, setInvited] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')

  useEffect(() => {
    getFriends(userId).then((fs) => {
      setFriends(fs.map((f) => f.profile))
      setLoading(false)
    })
  }, [userId])

  async function handleInvite(friendId: string) {
    setInviting(friendId)
    setError('')
    const { error: err } = await inviteMember(groupId, friendId)
    if (err) {
      setError(err.message)
    } else {
      setInvited((prev) => new Set([...prev, friendId]))
      onInvited()
    }
    setInviting(null)
  }

  const eligible = friends.filter((f) => !existingMemberIds.has(f.id))

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[80vh] animate-slide-up sm:animate-scale-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Invite friends
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 size={22} className="animate-spin text-gray-400" />
            </div>
          ) : eligible.length === 0 ? (
            <p className="text-sm text-center text-gray-400 dark:text-gray-500 py-10">
              All your friends are already in this group.
            </p>
          ) : (
            <ul className="space-y-2">
              {eligible.map((f) => {
                const alreadyInvited = invited.has(f.id)
                return (
                  <li
                    key={f.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700"
                  >
                    <Avatar profile={f} size="md" />
                    <p className="flex-1 min-w-0 text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                      {f.display_name}
                    </p>
                    <button
                      onClick={() => handleInvite(f.id)}
                      disabled={alreadyInvited || inviting === f.id}
                      className={`shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                        alreadyInvited
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                          : 'bg-green-700 text-white hover:bg-green-800'
                      }`}
                    >
                      {inviting === f.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : alreadyInvited ? (
                        'Added'
                      ) : (
                        'Add'
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
        </div>
      </div>
    </div>
  )
}

// ─── Edit group modal ─────────────────────────────────────────────────────────

function EditGroupModal({
  group,
  onSaved,
  onClose,
}: {
  group: Group
  onSaved: (updated: Partial<Group>) => void
  onClose: () => void
}) {
  const [name, setName] = useState(group.name)
  const [description, setDescription] = useState(group.description ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (name.trim().length === 0) return
    setBusy(true)
    const { error: err } = await updateGroup(group.id, { name, description: description || null })
    if (err) {
      setError(err.message)
      setBusy(false)
      return
    }
    onSaved({ name: name.trim(), description: description.trim() || null })
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl p-6 shadow-xl animate-slide-up sm:animate-scale-in">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Edit group</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || name.trim().length === 0}
              className="flex-1 py-2 rounded-xl bg-green-700 text-white text-sm font-medium hover:bg-green-800 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'feed' | 'members'

export default function GroupDetailPage() {
  const { id: groupId } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const supAvailable = isSupabaseAvailable()

  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<GroupMemberWithProfile[]>([])
  const [feed, setFeed] = useState<CloudRecipeWithAuthor[]>([])
  const [engagementMap, setEngagementMap] = useState<Record<string, EngagementStats>>({})
  const [userRole, setUserRole] = useState<'admin' | 'member' | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('feed')

  const [showShareRecipe, setShowShareRecipe] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [leaveBusy, setLeaveBusy] = useState(false)

  const loadAll = useCallback(async () => {
    if (!groupId || !user || !supAvailable) {
      setLoading(false)
      return
    }

    const [g, mems, role, recipes] = await Promise.all([
      getGroup(groupId),
      getGroupMembers(groupId),
      getMyGroupRole(groupId, user.id),
      getGroupFeed(groupId),
    ])

    if (!g) {
      navigate('/groups', { replace: true })
      return
    }

    setGroup(g)
    setMembers(mems)
    setUserRole(role)
    setFeed(recipes)
    setLoading(false)

    if (recipes.length > 0) {
      getEngagementStats(recipes.map((r) => r.id)).then(setEngagementMap)
    }
  }, [groupId, user, supAvailable, navigate])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  if (!supAvailable || !user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center text-gray-500 text-sm">
        <p>{!supAvailable ? 'Connect to Supabase to use groups.' : 'Sign in to view groups.'}</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={28} className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (!group) return null

  const isAdmin = userRole === 'admin'
  const memberIds = new Set(members.map((m) => m.user_id))

  const tabClass = (t: Tab) =>
    `flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      tab === t
        ? 'border-green-600 text-green-700 dark:text-green-400'
        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
    }`

  async function handleLeave() {
    if (!window.confirm(`Leave "${group!.name}"?`)) return
    setLeaveBusy(true)
    await leaveGroup(group!.id, user!.id)
    navigate('/groups')
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${group!.name}"? This cannot be undone.`)) return
    setDeleteBusy(true)
    await deleteGroup(group!.id)
    navigate('/groups')
  }

  async function handleRemoveRecipe(recipeId: string) {
    await removeRecipeFromGroup(group!.id, recipeId)
    setFeed((prev) => prev.filter((r) => r.id !== recipeId))
  }

  async function handleRemoveMember(userId: string) {
    await removeMember(group!.id, userId)
    setMembers((prev) => prev.filter((m) => m.user_id !== userId))
  }

  async function handleToggleRole(userId: string, newRole: 'admin' | 'member') {
    await updateMemberRole(group!.id, userId, newRole)
    setMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, role: newRole } : m)))
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Link
          to="/groups"
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <ChevronLeft size={18} className="text-gray-500 dark:text-gray-400" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
            {group.name}
          </h1>
          {group.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{group.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isAdmin && (
            <button
              onClick={() => setShowEdit(true)}
              title="Edit group"
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Settings size={16} strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setShowShareRecipe(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-700 text-white text-sm font-medium hover:bg-green-800 transition-colors"
        >
          <Plus size={14} strokeWidth={2} />
          Share recipe
        </button>
        {isAdmin && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Users size={14} strokeWidth={1.75} />
            Invite
          </button>
        )}
        <div className="flex-1" />
        {isAdmin ? (
          <button
            onClick={handleDelete}
            disabled={deleteBusy}
            title="Delete group"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
          >
            {deleteBusy ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Trash2 size={13} strokeWidth={1.75} />
            )}
            Delete
          </button>
        ) : (
          <button
            onClick={handleLeave}
            disabled={leaveBusy}
            title="Leave group"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-500 dark:text-gray-400 hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-50"
          >
            {leaveBusy ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <LogOut size={13} strokeWidth={1.75} />
            )}
            Leave
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-5 -mx-4 px-4">
        <button onClick={() => setTab('feed')} className={tabClass('feed')}>
          <Rss size={14} strokeWidth={1.75} />
          Recipes
          {feed.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300">
              {feed.length}
            </span>
          )}
        </button>
        <button onClick={() => setTab('members')} className={tabClass('members')}>
          <UsersRound size={14} strokeWidth={1.75} />
          Members
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300">
            {members.length}
          </span>
        </button>
      </div>

      {/* Feed tab */}
      {tab === 'feed' &&
        (feed.length === 0 ? (
          <div className="text-center py-14">
            <Rss
              size={32}
              strokeWidth={1.25}
              className="mx-auto text-gray-300 dark:text-gray-600 mb-3"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No recipes shared yet.</p>
            <button
              onClick={() => setShowShareRecipe(true)}
              className="text-sm text-green-600 dark:text-green-400 hover:underline"
            >
              Share the first recipe
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {feed.map((item) => (
              <GroupRecipeCard
                key={item.id}
                item={item}
                engagement={engagementMap[item.id]}
                isAdmin={isAdmin}
                onRemove={handleRemoveRecipe}
              />
            ))}
          </ul>
        ))}

      {/* Members tab */}
      {tab === 'members' && (
        <div className="space-y-2">
          {members.map((m) => (
            <MemberCard
              key={m.user_id}
              member={m}
              isCurrentUser={m.user_id === user.id}
              isAdmin={isAdmin}
              onRemove={handleRemoveMember}
              onToggleRole={handleToggleRole}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showShareRecipe && (
        <ShareRecipeModal
          groupId={group.id}
          userId={user.id}
          onDone={() => {
            loadAll()
          }}
          onClose={() => setShowShareRecipe(false)}
        />
      )}
      {showInvite && (
        <InviteMemberModal
          groupId={group.id}
          userId={user.id}
          existingMemberIds={memberIds}
          onInvited={() => {
            getGroupMembers(group.id).then(setMembers)
          }}
          onClose={() => setShowInvite(false)}
        />
      )}
      {showEdit && (
        <EditGroupModal
          group={group}
          onSaved={(updates) => {
            setGroup((prev) => (prev ? { ...prev, ...updates } : prev))
            setShowEdit(false)
          }}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  )
}
