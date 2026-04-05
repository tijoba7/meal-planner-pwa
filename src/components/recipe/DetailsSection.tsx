import { UseFormRegister, Control, Controller } from 'react-hook-form'
import type { RecipeFormValues } from './recipeFormTypes'
import TagPicker from './TagPicker'
import { DIETARY_PREFERENCES } from '../../lib/dietary'

interface DetailsSectionProps {
  register: UseFormRegister<RecipeFormValues>
  control: Control<RecipeFormValues>
  watchedDiet: string[]
  onToggleDiet: (id: string) => void
  categoryListId: string
  cuisineListId: string
  categorySuggestions: string[]
  cuisineSuggestions: string[]
  keywordSuggestions: string[]
}

export default function DetailsSection({
  register,
  control,
  watchedDiet,
  onToggleDiet,
  categoryListId,
  cuisineListId,
  categorySuggestions,
  cuisineSuggestions,
  keywordSuggestions,
}: DetailsSectionProps) {
  return (
    <>
      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          Tags
        </label>
        <Controller
          control={control}
          name="keywords"
          render={({ field }) => (
            <TagPicker
              tags={field.value}
              onChange={field.onChange}
              suggestions={keywordSuggestions}
              placeholder="Add tags… (e.g. italian, pasta)"
            />
          )}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Press Enter or comma to add · Backspace to remove last
        </p>
      </div>

      {/* Dietary */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
          Dietary{' '}
          <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(optional)</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {DIETARY_PREFERENCES.map((pref) => {
            const selected = watchedDiet.includes(pref.id)
            return (
              <button
                key={pref.id}
                type="button"
                onClick={() => onToggleDiet(pref.id)}
                aria-pressed={selected}
                title={pref.description}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selected
                    ? 'bg-green-700 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {pref.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Category & Cuisine */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            Category
          </label>
          <input
            type="text"
            list={categoryListId}
            {...register('recipeCategory')}
            placeholder="e.g. Dinner"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
          />
          <datalist id={categoryListId}>
            {categorySuggestions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            Cuisine
          </label>
          <input
            type="text"
            list={cuisineListId}
            {...register('recipeCuisine')}
            placeholder="e.g. Italian"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
          />
          <datalist id={cuisineListId}>
            {cuisineSuggestions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </div>

      {/* Nutrition */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          Nutrition{' '}
          <span className="text-xs font-normal text-gray-500">(per serving, optional)</span>
        </label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { field: 'nutritionCalories' as const, label: 'Calories', unit: 'kcal' },
            { field: 'nutritionProtein' as const, label: 'Protein', unit: 'g' },
            { field: 'nutritionFat' as const, label: 'Fat', unit: 'g' },
            { field: 'nutritionCarbs' as const, label: 'Carbs', unit: 'g' },
            { field: 'nutritionFiber' as const, label: 'Fiber', unit: 'g' },
          ].map(({ field, label, unit }) => (
            <div key={field}>
              <label
                htmlFor={`nutrition-${field}`}
                className="block text-xs text-gray-500 dark:text-gray-400 mb-1"
              >
                {label} <span className="text-gray-500">({unit})</span>
              </label>
              <input
                id={`nutrition-${field}`}
                type="number"
                min="0"
                step="any"
                {...register(field)}
                placeholder="0"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
