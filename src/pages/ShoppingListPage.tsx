import { useState, useEffect, useCallback } from 'react'
import { X, ChevronDown, ChevronRight, ChevronLeft, Share2, Copy, Download, Plus, Trash2 } from 'lucide-react'
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
    <div className="flex items-center px-2 min-h-[44px] gap-1">
      {/* Checkbox — expanded to 44px touch target */}
      <button
        onClick={onToggle}
        className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label={item.checked ? `Uncheck ${item.name}` : `Check ${item.name}`}
      >
        <span
          className={`w-5 h-5 rounded border-2 shrink-0 transition-colors flex items-center justify-center ${
            item.checked
              ? 'border-green-500 bg-green-500 text-white text-xs'
              : 'border-gray-300 dark:border-gray-600'
          } ${isJustChecked ? 'animate-check-pop' : ''}`}
          aria-hidden="true"
        >
          {item.checked && <>&#10003;</>}
        </span>
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
                aria-label={`Change category for ${item.name}: currently ${cat}`}
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
          className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors"
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
  const uncheckedCount = items.filter((i) => !i.checked).length

  return (
    <div className="mb-4">
      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        aria-label={`${category}: ${uncheckedCount} of ${items.length} items remaining`}
        className="w-full flex items-center gap-1.5 mb-1.5 min-h-[44px]"
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
  const [showExport, setShowExport] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemAmount, setNewItemAmount] = useState('')
  const [newItemUnit, setNewItemUnit] = useState('')
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

  const handleAddItem = async () => {
    if (!activeList || !newItemName.trim()) return
    const newItem: ShoppingItem = {
      id: crypto.randomUUID(),
      name: newItemName.trim(),
      amount: parseFloat(newItemAmount) || 0,
      unit: newItemUnit.trim(),
      checked: false,
      category: 'Other',
    }
    const items = [...activeList.items, newItem]
    await updateShoppingList(activeList.id, { items })
    const updated = await getShoppingList(activeList.id)
    setActiveList(updated ?? null)
    await reload()
    setNewItemName('')
    setNewItemAmount('')
    setNewItemUnit('')
    setShowAddItem(false)
    toast.success(`"${newItem.name}" added.`)
  }

  // --- Detail view ---
  if (activeList) {
    const unchecked = activeList.items.filter((i) => !i.checked)
    const checked = activeList.items.filter((i) => i.checked)
    const total = activeList.items.length
    const doneCount = checked.length
    const uncheckedGroups = groupByCategory(unchecked)

    function formatListText(list: ShoppingList): string {
      const items = list.items.filter((i) => !i.checked)
      const grouped = groupByCategory(items)
      const lines: string[] = [`Shopping List: ${list.name}`, '']
      for (const [cat, catItems] of grouped) {
        lines.push(cat)
        for (const item of catItems) {
          const qty = item.amount ? ` (${item.amount}${item.unit ? ' ' + item.unit : ''})` : ''
          lines.push(`- ${item.name}${qty}`)
        }
        lines.push('')
      }
      return lines.join('\n').trim()
    }

    const handleCopyToClipboard = async () => {
      const text = formatListText(activeList)
      await navigator.clipboard.writeText(text)
      setShowExport(false)
      toast.success('Copied to clipboard.')
    }

    const handleShare = async () => {
      const text = formatListText(activeList)
      await navigator.share({ title: activeList.name, text })
      setShowExport(false)
    }

    const handleDownload = () => {
      const text = formatListText(activeList)
      const blob = new Blob([text], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${activeList.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.txt`
      a.click()
      URL.revokeObjectURL(url)
      setShowExport(false)
    }

    return (
      <div className="p-4 max-w-2xl mx-auto">
        <button
          onClick={() => setActiveListId(null)}
          className="text-sm text-green-600 dark:text-green-400 font-medium mb-4 flex items-center gap-1 hover:text-green-700 dark:hover:text-green-300 transition-colors"
        >
          <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" /> All lists
        </button>

        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{activeList.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {doneCount} of {total} items checked
            </p>
          </div>
          {total > 0 && (
            <button
              onClick={() => setShowExport(true)}
              className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors mt-1"
              aria-label="Share or export list"
            >
              <Share2 size={16} strokeWidth={2} aria-hidden="true" />
              Share
            </button>
          )}
        </div>

        {total > 0 && (
          <div
            className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-6"
            role="progressbar"
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label={`${doneCount} of ${total} items checked`}
          >
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

        {showAddItem ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
              Add item
            </p>
            <div className="space-y-3">
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem() }}
                placeholder="Item name (e.g. paper towels)"
                aria-label="Item name"
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                autoFocus
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  value={newItemAmount}
                  onChange={(e) => setNewItemAmount(e.target.value)}
                  placeholder="Qty"
                  aria-label="Quantity"
                  min="0"
                  step="any"
                  className="w-20 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <input
                  type="text"
                  value={newItemUnit}
                  onChange={(e) => setNewItemUnit(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem() }}
                  placeholder="Unit (e.g. oz)"
                  aria-label="Unit"
                  className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleAddItem}
                  disabled={!newItemName.trim()}
                  className="flex-1 bg-green-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowAddItem(false)
                    setNewItemName('')
                    setNewItemAmount('')
                    setNewItemUnit('')
                  }}
                  className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddItem(true)}
            className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-medium mb-4 hover:text-green-700 dark:hover:text-green-300 transition-colors"
          >
            <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
            Add item
          </button>
        )}

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

        {showExport && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in"
            onClick={() => setShowExport(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="export-dialog-title"
              className="bg-white dark:bg-gray-800 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl animate-slide-up sm:animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 id="export-dialog-title" className="font-bold text-gray-800 dark:text-gray-100">Share or Export</h3>
                <button
                  onClick={() => setShowExport(false)}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                  aria-label="Close share or export dialog"
                >
                  <X size={20} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
              <div className="p-4 space-y-2">
                {typeof navigator.share === 'function' && (
                  <button
                    onClick={handleShare}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Share2 size={18} strokeWidth={2} className="text-green-600 dark:text-green-400 shrink-0" aria-hidden="true" />
                    Share via…
                  </button>
                )}
                <button
                  onClick={handleCopyToClipboard}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Copy size={18} strokeWidth={2} className="text-green-600 dark:text-green-400 shrink-0" aria-hidden="true" />
                  Copy to clipboard
                </button>
                <button
                  onClick={handleDownload}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Download size={18} strokeWidth={2} className="text-green-600 dark:text-green-400 shrink-0" aria-hidden="true" />
                  Download as text file
                </button>
              </div>
            </div>
          </div>
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
          aria-label="New shopping list"
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
                aria-label={`Open ${list.name}: ${total} item${total !== 1 ? 's' : ''}, ${done} checked`}
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
                  <div
                    className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2"
                    role="progressbar"
                    aria-valuenow={done}
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-label={`${done} of ${total} items checked`}
                  >
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
                  aria-label={`Delete ${list.name}`}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
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
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-list-dialog-title"
            className="bg-white dark:bg-gray-800 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl animate-slide-up sm:animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 id="create-list-dialog-title" className="font-bold text-gray-800 dark:text-gray-100">New Shopping List</h3>
                <button
                  onClick={() => setShowCreate(false)}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  aria-label="Close new shopping list dialog"
                >
                  <X size={20} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label htmlFor="new-list-name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">List name</label>
                <input
                  id="new-list-name"
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
                    <label htmlFor="new-list-start-date" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Start date</label>
                    <input
                      id="new-list-start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="new-list-end-date" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">End date</label>
                    <input
                      id="new-list-end-date"
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
