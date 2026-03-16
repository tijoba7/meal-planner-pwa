import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { X, BookOpen, Plus, Copy } from 'lucide-react'
import type { MealType, Recipe, MealPlan } from '../types'
import { normalizeMealSlot } from '../types'
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
  const [copyModalOpen, setCopyModalOpen] = useState(false)
  const [copyTarget, setCopyTarget] = useState<string>('')
  const [copyTargetPlan, setCopyTargetPlan] = useState<MealPlan | null | undefined>(undefined)

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

  useEffect(() => {
    if (!copyTarget) return
    setCopyTargetPlan(undefined)
    getMealPlanForWeek(copyTarget).then(plan => setCopyTargetPlan(plan ?? null))
  }, [copyTarget])

  const navigateWeek = (delta: number) => {
    setWeekStart(prev => {
      const d = new Date(prev + 'T00:00:00')
      d.setDate(d.getDate() + delta * 7)
      return toISODate(d)
    })
  }

  const openCopyModal = () => {
    const nextWeek = toISODate(addDays(new Date(weekStart + 'T00:00:00'), 7))
    setCopyTarget(nextWeek)
    setCopyTargetPlan(undefined)
    setCopyModalOpen(true)
  }

  const navigateCopyTarget = (delta: number) => {
    setCopyTarget(prev => {
      const d = new Date(prev + 'T00:00:00')
      d.setDate(d.getDate() + delta * 7)
      return toISODate(d)
    })
  }

  const executeCopy = async () => {
    if (!mealPlan || !copyTarget) return
    const offsetDays = Math.round(
      (new Date(copyTarget + 'T00:00:00').getTime() - new Date(weekStart + 'T00:00:00').getTime()) /
        (1000 * 60 * 60 * 24)
    )
    const targetDays: MealPlan['days'] = {}
    for (const [sourceDate, dayPlan] of Object.entries(mealPlan.days)) {
      const d = addDays(new Date(sourceDate + 'T00:00:00'), offsetDays)
      targetDays[toISODate(d)] = dayPlan
    }
    if (copyTargetPlan) {
      await updateMealPlan(copyTargetPlan.id, { days: targetDays })
    } else {
      await createMealPlan({ weekStartDate: copyTarget, days: targetDays })
    }
    setCopyModalOpen(false)
    setWeekStart(copyTarget)
  }

  const addRecipeToSlot = async (date: string, meal: MealType, recipeId: string) => {
    if (!mealPlan) return
    const days = { ...mealPlan.days }
    const existing = days[date]?.[meal]
    const slot = existing ? normalizeMealSlot(existing) : { recipes: [] }
    days[date] = {
      ...days[date],
      [meal]: { recipes: [...slot.recipes, { recipeId, servings: 2 }] },
    }
    const updated = await updateMealPlan(mealPlan.id, { days })
    setMealPlan(updated)
    setPickerTarget(null)
    setSearch('')
  }

  const removeRecipeFromSlot = async (date: string, meal: MealType, index: number) => {
    if (!mealPlan) return
    const days = { ...mealPlan.days }
    const existing = days[date]?.[meal]
    if (!existing) return
    const slot = normalizeMealSlot(existing)
    const newRecipes = slot.recipes.filter((_, i) => i !== index)
    const dayPlan = { ...days[date] }
    if (newRecipes.length === 0) {
      delete dayPlan[meal]
    } else {
      dayPlan[meal] = { recipes: newRecipes }
    }
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
  const copyTargetMonday = copyTarget ? new Date(copyTarget + 'T00:00:00') : null
  const copyTargetHasMeals =
    copyTargetPlan != null && Object.values(copyTargetPlan.days).some(d => Object.keys(d).length > 0)
  const sourceHasMeals =
    mealPlan != null && Object.values(mealPlan.days).some(d => Object.keys(d).length > 0)

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigateWeek(-1)}
          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 text-xl font-bold leading-none"
          aria-label="Previous week"
        >
          ‹
        </button>
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Weekly Planner</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{formatWeekRange(mondayDate)}</p>
          <button
            onClick={openCopyModal}
            className="mt-1 inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 transition-colors"
            aria-label="Copy this week's meal plan to another week"
          >
            <Copy size={12} strokeWidth={2} aria-hidden="true" />
            Copy week
          </button>
        </div>
        <button
          onClick={() => navigateWeek(1)}
          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 text-xl font-bold leading-none"
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
            <div key={date} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-sm">{label}</h3>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {MEAL_TYPES.map(meal => {
                  const rawSlot = dayPlan[meal]
                  const slot = rawSlot ? normalizeMealSlot(rawSlot) : null
                  const slotRecipes = slot ? slot.recipes.map(r => recipes.find(rec => rec.id === r.recipeId)) : []

                  return (
                    <div key={meal} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <span className="text-xs font-medium text-gray-400 dark:text-gray-500 w-16 shrink-0 pt-0.5">
                          {MEAL_LABELS[meal]}
                        </span>
                        <div className="flex-1 min-w-0 space-y-1">
                          {slotRecipes.map((recipe, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-2">
                              {recipe ? (
                                <Link
                                  to={`/recipes/${recipe.id}`}
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
                                onClick={() => removeRecipeFromSlot(date, meal, idx)}
                                className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors"
                                aria-label={`Remove ${recipe?.name ?? 'recipe'}`}
                              >
                                <X size={14} strokeWidth={2} aria-hidden="true" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => setPickerTarget({ date, meal })}
                            className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 group"
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
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Copy week modal */}
      {copyModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => setCopyModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 dark:text-gray-100">Copy week to…</h3>
              <button
                onClick={() => setCopyModalOpen(false)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Close"
              >
                <X size={20} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Target week selector */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigateCopyTarget(-1)}
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 text-xl font-bold leading-none"
                  aria-label="Previous week"
                >
                  ‹
                </button>
                <div className="text-center flex-1 min-w-0">
                  {copyTargetMonday && (
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                      {formatWeekRange(copyTargetMonday)}
                    </p>
                  )}
                  {copyTargetPlan === undefined && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Checking…</p>
                  )}
                  {copyTargetHasMeals && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                      Already has meals — will be replaced
                    </p>
                  )}
                  {copyTargetPlan !== undefined && !copyTargetHasMeals && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Empty week</p>
                  )}
                </div>
                <button
                  onClick={() => navigateCopyTarget(1)}
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 text-xl font-bold leading-none"
                  aria-label="Next week"
                >
                  ›
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setCopyModalOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={executeCopy}
                  disabled={!sourceHasMeals || copyTarget === weekStart || copyTargetPlan === undefined}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {copyTargetHasMeals ? 'Copy anyway' : 'Copy'}
                </button>
              </div>

              {!sourceHasMeals && (
                <p className="text-xs text-center text-gray-400 dark:text-gray-500">
                  This week has no meals to copy.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recipe picker modal */}
      {pickerTarget && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
          onClick={closePicker}
        >
          <div
            className="bg-white dark:bg-gray-800 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[80vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800 dark:text-gray-100">
                  {MEAL_LABELS[pickerTarget.meal]}
                </h3>
                <button
                  onClick={closePicker}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  aria-label="Close"
                >
                  <X size={20} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
              <input
                type="search"
                placeholder="Search recipes…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {filteredRecipes.length === 0 ? (
                <div className="flex flex-col items-center text-center py-10 px-4">
                  <BookOpen size={32} strokeWidth={1.5} className="text-gray-300 dark:text-gray-600 mb-3" aria-hidden="true" />
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    {recipes.length === 0 ? 'No recipes yet' : 'No recipes found'}
                  </p>
                  {recipes.length === 0 ? (
                    <Link
                      to="/recipes/new"
                      className="mt-3 bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Add your first recipe
                    </Link>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Try a different search term.</p>
                  )}
                </div>
              ) : (
                filteredRecipes.map(recipe => (
                  <button
                    key={recipe.id}
                    onClick={() => addRecipeToSlot(pickerTarget.date, pickerTarget.meal, recipe.id)}
                    className="w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-green-50 dark:hover:bg-green-900/20 active:bg-green-100 dark:active:bg-green-900/30"
                  >
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{recipe.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{recipe.description}</p>
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
