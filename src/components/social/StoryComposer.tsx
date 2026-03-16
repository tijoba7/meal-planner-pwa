import { useEffect, useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'
import { useCreateStoryMutation } from '../../hooks/useStories'

interface StoryComposerProps {
  onClose: () => void
  onSuccess?: () => void
}

/**
 * Bottom-sheet dialog for creating a new cooking story.
 * Supports image file upload with a caption.
 */
export default function StoryComposer({ onClose, onSuccess }: StoryComposerProps) {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const createStory = useCreateStoryMutation()

  // Revoke object URL on cleanup to avoid memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
    setError(null)
  }

  function handleRemoveFile() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(null)
    setPreviewUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setError(null)

    try {
      await createStory.mutateAsync({ file, caption: caption.trim() || undefined })
      onSuccess?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post story. Try again.')
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white dark:bg-gray-900 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="New story"
      >
        {/* Pull handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden" aria-hidden="true">
          <div className="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">New Story</h3>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Cancel"
          >
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Image picker */}
          {previewUrl ? (
            <div className="relative aspect-[3/4] max-h-72 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden">
              <img src={previewUrl} alt="Story preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={handleRemoveFile}
                className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                aria-label="Remove image"
              >
                <X size={14} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2.5 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl py-12 cursor-pointer hover:border-green-400 dark:hover:border-green-600 transition-colors group">
              <Camera
                size={28}
                strokeWidth={1.5}
                className="text-gray-400 dark:text-gray-500 group-hover:text-green-500 transition-colors"
                aria-hidden="true"
              />
              <span className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                Tap to add a photo
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                aria-label="Upload story image"
              />
            </label>
          )}

          {/* Caption */}
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a caption…"
            maxLength={300}
            rows={2}
            className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />

          {error && (
            <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pb-[env(safe-area-inset-bottom)]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || createStory.isPending}
              className="flex-1 bg-green-600 disabled:bg-gray-200 dark:disabled:bg-gray-700 text-white disabled:text-gray-400 dark:disabled:text-gray-500 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-green-700 disabled:cursor-not-allowed transition-colors"
            >
              {createStory.isPending ? 'Posting…' : 'Share Story'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
