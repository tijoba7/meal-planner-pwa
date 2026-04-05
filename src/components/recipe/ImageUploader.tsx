import { Camera, X } from 'lucide-react'

interface ImageUploaderProps {
  previewUrl: string | null
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClear: () => void
}

export default function ImageUploader({
  previewUrl,
  fileInputRef,
  onFileChange,
  onClear,
}: ImageUploaderProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
        Photo
      </label>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFileChange}
        className="sr-only"
        aria-label="Upload recipe photo"
      />

      {previewUrl ? (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700">
          <img
            src={previewUrl}
            alt="Recipe photo preview"
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={onClear}
            className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors"
            aria-label="Remove photo"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Camera size={12} strokeWidth={2} />
            Change
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl py-8 flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400 hover:border-green-500 dark:hover:border-green-500 hover:text-green-700 dark:hover:text-green-400 transition-colors"
        >
          <Camera size={24} strokeWidth={1.5} />
          <span className="text-sm">Add a photo</span>
          <span className="text-xs">JPEG, PNG, WebP · up to 20 MB</span>
        </button>
      )}
    </div>
  )
}
