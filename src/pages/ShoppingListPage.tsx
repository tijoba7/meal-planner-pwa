import { useState, useEffect, useCallback } from 'react'
import { X, ChevronDown, ChevronRight } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import { ShoppingCartIllustration, ClipboardIllustration } from '../components/EmptyStateIllustrations'
import Skeleton from '../components/Skeleton'
import { useToast } from '../contexts/ToastContext'
import type { ShoppingList, ShoppingItem, MealPlan, Recipe, IngredientCategory } from '../types'
import { normalizeMealSlot } from '../types'
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
import { categorizeIngredient, ALL_CATEGORIES } from '../lib/ingredientCategories'

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
      for (const rawSlot of Object.values(dayPlan)) {
        if (!rawSlot) continue
        const slot = normalizeMealSlot(rawSlot)
        for (const entry of slot.recipes) {
          const recipe = recipesById.get(entry.recipeId)
          if (!recipe) continue
          const yieldNum = parseFloat(recipe.recipeYield) || 1
          const scale = entry.servings / yieldNum
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
  }

  return Array.from(merged.values()).map((item) => ({
    ...item,
    amount: Math.round(item.amount * 100) / 100,
    checked: false,
    category: categorizeIngredient(item.name),
  }))
}

/** Group items by category, preserving display order. */
function groupByCategory(items: ShoppingItem[]): Array<[IngredientCategory, ShoppingItem[]]> {
  const map = new Map<IngredientCategory, ShoppingItem[]>()
  for (const cat of ALL_CATEGORIES) map.set(cat, [])
  for (const item of items) {
    const cat = item.category ?? 'Other'
    map.get(cat)!.push(item)
  }
  return Array.from(map.entries()).filter(([, list]) => list.length > 0)
}

const CATEGORY_COLORS: Record<IngredientCategory, string> = {
  Produce: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  'Meat & Seafood': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  'Dairy & Eggs': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Bakery: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Frozen: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  Pantry: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  Other: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}

function ItemRow({
  item,
  onToggle,
  onRemove,
  onCategoryChange,
  isJustChecked = false,
}: {
  item: ShoppingItem
  onToggle: () => void
  onRemove: () => void
  onCategoryChange: (cat: IngredientCategory) => void
  isJustChecked?: boolean
}) {
  const [editingCat, setEditingCat] = useState(false)
  const cat = item.category ?? 'Other'

  return (
    <div className="flex items-center px-4 py-3 gap-3">
      <button
        onClick={onToggle}
        className={`w-5 h-5 rounded border-2 shrink-0 transition-colors ${
          item.checked
            ? 'border-green-500 bg-green-500 flex items-center justify-center text-white text-xs'
            : 'border-gray-300 dark:border-gray-600 hover:border-green-500'
        } ${isJustChecked ? 'animate-check-pop' : ''}`}
        aria-label={item.checked ? `Uncheck ${item.name}` : `Check ${item.name}`}
      >
        {item.checked && <>&#10003;</>}
      </button>

      <div className="flex-1 min-w-0">
        <span
          className={`text-sm ${item.checked ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-800 dark:text-gray-100'}`}
        >
          {item.name}
        </span>
        {!item.checked && (
          <div className="mt-0.5">
            {editingCat ? (
              <select
                value={cat}
                autoFocus
                onChange={(e) => {
                  onCategoryChange(e.target.value as IngredientCategory)
                  setEditingCat(false)
                }}
                onBlur={() => setEditingCat(false)}
                className="text-xs border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-green-500"
              >
                {ALL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <button
                onClick={() => setEditingCat(true)}
                className={`text-xs px-1.5 py-0.5 rounded font-medium ${CATEGORY_COLORS[cat]} hover:opacity-80 transition-opacity`}
                title="Tap to change category"
              >
                {cat}
              </button>
            )}
          </div>
        )}
      </div>

      <span
        className={`text-xs shrink-0 ${item.checked ? 'text-gray-300 dark:text-gray-600' : 'text-gray-400 dark:text-gray-500'}`}
      >
        {item.amount} {item.unit}
      </span>

      {!item.checked && (
        <button
          onClick={onRemove}
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors"
          aria-label={`Remove ${item.name}`}
        >
          <X size={14} strokeWidth={2} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

function CategorySection({
  category,
  items,
  onToggle,
  onRemove,
  onCategoryChange,
  justChecked,
}: {
  category: IngredientCategory
  items: ShoppingItem[]
  onToggle: (id: string) => void
  onRemove: (id: string) => void
  onCategoryChange: (id: string, cat: IngredientCategory) => void
  justChecked: Set<string>
}) {
  const [collapsed, setCollapsed] = useState(false)
  const allChecked = items.every((i) => i.checked)

  return (
    <div className="mb-4">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-1.5 mb-1.5"
      >
        {collapsed ? (
          <ChevronRight size={14} className="text-gray-400 dark:text-gray-500 shrink-0" />
        ) : (
          <ChevronDown size={14} className="text-gray-400 dark:text-gray-500 shrink-0" />
        )}
        <span
          className={`text-xs font-semibold uppercase tracking-wider ${allChecked ? 'text-gray-300 dark:text-gray-600 line-through' : 'text-gray-500 dark:text-gray-400'}`}
        >
          {category}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          ({items.filter((i) => !i.checked).length}/{items.length})
        </span>
      </button>

      {!collapsed && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {items.map((item, i) => (
            <div key={item.id} className={i > 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''}>
              <ItemRow
                item={item}
                onToggle={() => onToggle(item.id)}
            isJustChecked={justChecked.has(item.id)}
                onRemove={() => onRemove(item.id)}
                onCategoryChange={(cat) => onCategoryChange(item.id, cat)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ShoppingListPage() {
  const toast = useToast()
  const [lists, setLists] = useState<ShoppingList[]>([])
  const [activeListId, setActiveListId] = useState<string | null>(null)
  const [activeList, setActiveList] = useState<ShoppingList | null>(null)
  const [showCreate, setShowCreate] = useState(false)

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
  const [loading, setLoading] = useState(true)
  const [justChecked, setJustChecked] = useState<Set<string>>(new Set())

  const reload = useCallback(async () => {
    const all = await getShoppingLists()
    setLists(all.reverse())
  }, [])

  useEffect(() => {
    Promise.all([reload(), getMealPlans().then(setMealPlans), getRecipes().then(setRecipes)]).then(
      () => setLoading(false)
    )
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
    toast.success('Shopping list created.')
  }

  const handleDelete = async (id: string) => {
    await deleteShoppingList(id)
    if (activeListId === id) setActiveListId(null)
    await reload()
  }

  const handleToggle = async (itemId: string) => {
    if (!activeListId) return
    const isChecking = activeList?.items.find((i) => i.id === itemId)?.checked === false
    if (isChecking) {
      setJustChecked((prev) => new Set([...prev, itemId]))
      setTimeout(
        () =>
          setJustChecked((prev) => {
            const next = new Set(prev)
            next.delete(itemId)
            return next
          }),
        300
      )
    }
    await toggleShoppingItem(activeListId, itemId)
    const updated = await getShoppingList(activeListId)
    setActiveList(updated ?? null)
    await reload()
  }

  const handleRemoveItem = async (itemId: string) => {
    if (!activeList) return
    const listId = activeList.id
    const removedItem = activeList.items.find((i) => i.id === itemId)
    if (!removedItem) return

    const items = activeList.items.filter((i) => i.id !== itemId)
    await updateShoppingList(listId, { items })
    const updated = await getShoppingList(listId)
    setActiveList(updated ?? null)
    await reload()

    toast.success(`"${removedItem.name}" removed.`, {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: async () => {
          const currentList = await getShoppingList(listId)
          if (!currentList) return
          const restoredItems = [...currentList.items, removedItem]
          await updateShoppingList(listId, { items: restoredItems })
          const restored = await getShoppingList(listId)
          setActiveList(restored ?? null)
          await reload()
        },
      },
    })
  }

  const handleCategoryChange = async (itemId: string, newCat: IngredientCategory) => {
    if (!activeList) return
    const items = activeList.items.map((i) => (i.id === itemId ? { ...i, category: newCat } : i))
    await updateShoppingList(activeList.id, { items })
    const updated = await getShoppingList(activeList.id)
    setActiveList(updated ?? null)
  }

  // --- Detail view ---
  if (activeList) {
    const unchecked = activeList.items.filter((i) => !i.checked)
    const checked = activeList.items.filter((i) => i.checked)
    const total = activeList.items.length
    const doneCount = checked.length
    const uncheckedGroups = groupByCategory(unchecked)

    return (
      <div className="p-4 max-w-2xl mx-auto">
        <button
          onClick={() => setActiveListId(null)}
          className="text-sm text-green-600 dark:text-green-400 font-medium mb-4 flex items-center gap-1 hover:text-green-700 dark:hover:text-green-300"
        >
          <span className="text-lg leading-none">&lsaquo;</span> All lists
        </button>

        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{activeList.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {doneCount} of {total} items checked
            </p>
          </div>
        </div>

        {total > 0 && (
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-6">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${(doneCount / total) * 100}%` }}
            />
          </div>
        )}

        {total === 0 && (
          <EmptyState
            illustration={<ClipboardIllustration />}
            title="No items in this list"
            description="Lists are generated from your meal plan — make sure you have meals planned for the selected dates."
          />
        )}

        {uncheckedGroups.map(([cat, items]) => (
          <CategorySection
            key={cat}
            category={cat}
            items={items}
            onToggle={handleToggle}
            onRemove={handleRemoveItem}
            onCategoryChange={handleCategoryChange}
            justChecked={justChecked}
          />
        ))}

        {checked.length > 0 && (
          <>
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 mt-2">
              Checked off
            </p>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {checked.map((item, i) => (
                <div key={item.id} className={i > 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''}>
                  <ItemRow
                    item={item}
                    onToggle={() => handleToggle(item.id)}
                    onRemove={() => handleRemoveItem(item.id)}
                    onCategoryChange={(cat) => handleCategoryChange(item.id, cat)}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  // --- List view ---
  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Shopping Lists</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-green-600 text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          + New List
        </button>
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading shopping lists">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <Skeleton className="h-5 w-2/5" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      ) : lists.length === 0 && !showCreate ? (
        <EmptyState
          illustration={<ShoppingCartIllustration />}
          title="No shopping lists yet"
          description="Create one from your meal plan to auto-generate your grocery list."
          action={{ label: 'Create a list', onClick: () => setShowCreate(true) }}
        />
      ) : null}

      <div className="space-y-3">
        {lists.map((list) => {
          const total = list.items.length
          const done = list.items.filter((i) => i.checked).length
          return (
            <div
              key={list.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <button
                onClick={() => setActiveListId(list.id)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{list.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {total} item{total !== 1 ? 's' : ''} &middot; {done} checked &middot;{" "}
                      {formatDate(list.createdAt.slice(0, 10))}
                    </p>
                  </div>
                  <span className="text-gray-400 dark:text-gray-500 text-lg ml-2">&rsaquo;</span>
                </div>
                {total > 0 && (
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2">
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

      {showCreate && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl animate-slide-up sm:animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-800 dark:text-gray-100">New Shopping List</h3>
                <button
                  onClick={() => setShowCreate(false)}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  aria-label="Close"
                >
                  <X size={20} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">List name</label>
                <input
                  type="text"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  placeholder="e.g. This week's groceries"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Generate from meal plan
                </label>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                  Select date range to pull ingredients from planned meals.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Start date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">End date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
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
