import { Check, Globe, Lock, Users, X } from 'lucide-react'
import type { RecipeVisibility } from '../../types/supabase'
import type { GroupWithMeta } from '../../lib/groupService'

interface SharePanelProps {
  visible: boolean
  onClose: () => void
  selectedVisibility: RecipeVisibility
  onVisibilityChange: (v: RecipeVisibility) => void
  userGroups: GroupWithMeta[]
  sharedGroupIds: Set<string>
  groupTogglingId: string | null
  sharing: boolean
  onGroupToggle: (groupId: string, currentlyShared: boolean) => void
  onSave: () => void
}

export default function SharePanel({
  visible,
  onClose,
  selectedVisibility,
  onVisibilityChange,
  userGroups,
  sharedGroupIds,
  groupTogglingId,
  sharing,
  onGroupToggle,
  onSave,
}: SharePanelProps) {
  if (!visible) return null

  return (
    <div className="print:hidden fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-4 z-50 animate-fade-in">
      <div
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-sm shadow-xl animate-slide-up sm:animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-panel-title"
      >
        <div className="flex items-center justify-between mb-4">
          <h4
            id="share-panel-title"
            className="text-base font-semibold text-gray-800 dark:text-gray-100"
          >
            Share recipe
          </h4>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Choose who can see this recipe.
        </p>
        <div className="space-y-2 mb-5">
          {(
            [
              { value: 'public', label: 'Public', desc: 'Anyone can discover it', Icon: Globe },
              {
                value: 'friends',
                label: 'Friends only',
                desc: 'Only your accepted friends',
                Icon: Users,
              },
              { value: 'private', label: 'Private', desc: 'Only you', Icon: Lock },
            ] as { value: RecipeVisibility; label: string; desc: string; Icon: typeof Globe }[]
          ).map(({ value, label, desc, Icon }) => (
            <button
              key={value}
              onClick={() => onVisibilityChange(value)}
              aria-pressed={selectedVisibility === value}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                selectedVisibility === value
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Icon
                size={18}
                className={
                  selectedVisibility === value
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-400 dark:text-gray-500'
                }
                aria-hidden="true"
              />
              <div>
                <p
                  className={`text-sm font-medium ${selectedVisibility === value ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-200'}`}
                >
                  {label}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{desc}</p>
              </div>
            </button>
          ))}
        </div>
        {/* Groups section — visible when non-private and user has groups */}
        {selectedVisibility !== 'private' && userGroups.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Also share to groups
            </p>
            <div className="space-y-1.5">
              {userGroups.map((group) => {
                const shared = sharedGroupIds.has(group.id)
                const busy = groupTogglingId === group.id
                return (
                  <button
                    key={group.id}
                    onClick={() => onGroupToggle(group.id, shared)}
                    disabled={busy || sharing}
                    aria-pressed={shared}
                    aria-label={`${shared ? 'Remove from' : 'Share to'} ${group.name}`}
                    className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-colors disabled:opacity-50 ${
                      shared
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        shared
                          ? 'bg-green-700 border-green-600'
                          : 'border-gray-300 dark:border-gray-500'
                      }`}
                    >
                      {shared && <Check size={10} strokeWidth={3} aria-hidden="true" />}
                    </div>
                    <span
                      className={`text-sm truncate ${shared ? 'text-green-700 dark:text-green-300 font-medium' : 'text-gray-700 dark:text-gray-200'}`}
                    >
                      {group.name}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto shrink-0">
                      {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            disabled={sharing}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={sharing}
            className="flex-1 bg-green-700 text-white text-sm font-medium py-2 rounded-lg hover:bg-green-800 transition-colors disabled:opacity-50"
          >
            {sharing ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
