import { UseFormRegister, FieldErrors } from 'react-hook-form'
import type { RecipeFormValues } from './recipeFormTypes'
import ImageUploader from './ImageUploader'

interface BasicsSectionProps {
  register: UseFormRegister<RecipeFormValues>
  errors: FieldErrors<RecipeFormValues>
  previewUrl: string | null
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClearImage: () => void
}

const inputBase =
  'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500'
const inputOk = 'border-gray-200 focus:ring-green-500 dark:border-gray-600'
const inputErr = 'border-red-500 focus:ring-red-500 dark:border-red-500'

export default function BasicsSection({
  register,
  errors,
  previewUrl,
  fileInputRef,
  onFileChange,
  onClearImage,
}: BasicsSectionProps) {
  return (
    <>
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          {...register('name', {
            required: 'Name is required.',
            maxLength: { value: 200, message: 'Name must be 200 characters or fewer.' },
          })}
          placeholder="e.g. Spaghetti Bolognese"
          aria-invalid={Boolean(errors.name)}
          className={`${inputBase} ${errors.name ? inputErr : inputOk}`}
        />
        {errors.name && (
          <p className="text-red-500 text-xs mt-1" role="alert">
            {errors.name.message}
          </p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          Description
        </label>
        <textarea
          {...register('description', {
            maxLength: { value: 1000, message: 'Description must be 1000 characters or fewer.' },
          })}
          placeholder="A short description of the dish…"
          rows={2}
          aria-invalid={Boolean(errors.description)}
          className={`${inputBase} resize-none ${errors.description ? inputErr : inputOk}`}
        />
        {errors.description && (
          <p className="text-red-500 text-xs mt-1" role="alert">
            {errors.description.message}
          </p>
        )}
      </div>

      {/* Photo */}
      <ImageUploader
        previewUrl={previewUrl}
        fileInputRef={fileInputRef}
        onFileChange={onFileChange}
        onClear={onClearImage}
      />

      {/* Times + Servings */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label
            htmlFor="prep-time-minutes"
            className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
          >
            Prep (min)
          </label>
          <input
            id="prep-time-minutes"
            type="number"
            min="0"
            {...register('prepTimeMinutes', {
              min: { value: 0, message: 'Enter a valid number of minutes (0 or more).' },
            })}
            aria-invalid={Boolean(errors.prepTimeMinutes)}
            className={`${inputBase} ${errors.prepTimeMinutes ? inputErr : inputOk}`}
          />
          {errors.prepTimeMinutes && (
            <p className="text-red-500 text-xs mt-1" role="alert">
              {errors.prepTimeMinutes.message}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="cook-time-minutes"
            className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
          >
            Cook (min)
          </label>
          <input
            id="cook-time-minutes"
            type="number"
            min="0"
            {...register('cookTimeMinutes', {
              min: { value: 0, message: 'Enter a valid number of minutes (0 or more).' },
            })}
            aria-invalid={Boolean(errors.cookTimeMinutes)}
            className={`${inputBase} ${errors.cookTimeMinutes ? inputErr : inputOk}`}
          />
          {errors.cookTimeMinutes && (
            <p className="text-red-500 text-xs mt-1" role="alert">
              {errors.cookTimeMinutes.message}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            Servings
          </label>
          <input
            type="text"
            {...register('recipeYield')}
            placeholder="e.g. 4"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
          />
        </div>
      </div>
    </>
  )
}
