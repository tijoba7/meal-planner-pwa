import type { MealType, MealPlan, Recipe } from '../../types'
import type { PlannerDragDropHandlers } from './usePlannerDragDrop'
import DayColumn from './DayColumn'

interface WeekDay {
  date: string
  label: string
}

interface WeekNutrition {
  byDay: Record<string, { cal: number; protein: number; carbs: number; fat: number } | null>
  total: { cal: number; protein: number; carbs: number; fat: number }
  dailyAvg: { cal: number; protein: number; carbs: number; fat: number } | null
  daysWithData: number
}

interface WeekViewProps {
  weekDays: WeekDay[]
  mealPlan: MealPlan
  recipes: Recipe[]
  dragHandlers: PlannerDragDropHandlers
  weeklyNutrition: WeekNutrition | null
  onAddRecipe: (date: string, meal: MealType) => void
  onRemoveRecipe: (date: string, meal: MealType, index: number) => void
  onMoveRecipe: (
    srcDate: string,
    srcMeal: MealType,
    srcIndex: number,
    tgtDate: string,
    tgtMeal: MealType
  ) => void
}

export default function WeekView({
  weekDays,
  mealPlan,
  recipes,
  dragHandlers,
  weeklyNutrition,
  onAddRecipe,
  onRemoveRecipe,
  onMoveRecipe,
}: WeekViewProps) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {weekDays.map(({ date, label }) => (
          <DayColumn
            key={date}
            date={date}
            label={label}
            dayPlan={mealPlan.days[date] ?? {}}
            recipes={recipes}
            dragOver={dragHandlers.dragOver}
            dragHandlers={dragHandlers}
            nutrition={weeklyNutrition?.byDay[date] ?? null}
            onAddRecipe={onAddRecipe}
            onRemoveRecipe={onRemoveRecipe}
            onMoveRecipe={onMoveRecipe}
          />
        ))}
      </div>

      {weeklyNutrition && (
        <div className="mt-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-sm">
              Weekly Nutrition
            </h3>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {weeklyNutrition.daysWithData} of 7 days tracked
            </span>
          </div>
          <div className="grid grid-cols-4 divide-x divide-gray-100 dark:divide-gray-700">
            {(
              [
                { label: 'Calories', total: weeklyNutrition.total.cal, avg: weeklyNutrition.dailyAvg?.cal, unit: '' },
                { label: 'Protein', total: weeklyNutrition.total.protein, avg: weeklyNutrition.dailyAvg?.protein, unit: 'g' },
                { label: 'Carbs', total: weeklyNutrition.total.carbs, avg: weeklyNutrition.dailyAvg?.carbs, unit: 'g' },
                { label: 'Fat', total: weeklyNutrition.total.fat, avg: weeklyNutrition.dailyAvg?.fat, unit: 'g' },
              ] as const
            ).map(({ label, total, avg, unit }) => (
              <div key={label} className="p-3 text-center">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{label}</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {total.toLocaleString()}{unit}
                </p>
                {avg != null && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    ~{avg.toLocaleString()}{unit}/day
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
