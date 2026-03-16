import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { UsersRound, Plus, ChevronRight, Loader2, Globe } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { isSupabaseAvailable } from '../lib/supabase'
import { createGroup, getMyGroups, type GroupWithMeta } from '../lib/groupService'

// ─── Create group dialog ──────────────────────────────────────────────────────

function CreateGroupDialog({
  onCreated,
  onClose,
}: {
  onCreated: (group: GroupWithMeta) => void
  onClose: () => void
}) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || name.trim().length === 0) return
    setBusy(true)
    setError('')
    const { data, error: err } = await createGroup(name, description || null, user.id)
    if (err || !data) {
      setError(err?.message ?? 'Failed to create group.')
      setBusy(false)
      return
    }
    onCreated({ ...data, memberCount: 1, userRole: 'admin' })
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Create Group
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="e.g. Family, Keto Friends"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
              autoFocus
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
              placeholder="What is this group about?"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || name.trim().length === 0}
              className="flex-1 py-2 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Group card ───────────────────────────────────────────────────────────────

function GroupCard({ group }: { group: GroupWithMeta }) {
  return (
    <Link
      to={`/groups/${group.id}`}
      className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:shadow-sm transition-shadow"
    >
      <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
        <UsersRound size={18} className="text-green-600 dark:text-green-400" strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{group.name}</p>
          {group.userRole === 'admin' && (
            <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-medium">
              Admin
            </span>
          )}
        </div>
        {group.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{group.description}</p>
        )}
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
        </p>
      </div>
      <ChevronRight size={16} className="text-gray-300 dark:text-gray-600 shrink-0" />
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GroupsPage() {
  const { user } = useAuth()
  const supAvailable = isSupabaseAvailable()

  const [groups, setGroups] = useState<GroupWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    if (!user || !supAvailable) {
      setLoading(false)
      return
    }
    getMyGroups(user.id).then((g) => {
      setGroups(g)
      setLoading(false)
    })
  }, [user, supAvailable])

  if (!supAvailable) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <Globe size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Connect to Supabase to use groups.
        </p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center text-gray-500">
        <p>Sign in to manage your groups.</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Groups</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
        >
          <Plus size={14} strokeWidth={2} />
          New group
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16">
          <UsersRound size={36} strokeWidth={1.25} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No groups yet.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="text-sm text-green-600 dark:text-green-400 hover:underline"
          >
            Create your first group
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => (
            <GroupCard key={g.id} group={g} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateGroupDialog
          onCreated={(g) => {
            setGroups((prev) => [g, ...prev])
            setShowCreate(false)
          }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}
