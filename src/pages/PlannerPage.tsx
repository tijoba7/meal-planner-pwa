import { useState, useEffect } from 'react'
import type { MealType, Recipe, MealPlan } from '../types'
import { getRecipes, getMealPlanForWeek, createMealPlan, updateMealPlan } from '../lib/db'

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function formatDayHeader(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6)
  const start = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const end = sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${start} – ${end}`
}

export default function PlannerPage() {
  const [weekStart, setWeekStart] = useState<string>(() => toISODate(getMonday(new Date())))
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [pickerTarget, setPickerTarget] = useState<{ date: string; meal: MealType } | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getRecipes().then(setRecipes)
  }, [])

  useEffect(() => {
    getMealPlanForWeek(weekStart).then(async (plan) => {
      if (plan) {
        setMealPlan(plan)
      } else {
        const newPlan = await createMealPlan({ weekStartDate: weekStart, days: {} })
        setMealPlan(newPlan)
      }
    })
  }, [weekStart])

  const navigateWeek = (delta: number) => {
    setWeekStart(prev => {
      const d = new Date(prev + 'T00:00:00')
      d.setDate(d.getDate() + delta * 7)
      return toISODate(d)
    })
  }

  const assignRecipe = async (date: string, meal: MealType, recipeId: string) => {
    if (!mealPlan) return
    const days = { ...mealPlan.days }
    days[date] = { ...days[date], [meal]: { recipeId, servings: 2 } }
    const updated = await updateMealPlan(mealPlan.id, { days })
    setMealPlan(updated)
    setPickerTarget(null)
    setSearch('')
  }

  const removeRecipe = async (date: string, meal: MealType) => {
    if (!mealPlan) return
    const days = { ...mealPlan.days }
    const dayPlan = { ...days[date] }
    delete dayPlan[meal]
    days[date] = dayPlan
    const updated = await updateMealPlan(mealPlan.id, { days })
    setMealPlan(updated)
  }

  const closePicker = () => {
    setPickerTarget(null)
    setSearch('')
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(new Date(weekStart + 'T00:00:00'), i)
    return { date: toISODate(d), label: formatDayHeader(d) }
  })

  const filteredRecipes = recipes.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.keywords.some(t => t.toLowerCase().includes(search.toLowerCase()))
  )

  const mondayDate = new Date(weekStart + 'T00:00:00')

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigateWeek(-1)}
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xl font-bold leading-none"
          aria-label="Previous week"
        >
          ‹
        </button>
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-800">Weekly Planner</h2>
          <p className="text-sm text-gray-500">{formatWeekRange(mondayDate)}</p>
        </div>
        <button
          onClick={() => navigateWeek(1)}
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xl font-bold leading-none"
          aria-label="Next week"
        >
          ›
        </button>
      </div>

      {/* Days */}
      <div className="space-y-3">
        {weekDays.map(({ date, label }) => {
          const dayPlan = mealPlan?.days[date] ?? {}
          return (
            <div key={date} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                <h3 className="font-semibold text-gray-700 text-sm">{label}</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {MEAL_TYPES.map(meal => {
                  const slot = dayPlan[meal]
                  const recipe = slot ? recipes.find(r => r.id === slot.recipeId) : null
                  return (
                    <div key={meal} className="flex items-center px-4 py-3 gap-3">
                      <span className="text-xs font-medium text-gray-400 w-16 shrink-0">
                        {MEAL_LABELS[meal]}
                      </span>
                      {recipe ? (
                        <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                          <button
                            onClick={() => setPickerTarget({ date, meal })}
                            className="flex-1 text-left text-sm font-medium text-gray-800 truncate hover:text-green-700"
                          >
                            {recipe.name}
                          </button>
                          <button
                            onClick={() => removeRecipe(date, meal)}
                            className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 text-xl leading-none"
                            aria-label={`Remove ${recipe.name}`}
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPickerTarget({ date, meal })}
                          className="flex-1 flex items-center gap-2 text-sm text-gray-400 hover:text-green-600 group"
                        >
                          <span className="w-5 h-5 flex items-center justify-center rounded-full border border-dashed border-gray-300 group-hover:border-green-400 text-base leading-none">
                            +
                          </span>
                          <span>Add recipe</span>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Recipe picker modal */}
      {pickerTarget && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
          onClick={closePicker}
        >
          <div
            className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[80vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800">
                  {MEAL_LABELS[pickerTarget.meal]}
                </h3>
                <button
                  onClick={closePicker}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <input
                type="search"
                placeholder="Search recipes…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {filteredRecipes.length === 0 ? (
                <p className="p-4 text-sm text-gray-500 text-center">No recipes found.</p>
              ) : (
                filteredRecipes.map(recipe => (
                  <button
                    key={recipe.id}
                    onClick={() => assignRecipe(pickerTarget.date, pickerTarget.meal, recipe.id)}
                    className="w-full text-left px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-green-50 active:bg-green-100"
                  >
                    <p className="text-sm font-medium text-gray-800">{recipe.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{recipe.description}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
