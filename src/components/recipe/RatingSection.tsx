import StarRating from '../ui/StarRating'

interface RatingSectionProps {
  rating: { userScore: number | null; avgScore: number | null; ratingCount: number }
  isLoggedIn: boolean
  onRate?: (score: number) => void
}

export default function RatingSection({ rating, isLoggedIn, onRate }: RatingSectionProps) {
  if (rating.avgScore === null && !isLoggedIn) return null

  return (
    <div className="flex items-center gap-3 mb-3">
      <StarRating
        value={rating.userScore}
        onChange={isLoggedIn ? onRate : undefined}
        readOnly={!isLoggedIn}
        size="md"
      />
      {rating.avgScore !== null ? (
        <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">
          {rating.avgScore}
          <span className="text-gray-400 dark:text-gray-500 font-normal ml-1">
            ({rating.ratingCount} {rating.ratingCount === 1 ? 'rating' : 'ratings'})
          </span>
        </span>
      ) : isLoggedIn ? (
        <span className="text-xs text-gray-400 dark:text-gray-500">Be the first to rate</span>
      ) : null}
    </div>
  )
}
