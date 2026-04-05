import { useState, type ElementType } from 'react'
import { Link2, Users, Globe, Lock, Check } from 'lucide-react'
import { BottomSheet } from '../ui/BottomSheet'
import type { RecipeVisibility } from '../../types/supabase'

interface VisibilityOption {
  value: RecipeVisibility
  icon: ElementType
  label: string
  description: string
}

const VISIBILITY_OPTIONS: VisibilityOption[] = [
  { value: 'private', icon: Lock, label: 'Only me', description: 'Only you can see this recipe' },
  {
    value: 'friends',
    icon: Users,
    label: 'Friends',
    description: 'Your friends can see and save it',
  },
  {
    value: 'public',
    icon: Globe,
    label: 'Everyone',
    description: 'Anyone using mise can discover it',
  },
]

interface ShareDialogProps {
  recipeName: string
  shareUrl: string
  currentVisibility: RecipeVisibility
  /** Called when the user picks a new visibility. Omit to hide the visibility section. */
  onVisibilityChange?: (visibility: RecipeVisibility) => Promise<void>
  onClose: () => void
}

/**
 * Bottom sheet (mobile) / centered modal (sm+) for sharing a recipe.
 * Includes copy-link and optional visibility selector.
 */
export default function ShareDialog({
  recipeName,
  shareUrl,
  currentVisibility,
  onVisibilityChange,
  onClose,
}: ShareDialogProps) {
  const [copied, setCopied] = useState(false)
  const [visibility, setVisibility] = useState<RecipeVisibility>(currentVisibility)
  const [saving, setSaving] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleVisibilityChange(v: RecipeVisibility) {
    setVisibility(v)
    if (!onVisibilityChange) return
    setSaving(true)
    try {
      await onVisibilityChange(v)
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open onClose={onClose} title="Share Recipe">
      {/* Recipe name sub-label */}
      <p className="px-5 -mt-2 pb-1 text-xs text-gray-400 truncate">{recipeName}</p>

      <div className="overflow-y-auto flex-1 p-4 space-y-5 max-h-[60vh] sm:max-h-[50vh]">
        {/* Copy link */}
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
            Share link
          </p>
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5">
            <Link2
              size={14}
              strokeWidth={2}
              className="text-gray-400 shrink-0"
              aria-hidden="true"
            />
            <span className="flex-1 text-sm text-gray-600 dark:text-gray-300 truncate">{shareUrl}</span>
            <button
              onClick={handleCopy}
              aria-label={copied ? 'Link copied' : 'Copy link'}
              className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                copied
                  ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                  : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              {copied ? (
                <span className="flex items-center gap-1">
                  <Check size={12} strokeWidth={2.5} aria-hidden="true" />
                  Copied
                </span>
              ) : (
                'Copy'
              )}
            </button>
          </div>
        </div>

        {/* Visibility selector */}
        {onVisibilityChange && (
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
              Who can see this
            </p>
            <div className="space-y-1.5">
              {VISIBILITY_OPTIONS.map(({ value, icon: Icon, label, description }) => (
                <button
                  key={value}
                  onClick={() => handleVisibilityChange(value)}
                  disabled={saving}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border text-left transition-colors disabled:opacity-60 ${
                    visibility === value
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                  aria-pressed={visibility === value}
                >
                  <Icon
                    size={16}
                    strokeWidth={1.75}
                    className={visibility === value ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}
                    aria-hidden="true"
                  />
                  <div className="flex-1">
                    <p
                      className={`text-sm font-medium ${
                        visibility === value ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      {label}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{description}</p>
                  </div>
                  {visibility === value && (
                    <Check
                      size={16}
                      strokeWidth={2.5}
                      className="text-green-600 dark:text-green-400 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={onClose}
          className="w-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Done
        </button>
      </div>
    </BottomSheet>
  )
}
