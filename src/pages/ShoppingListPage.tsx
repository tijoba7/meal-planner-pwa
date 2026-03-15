import { useState, useEffect, useCallback } from 'react'
import type { ShoppingList, ShoppingItem, MealPlan, Recipe } from '../types'
import {
  getShoppingLists,
  getShoppingList,
  createShoppingList,
  deleteShoppingList,
  toggleShoppingItem,
  updateShoppingList,
  getMealPlans,
  getRecipes,
} from '../lib/db'

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** Aggregate ingredients from meal plans for the given date range. */
function aggregateIngredients(
  startDate: string,
  endDate: string,
  mealPlans: MealPlan[],
  recipesById: Map<string, Recipe>
): Omit<ShoppingItem, 'id'>[] {
  const merged = new Map<string, { name: string; amount: number; unit: string }>()

  for (const plan of mealPlans) {
    for (const [dateKey, dayPlan] of Object.entries(plan.days)) {
      if (dateKey < startDate || dateKey > endDate) continue
      for (const slot of Object.values(dayPlan)) {
        if (!slot) continue
        const recipe = recipesById.get(slot.recipeId)
        if (!recipe) continue
        const yieldNum = parseFloat(recipe.recipeYield) || 1
        const scale = slot.servings / yieldNum
        for (const ing of recipe.recipeIngredient) {
          const key = `${ing.name.toLowerCase()}|${ing.unit.toLowerCase()}`
          const existing = merged.get(key)
          if (existing) {
            existing.amount += ing.amount * scale
          } else {
            merged.set(key, {
              name: ing.name,
              amount: ing.amount * scale,
              unit: ing.unit,
            })
          }
        }
      }
    }
  }

  return Array.from(merged.values()).map((item) => ({
    ...item,
    amount: Math.round(item.amount * 100) / 100,
    checked: false,
  }))
}

export default function ShoppingListPage() {
  const [lists, setLists] = useState<ShoppingList[]>([])
  const [activeListId, setActiveListId] = useState<string | null>(null)
  const [activeList, setActiveList] = useState<ShoppingList | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  // Create-form state
  const [startDate, setStartDate] = useState(() => toISODate(getMonday(new Date())))
  const [endDate, setEndDate] = useState(() => {
    const sun = getMonday(new Date())
    sun.setDate(sun.getDate() + 6)
    return toISODate(sun)
  })
  const [listName, setListName] = useState('')

  const [mealPlans, setMealPlans] = useState<MealPlan[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [creating, setCreating] = useState(false)

  const reload = useCallback(async () => {
    const all = await getShoppingLists()
    setLists(all.reverse())
  }, [])

  useEffect(() => {
    reload()
    getMealPlans().then(setMealPlans)
    getRecipes().then(setRecipes)
  }, [reload])

  useEffect(() => {
    if (activeListId) {
      getShoppingList(activeListId).then((l) => setActiveList(l ?? null))
    } else {
      setActiveList(null)
    }
  }, [activeListId])

  const recipesById = new Map(recipes.map((r) => [r.id, r]))

  const handleCreate = async () => {
    if (!listName.trim()) return
    setCreating(true)
    const items = aggregateIngredients(startDate, endDate, mealPlans, recipesById)
    const itemsWithIds: ShoppingItem[] = items.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
    }))
    const list = await createShoppingList({
      name: listName.trim(),
      items: itemsWithIds,
    })
    setShowCreate(false)
    setListName('')
    await reload()
    setActiveListId(list.id)
    setCreating(false)
  }

  const handleDelete = async (id: string) => {
    await deleteShoppingList(id)
    if (activeListId === id) setActiveListId(null)
    await reload()
  }

  const handleToggle = async (itemId: string) => {
    if (!activeListId) return
    await toggleShoppingItem(activeListId, itemId)
    const updated = await getShoppingList(activeListId)
    setActiveList(updated ?? null)
    await reload()
  }

  const handleRemoveItem = async (itemId: string) => {
    if (!activeList) return
    const items = activeList.items.filter((i) => i.id !== itemId)
    await updateShoppingList(activeList.id, { items })
    const updated = await getShoppingList(activeList.id)
    setActiveList(updated ?? null)
    await reload()
  }

  // ─── Detail view ───────────────────────────────────────────────────────────
  if (activeList) {
    const unchecked = activeList.items.filter((i) => !i.checked)
    const checked = activeList.items.filter((i) => i.checked)
    const total = activeList.items.length
    const doneCount = checked.length

    return (
      <div className="p-4 max-w-2xl mx-auto">
        <button
          onClick={() => setActiveListId(null)}
          className="text-sm text-green-600 font-medium mb-4 flex items-center gap-1 hover:text-green-700"
        >
          <span className="text-lg leading-none">&lsaquo;</span> All lists
        </button>

        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">{activeList.name}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {doneCount} of {total} items checked
            </p>
          </div>
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${(doneCount / total) * 100}%` }}
            />
          </div>
        )}

        {total === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">No items in this list.</p>
            <p className="text-xs mt-1">
              Lists are generated from your meal plan — make sure you have meals planned for the selected dates.
            </p>
          </div>
        )}

        {/* Unchecked items */}
        {unchecked.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
            {unchecked.map((item, i) => (
              <div
                key={item.id}
                className={`flex items-center px-4 py-3 gap-3 ${i > 0 ? 'border-t border-gray-100' : ''}`}
              >
                <button
                  onClick={() => handleToggle(item.id)}
                  className="w-5 h-5 rounded border-2 border-gray-300 shrink-0 hover:border-green-500 transition-colors"
                  aria-label={`Check ${item.name}`}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-800">{item.name}</span>
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {item.amount} {item.unit}
                </span>
                <button
                  onClick={() => handleRemoveItem(item.id)}
                  className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 text-xl leading-none"
                  aria-label={`Remove ${item.name}`}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Checked items */}
        {checked.length > 0 && (
          <>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
              Checked off
            </p>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {checked.map((item, i) => (
                <div
                  key={item.id}
                  className={`flex items-center px-4 py-3 gap-3 ${i > 0 ? 'border-t border-gray-100' : ''}`}
                >
                  <button
                    onClick={() => handleToggle(item.id)}
                    className="w-5 h-5 rounded border-2 border-green-500 bg-green-500 shrink-0 flex items-center justify-center text-white text-xs"
                    aria-label={`Uncheck ${item.name}`}
                  >
                    &#10003;
                  </button>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-400 line-through">{item.name}</span>
                  </div>
                  <span className="text-xs text-gray-300 shrink-0">
                    {item.amount} {item.unit}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  // ─── List view ─────────────────────────────────────────────────────────────
  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Shopping Lists</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-green-600 text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          + New List
        </button>
      </div>

      {lists.length === 0 && !showCreate && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🛒</p>
          <p className="text-sm">No shopping lists yet.</p>
          <p className="text-xs mt-1">
            Create one from your meal plan to auto-generate your grocery list.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {lists.map((list) => {
          const total = list.items.length
          const done = list.items.filter((i) => i.checked).length
          return (
            <div
              key={list.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <button
                onClick={() => setActiveListId(list.id)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{list.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {total} item{total !== 1 ? 's' : ''} &middot; {done} checked &middot;{' '}
                      {formatDate(list.createdAt.slice(0, 10))}
                    </p>
                  </div>
                  <span className="text-gray-400 text-lg ml-2">&rsaquo;</span>
                </div>
                {total > 0 && (
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                    <div
                      className="bg-green-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${(done / total) * 100}%` }}
                    />
                  </div>
                )}
              </button>
              <div className="px-4 pb-3 flex justify-end">
                <button
                  onClick={() => handleDelete(list.id)}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Create shopping list modal */}
      {showCreate && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-800">New Shopping List</h3>
                <button
                  onClick={() => setShowCreate(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                  aria-label="Close"
                >
                  &times;
                </button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">List name</label>
                <input
                  type="text"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  placeholder="e.g. This week's groceries"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Generate from meal plan
                </label>
                <p className="text-xs text-gray-400 mb-2">
                  Select date range to pull ingredients from planned meals.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Start date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">End date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              </div>
              <button
                onClick={handleCreate}
                disabled={!listName.trim() || creating}
                className="w-full bg-green-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating…' : 'Create List'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
