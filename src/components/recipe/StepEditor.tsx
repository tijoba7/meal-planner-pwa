import { useFieldArray, Control, FieldErrors } from 'react-hook-form'
import { X } from 'lucide-react'
import type { RecipeFormValues } from './recipeFormTypes'

interface StepEditorProps {
  control: Control<RecipeFormValues>
  errors: FieldErrors<RecipeFormValues>
}

export default function StepEditor({ control, errors }: StepEditorProps) {
  const { fields, append, remove, update } = useFieldArray({ control, name: 'instructions' })

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
        Instructions <span className="text-red-500">*</span>
      </label>
      <div className="space-y-2">
        {fields.map((field, i) => (
          <div key={field.id} className="flex gap-2 items-start">
            <span className="mt-2 shrink-0 w-6 h-6 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full flex items-center justify-center text-xs font-bold">
              {i + 1}
            </span>
            <textarea
              value={field.text}
              onChange={(e) => update(i, { text: e.target.value })}
              placeholder={`Step ${i + 1}…`}
              rows={2}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
            {fields.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="mt-2 shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                aria-label="Remove step"
              >
                <X size={14} strokeWidth={2} aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
      </div>
      {errors.instructions && (
        <p className="text-red-500 text-xs mt-1" role="alert">
          {typeof errors.instructions.message === 'string'
            ? errors.instructions.message
            : 'Add at least one instruction step.'}
        </p>
      )}
      <button
        type="button"
        onClick={() => append({ text: '' })}
        className="mt-2 text-sm text-green-700 hover:text-green-800 font-medium"
      >
        + Add step
      </button>
    </div>
  )
}
