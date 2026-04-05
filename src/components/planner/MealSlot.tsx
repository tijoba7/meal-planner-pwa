import { Link } from 'react-router-dom'
import { GripVertical, Plus, X } from 'lucide-react'
import type { MealType, Recipe } from '../../types'
import type { DragSource, PlannerDragDropHandlers } from './usePlannerDragDrop'

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

interface MealSlotProps {
  date: string
  meal: MealType
  slotRecipes: (Recipe | undefined)[]
  isDropTarget: boolean
  dragSource: DragSource | null
  onAddClick: () => void
  onRemove: (index: number) => void
  onMoveRecipe: (
    srcDate: string,
    srcMeal: MealType,
    srcIndex: number,
    tgtDate: string,
    tgtMeal: MealType
  ) => void
  dragHandlers: PlannerDragDropHandlers
}

export default function MealSlot({
  date,
  meal,
  slotRecipes,
  isDropTarget,
  dragSource,
  onAddClick,
  onRemove,
  onMoveRecipe,
  dragHandlers,
}: MealSlotProps) {
  const {
    handleDragStart,
    handleDragEnd,
    handleSlotDragOver,
    handleSlotDragLeave,
    handleSlotDrop,
    handleRecipeTouchStart,
    handleRecipeTouchEnd,
  } = dragHandlers

  return (
    <div
      data-drop-date={date}
      data-drop-meal={meal}
      onDragOver={(e) => handleSlotDragOver(e, date, meal)}
      onDragLeave={handleSlotDragLeave}
      onDrop={(e) => handleSlotDrop(e, date, meal, onMoveRecipe)}
      className={`px-4 py-3 transition-colors${isDropTarget ? ' bg-green-50 dark:bg-green-900/20 ring-2 ring-inset ring-green-400 dark:ring-green-500' : ''}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-16 shrink-0 pt-0.5">
          {MEAL_LABELS[meal]}
        </span>
        <div className="flex-1 min-w-0 space-y-1">
          {slotRecipes.map((recipe, idx) => {
            const isDragged =
              dragSource?.date === date &&
              dragSource?.meal === meal &&
              dragSource?.index === idx
            return (
              <div
                key={idx}
                draggable
                onDragStart={(e) => handleDragStart(e, date, meal, idx)}
                onDragEnd={handleDragEnd}
                onTouchStart={(e) => handleRecipeTouchStart(e, date, meal, idx)}
                onTouchEnd={(e) => handleRecipeTouchEnd(e, onMoveRecipe)}
                className={`flex items-center justify-between gap-2 select-none${isDragged ? ' opacity-40' : ''}`}
              >
                <GripVertical
                  size={12}
                  strokeWidth={2}
                  className="shrink-0 text-gray-300 dark:text-gray-600 cursor-grab active:cursor-grabbing"
                  aria-hidden="true"
                />
                {recipe ? (
                  <Link
                    to={`/recipes/${recipe.id}`}
                    draggable={false}
                    className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-100 truncate hover:text-green-700 dark:hover:text-green-400"
                  >
                    {recipe.name}
                  </Link>
                ) : (
                  <span className="flex-1 text-sm text-gray-400 dark:text-gray-500 italic truncate">
                    Unknown recipe
                  </span>
                )}
                <button
                  onClick={() => onRemove(idx)}
                  className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors"
                  aria-label={`Remove ${recipe?.name ?? 'recipe'}`}
                >
                  <X size={14} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            )
          })}
          <button
            onClick={onAddClick}
            aria-label={`Add recipe to ${meal} on ${date}`}
            className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-green-700 dark:hover:text-green-400 group"
          >
            <span className="w-4 h-4 flex items-center justify-center rounded-full border border-dashed border-gray-300 dark:border-gray-600 group-hover:border-green-400">
              <Plus size={10} strokeWidth={2.5} aria-hidden="true" />
            </span>
            <span>{slotRecipes.length === 0 ? 'Add recipe' : 'Add another'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
