import { useState } from 'react'

interface StarRatingProps {
  value: number | null
  onChange?: (score: number) => void
  readOnly?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const SIZE = { sm: 16, md: 22, lg: 28 }

export default function StarRating({ value, onChange, readOnly = false, size = 'md' }: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const px = SIZE[size]
  const active = hovered ?? value ?? 0

  return (
    <div
      className="flex items-center gap-0.5"
      role={readOnly ? undefined : 'radiogroup'}
      aria-label={readOnly ? undefined : 'Star rating'}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= active
        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => !readOnly && setHovered(star)}
            onMouseLeave={() => !readOnly && setHovered(null)}
            aria-label={readOnly ? undefined : `${star} star${star !== 1 ? 's' : ''}`}
            aria-pressed={readOnly ? undefined : value === star}
            className={readOnly ? 'cursor-default' : 'transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-sm'}
          >
            <svg
              width={px}
              height={px}
              viewBox="0 0 24 24"
              aria-hidden="true"
              className={`transition-colors ${filled ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'}`}
            >
              <path
                fill="currentColor"
                d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01z"
              />
            </svg>
          </button>
        )
      })}
    </div>
  )
}
