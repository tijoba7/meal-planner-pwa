import { useRef, useState } from 'react'
import { Camera, Send, X, Globe, Users } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { publishRecipe, updateVisibility, type RecipeCloudMeta } from '../../lib/recipeShareService'
import { useCreateRepostMutation } from '../../hooks/useReposts'
import type { Recipe } from '../../types'
import type { RecipeVisibility } from '../../types/supabase'

interface PostComposerProps {
  recipe: Recipe
  cloudMeta: RecipeCloudMeta | null
  onClose: () => void
  /** Called after a successful post (e.g. to refresh cloud meta in parent). */
  onSuccess?: (visibility: RecipeVisibility) => void
}

type ShareVisibility = 'friends' | 'public'

const VISIBILITY_OPTIONS: { value: ShareVisibility; icon: typeof Globe; label: string }[] = [
  { value: 'public', icon: Globe, label: 'Everyone' },
  { value: 'friends', icon: Users, label: 'Friends' },
]

function initialVisibility(cloudMeta: RecipeCloudMeta | null): ShareVisibility {
  if (cloudMeta && cloudMeta.visibility !== 'private') {
    return cloudMeta.visibility as ShareVisibility
  }
  return 'friends'
}

/**
 * Bottom-sheet composer for posting your own recipe to the social feed.
 * Handles publishing the recipe to the cloud (if needed) then creating a social post.
 */
export default function PostComposer({ recipe, cloudMeta, onClose, onSuccess }: PostComposerProps) {
  const { user } = useAuth()
  const toast = useToast()
  const [caption, setCaption] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [visibility, setVisibility] = useState<ShareVisibility>(() => initialVisibility(cloudMeta))
  const [publishing, setPublishing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const repostMutation = useCreateRepostMutation()

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const url = URL.createObjectURL(file)
    setImagePreview(url)
  }

  function removeImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(null)
    setImagePreview(null)
  }

  async function handlePost() {
    if (!user) return
    setPublishing(true)
    try {
      // Ensure recipe is published with the chosen visibility
      if (!cloudMeta) {
        const { error } = await publishRecipe(recipe, user.id, visibility)
        if (error) throw error
      } else if (cloudMeta.visibility !== visibility) {
        const { error } = await updateVisibility(recipe.id, visibility)
        if (error) throw error
      }
    } catch {
      toast.error('Failed to publish recipe. Please try again.')
      setPublishing(false)
      return
    }

    // Create the social post
    repostMutation.mutate(
      { recipeId: recipe.id, caption: caption.trim() || undefined, imageFile: imageFile ?? undefined },
      {
        onSuccess: () => {
          toast.success('Posted to your feed!')
          onSuccess?.(visibility)
          onClose()
        },
        onError: () => {
          toast.error('Failed to post. Please try again.')
          setPublishing(false)
        },
      }
    )
  }

  const isPending = publishing || repostMutation.isPending

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-t-2xl shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Post recipe to feed"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Send size={18} className="text-green-600 dark:text-green-400" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Post to feed</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Cancel"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        {/* Recipe preview */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-800/50">
          {recipe.image ? (
            <img
              src={recipe.image}
              alt={recipe.name}
              className="w-12 h-12 rounded-lg object-cover shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center shrink-0">
              <span className="text-lg" aria-hidden="true">🍽️</span>
            </div>
          )}
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 flex-1">
            {recipe.name}
          </p>
        </div>

        {/* Caption */}
        <div className="px-4 pt-3">
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption (optional)..."
            maxLength={500}
            rows={3}
            className="w-full resize-none rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <p className="text-right text-[10px] text-gray-400 mt-0.5">{caption.length}/500</p>
        </div>

        {/* Image upload */}
        <div className="px-4 py-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImageSelect}
            className="hidden"
          />
          {imagePreview ? (
            <div className="relative inline-block">
              <img
                src={imagePreview}
                alt="Upload preview"
                className="h-24 rounded-lg object-cover"
              />
              <button
                onClick={removeImage}
                aria-label="Remove photo"
                className="absolute -top-2 -right-2 w-7 h-7 bg-gray-900/70 rounded-full flex items-center justify-center text-white hover:bg-gray-900 transition-colors"
              >
                <X size={14} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
            >
              <Camera size={16} strokeWidth={1.75} aria-hidden="true" />
              Add a photo
            </button>
          )}
        </div>

        {/* Visibility */}
        <div className="px-4 pb-2">
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
            Who can see this
          </p>
          <div className="flex gap-2">
            {VISIBILITY_OPTIONS.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => setVisibility(value)}
                aria-pressed={visibility === value}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                  visibility === value
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="px-4 pb-4 pt-2">
          <button
            onClick={handlePost}
            disabled={isPending}
            className="w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            {isPending ? 'Posting...' : 'Post to feed'}
          </button>
        </div>

        <div className="pb-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  )
}
