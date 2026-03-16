import { useState } from 'react'

interface RecipeImageProps {
  src?: string
  alt: string
  className?: string
}

/**
 * Lazy-loaded recipe image with skeleton loading state and fallback.
 * The parent element controls sizing via className.
 */
export default function RecipeImage({ src, alt, className = '' }: RecipeImageProps) {
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)

  if (!src || errored) {
    return (
      <div
        className={`bg-gray-100 dark:bg-gray-700 flex items-center justify-center ${className}`}
        aria-hidden="true"
      >
        <span className="text-3xl select-none">🍽️</span>
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Skeleton shown until image loads */}
      {!loaded && (
        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse" />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  )
}
