import { useFieldArray, Control, FieldErrors } from 'react-hook-form'
import { X } from 'lucide-react'
import type { RecipeFormValues } from './recipeFormTypes'
import IngredientNameInput, { type IngredientSuggestion } from './IngredientNameInput'

interface IngredientEditorProps {
  control: Control<RecipeFormValues>
  errors: FieldErrors<RecipeFormValues>
  ingredientSuggestions: IngredientSuggestion[]
}

export default function IngredientEditor({
  control,
  errors,
  ingredientSuggestions,
}: IngredientEditorProps) {
  const { fields, append, remove, update } = useFieldArray({ control, name: 'ingredients' })

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
        Ingredients <span className="text-red-500">*</span>
      </label>
      <div className="space-y-2">
        {fields.map((field, i) => (
          <div key={field.id} className="flex gap-2 items-center">
            <input
              type="number"
              min="0"
              step="any"
              value={field.amount}
              onChange={(e) => update(i, { ...field, amount: Number(e.target.value) })}
              placeholder="Amt"
              aria-label={`Amount for ingredient ${i + 1}`}
              className="w-16 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
            <input
              type="text"
              value={field.unit}
              onChange={(e) => update(i, { ...field, unit: e.target.value })}
              placeholder="unit"
              aria-label={`Unit for ingredient ${i + 1}`}
              className="w-20 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
            <IngredientNameInput
              value={field.name}
              onChange={(name) => update(i, { ...field, name })}
              onSelectSuggestion={(name, unit) =>
                update(i, { ...field, name, unit: field.unit.trim() ? field.unit : unit })
              }
              allSuggestions={ingredientSuggestions}
              placeholder="ingredient name"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
            {fields.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                aria-label="Remove ingredient"
              >
                <X size={14} strokeWidth={2} aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
      </div>
      {errors.ingredients && (
        <p className="text-red-500 text-xs mt-1" role="alert">
          {typeof errors.ingredients.message === 'string'
            ? errors.ingredients.message
            : 'Add at least one ingredient.'}
        </p>
      )}
      <button
        type="button"
        onClick={() => append({ name: '', amount: 1, unit: '' })}
        className="mt-2 text-sm text-green-700 hover:text-green-800 font-medium"
      >
        + Add ingredient
      </button>
    </div>
  )
}
