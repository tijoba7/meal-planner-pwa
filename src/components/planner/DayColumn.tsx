import type { MealType, MealPlan, Recipe } from '../../types'
import { normalizeMealSlot } from '../../types'
import type { PlannerDragDropHandlers } from './usePlannerDragDrop'
import MealSlot from './MealSlot'

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

interface DayNutrition {
  cal: number
  protein: number
  carbs: number
  fat: number
}

interface DayColumnProps {
  date: string
  label: string
  dayPlan: MealPlan['days'][string]
  recipes: Recipe[]
  dragOver: { date: string; meal: MealType } | null
  dragHandlers: PlannerDragDropHandlers
  nutrition: DayNutrition | null
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

export default function DayColumn({
  date,
  label,
  dayPlan,
  recipes,
  dragOver,
  dragHandlers,
  nutrition,
  onAddRecipe,
  onRemoveRecipe,
  onMoveRecipe,
}: DayColumnProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-sm">{label}</h3>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {MEAL_TYPES.map((meal) => {
          const rawSlot = dayPlan[meal]
          const slot = rawSlot ? normalizeMealSlot(rawSlot) : null
          const slotRecipes = slot
            ? slot.recipes.map((r) => recipes.find((rec) => rec.id === r.recipeId))
            : []
          const isDropTarget = dragOver?.date === date && dragOver?.meal === meal
          return (
            <MealSlot
              key={meal}
              date={date}
              meal={meal}
              slotRecipes={slotRecipes}
              isDropTarget={isDropTarget}
              dragSource={dragHandlers.dragSource}
              onAddClick={() => onAddRecipe(date, meal)}
              onRemove={(idx) => onRemoveRecipe(date, meal, idx)}
              onMoveRecipe={onMoveRecipe}
              dragHandlers={dragHandlers}
            />
          )
        })}
      </div>
      {nutrition && (
        <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/20">
          <div className="flex items-center gap-2.5 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              {nutrition.cal.toLocaleString()} kcal
            </span>
            <span className="text-gray-300 dark:text-gray-600" aria-hidden="true">·</span>
            <span>P&nbsp;{nutrition.protein}g</span>
            <span>C&nbsp;{nutrition.carbs}g</span>
            <span>F&nbsp;{nutrition.fat}g</span>
          </div>
        </div>
      )}
    </div>
  )
}
