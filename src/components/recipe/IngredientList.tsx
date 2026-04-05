import { AlertTriangle } from 'lucide-react'
import { convertUnit } from '../../lib/units'
import type { Ingredient } from '../../types'

function formatAmount(amount: number): string {
  if (amount === 0) return '0'
  const whole = Math.floor(amount)
  const decimal = amount - whole
  if (decimal < 0.01) return String(whole)

  const fractions: [number, string][] = [
    [1 / 8, '1/8'],
    [1 / 6, '1/6'],
    [1 / 4, '1/4'],
    [1 / 3, '1/3'],
    [3 / 8, '3/8'],
    [1 / 2, '1/2'],
    [5 / 8, '5/8'],
    [2 / 3, '2/3'],
    [3 / 4, '3/4'],
    [7 / 8, '7/8'],
  ]

  let bestFrac = ''
  let bestDiff = Infinity
  for (const [val, label] of fractions) {
    const diff = Math.abs(decimal - val)
    if (diff < bestDiff) {
      bestDiff = diff
      bestFrac = label
    }
  }

  if (bestDiff < 0.05) {
    return whole > 0 ? `${whole} ${bestFrac}` : bestFrac
  }

  return amount.toFixed(1).replace(/\.0$/, '')
}

interface IngredientListProps {
  ingredients: Ingredient[]
  scale: number
  unitSystem: 'metric' | 'imperial'
  isScaled: boolean
  originalServings: number
  scaledServings: number
  onResetServings: () => void
  allergenIndices: Set<number>
  flaggedDietLabels: string[]
}

export default function IngredientList({
  ingredients,
  scale,
  unitSystem,
  isScaled,
  originalServings,
  scaledServings: _scaledServings,
  onResetServings,
  allergenIndices,
  flaggedDietLabels,
}: IngredientListProps) {
  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Ingredients</h3>
        {isScaled && (
          <button
            onClick={onResetServings}
            className="print:hidden text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:underline"
          >
            Reset to {originalServings}
          </button>
        )}
      </div>
      {allergenIndices.size > 0 && (
        <div className="print:hidden flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 mb-3 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <p>
            Contains ingredients that may not suit your dietary preferences
            {flaggedDietLabels.length > 0 && (
              <span className="font-medium"> ({flaggedDietLabels.join(', ')})</span>
            )}
            . Flagged ingredients are highlighted below.
          </p>
        </div>
      )}
      <ul className="space-y-2 print:columns-2 print:[column-gap:1.5rem]">
        {ingredients.map((ing, i) => {
          const scaledAmount = ing.amount * scale
          const { amount: displayAmount, unit: displayUnit } = convertUnit(
            scaledAmount,
            ing.unit,
            unitSystem
          )
          const showOriginal = isScaled && ing.amount > 0
          const isFlagged = allergenIndices.has(i)
          return (
            <li key={i} className="flex items-baseline gap-2 text-sm">
              <span
                className={
                  isFlagged
                    ? 'text-amber-500 dark:text-amber-400'
                    : 'text-gray-400 dark:text-gray-500'
                }
              >
                ·
              </span>
              <span className="font-medium text-gray-700 dark:text-gray-200">
                {formatAmount(displayAmount)} {displayUnit}
                {showOriginal && (
                  <span className="font-normal text-gray-400 dark:text-gray-500 ml-1">
                    (was {formatAmount(ing.amount)} {ing.unit})
                  </span>
                )}
              </span>
              <span
                className={
                  isFlagged
                    ? 'text-amber-700 dark:text-amber-300 font-medium'
                    : 'text-gray-600 dark:text-gray-300'
                }
              >
                {ing.name}
                {isFlagged && (
                  <AlertTriangle
                    size={12}
                    className="inline ml-1 mb-0.5 text-amber-500"
                    aria-label="allergen warning"
                  />
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
