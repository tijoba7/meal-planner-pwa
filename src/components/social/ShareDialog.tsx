import { useState, type ElementType } from 'react'
import { X, Link2, Users, Globe, Lock, Check } from 'lucide-react'
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
    description: 'Anyone using Mise can discover it',
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
 *
 * @example
 * <ShareDialog
 *   recipeName="Pasta Carbonara"
 *   shareUrl={`https://mise.app/recipes/${recipe.id}`}
 *   currentVisibility={recipe.visibility}
 *   onVisibilityChange={(v) => updateVisibility(recipe.id, v)}
 *   onClose={() => setShowShare(false)}
 * />
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
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-200 flex items-center justify-between">
          <div className="min-w-0 mr-3">
            <h3 className="font-bold text-gray-800">Share Recipe</h3>
            <p className="text-xs text-gray-400 truncate mt-0.5">{recipeName}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close share dialog"
          >
            <X size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-5">
          {/* Copy link */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
              Share link
            </p>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
              <Link2
                size={14}
                strokeWidth={2}
                className="text-gray-400 shrink-0"
                aria-hidden="true"
              />
              <span className="flex-1 text-sm text-gray-600 truncate">{shareUrl}</span>
              <button
                onClick={handleCopy}
                aria-label={copied ? 'Link copied' : 'Copy link'}
                className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  copied
                    ? 'bg-green-50 text-green-600'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
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
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    aria-pressed={visibility === value}
                  >
                    <Icon
                      size={16}
                      strokeWidth={1.75}
                      className={visibility === value ? 'text-green-600' : 'text-gray-500'}
                      aria-hidden="true"
                    />
                    <div className="flex-1">
                      <p
                        className={`text-sm font-medium ${
                          visibility === value ? 'text-green-700' : 'text-gray-700'
                        }`}
                      >
                        {label}
                      </p>
                      <p className="text-xs text-gray-400">{description}</p>
                    </div>
                    {visibility === value && (
                      <Check
                        size={16}
                        strokeWidth={2.5}
                        className="text-green-600 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full border border-gray-200 text-gray-600 text-sm font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
