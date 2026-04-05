import RecipeImage from '../RecipeImage'
import { usePinchZoom } from '../../hooks/usePinchZoom'
import { DIETARY_PREFERENCES } from '../../lib/dietary'
import type { Recipe } from '../../types'

interface RecipeHeroProps {
  recipe: Recipe
  scaledServings: number
  setScaledServings: (v: number | ((prev: number) => number)) => void
  isScaled: boolean
  originalServings: number
  prepMins: number
  cookMins: number
  totalTime: number
}

export default function RecipeHero({
  recipe,
  scaledServings,
  setScaledServings,
  prepMins,
  cookMins,
  totalTime,
}: RecipeHeroProps) {
  const imgRef = usePinchZoom<HTMLDivElement>({ maxScale: 4 })

  return (
    <>
      {/* Meta */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mb-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setScaledServings((s) => Math.max(1, s - 1))}
            disabled={scaledServings <= 1}
            aria-label="Decrease servings"
            className="print:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors leading-none select-none"
          >
            −
          </button>
          <span className="text-center">
            <span className="font-medium text-gray-700 dark:text-gray-200">{scaledServings}</span>
            {' servings'}
          </span>
          <button
            onClick={() => setScaledServings((s) => s + 1)}
            aria-label="Increase servings"
            className="print:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors leading-none select-none"
          >
            +
          </button>
        </div>
        <span>·</span>
        <span>Prep {prepMins} min</span>
        <span>·</span>
        <span>Cook {cookMins} min</span>
        <span>·</span>
        <span>Total {totalTime} min</span>
      </div>

      {/* Keywords & Dietary tags */}
      {(recipe.keywords.length > 0 || (recipe.suitableForDiet?.length ?? 0) > 0) && (
        <div className="flex flex-wrap gap-1 mb-4">
          {recipe.keywords.map((tag) => (
            <span
              key={tag}
              className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs px-2 py-0.5 rounded-full"
            >
              {tag}
            </span>
          ))}
          {recipe.suitableForDiet?.map((dietId) => {
            const pref = DIETARY_PREFERENCES.find((p) => p.id === dietId)
            if (!pref) return null
            return (
              <span
                key={dietId}
                title={pref.description}
                className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs px-2 py-0.5 rounded-full"
              >
                {pref.label}
              </span>
            )
          })}
        </div>
      )}

      {/* Hero image — touch-pinch to zoom */}
      {recipe.image && (
        <div ref={imgRef} className="overflow-hidden rounded-xl mb-4 touch-none">
          <RecipeImage
            src={recipe.image}
            alt={recipe.name}
            className="w-full h-48 md:h-64"
          />
        </div>
      )}

      {/* Description */}
      {recipe.description && (
        <p className="text-gray-600 dark:text-gray-300 mb-6">{recipe.description}</p>
      )}
    </>
  )
}
