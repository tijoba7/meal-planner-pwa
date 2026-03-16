import { useRef, useState } from 'react'
import { Camera, Repeat2, X } from 'lucide-react'
import { useCreateRepostMutation } from '../../hooks/useReposts'

interface RepostComposerProps {
  recipeId: string
  recipeName: string
  recipeImage?: string
  onClose: () => void
}

/**
 * Bottom-sheet dialog for creating a repost of a recipe.
 * Users can add an optional photo (e.g. "I made this!") and a caption.
 */
export default function RepostComposer({
  recipeId,
  recipeName,
  recipeImage,
  onClose,
}: RepostComposerProps) {
  const [caption, setCaption] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const mutation = useCreateRepostMutation()

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

  async function handleSubmit() {
    mutation.mutate(
      { recipeId, caption: caption.trim() || undefined, imageFile: imageFile ?? undefined },
      { onSuccess: onClose }
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-t-2xl shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Repost recipe"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Repeat2 size={18} className="text-green-600 dark:text-green-400" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              Repost recipe
            </h3>
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
          {recipeImage ? (
            <img
              src={recipeImage}
              alt={recipeName}
              className="w-12 h-12 rounded-lg object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
              <span className="text-lg">🍽️</span>
            </div>
          )}
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 flex-1">
            {recipeName}
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
          <p className="text-right text-[10px] text-gray-400 mt-0.5">
            {caption.length}/500
          </p>
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

        {/* Submit */}
        <div className="px-4 pb-4 pt-2">
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            {mutation.isPending ? 'Reposting...' : 'Repost'}
          </button>
        </div>

        <div className="pb-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  )
}
