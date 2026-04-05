const NUTRITION_FIELDS: { key: string; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'proteinContent', label: 'Protein', unit: 'g' },
  { key: 'fatContent', label: 'Fat', unit: 'g' },
  { key: 'carbohydrateContent', label: 'Carbs', unit: 'g' },
  { key: 'fiberContent', label: 'Fiber', unit: 'g' },
]

function parseNutritionValue(val: string | number | undefined): number {
  if (val === undefined || val === null || val === '') return 0
  if (typeof val === 'number') return val
  const match = String(val).match(/[\d.]+/)
  return match ? parseFloat(match[0]) : 0
}

interface NutritionCardProps {
  nutrition: Record<string, string | number>
  isEstimated: boolean
  scale: number
  scaledServings: number
}

export default function NutritionCard({
  nutrition,
  isEstimated,
  scale,
  scaledServings,
}: NutritionCardProps) {
  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Nutrition</h3>
        {isEstimated && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            Estimated
          </span>
        )}
        <span className="text-xs text-gray-400 dark:text-gray-500">
          per {scaledServings} serving{scaledServings !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-5 gap-2 text-center">
          {NUTRITION_FIELDS.map(({ key, label, unit }) => {
            const base = parseNutritionValue(nutrition[key])
            if (!base) return null
            const scaled = base * scale
            const display = scaled % 1 === 0 ? String(Math.round(scaled)) : scaled.toFixed(1)
            return (
              <div key={key}>
                <p className="text-base font-bold text-gray-800 dark:text-gray-100 leading-tight">
                  {display}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{unit}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{label}</p>
              </div>
            )
          })}
        </div>
        {isEstimated && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 text-center">
            Auto-calculated from ingredients · Manually entered values take precedence
          </p>
        )}
      </div>
    </section>
  )
}
