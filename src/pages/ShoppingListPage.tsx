import { useState, useMemo, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  X,
  Share2,
  Copy,
  Download,
  Users,
} from 'lucide-react'
import EmptyState from '../components/EmptyState'
import { ShoppingCartIllustration } from '../components/EmptyStateIllustrations'
import Skeleton from '../components/Skeleton'
import { useToast } from '../contexts/ToastContext'
import { useUnitPreference } from '../hooks/useUnitPreference'
import { useAuth } from '../contexts/AuthContext'
import type {
  ShoppingList,
  ShoppingItem,
  MealPlan,
  Recipe,
  IngredientCategory,
  PantryItem,
} from '../types'
import { normalizeMealSlot } from '../types'
import {
  useShoppingLists,
  useShoppingList,
  useCreateShoppingList,
  useUpdateShoppingList,
  useDeleteShoppingList,
  useToggleShoppingItem,
  useShareShoppingList,
  useUnshareShoppingList,
  shoppingListKeys,
} from '../hooks/useShoppingLists'
import { useMealPlans } from '../hooks/useMealPlans'
import { useRecipes } from '../hooks/useRecipes'
import { usePantryItems } from '../hooks/usePantryItems'
import { categorizeIngredient } from '../lib/ingredientCategories'
import { mergeIngredients } from '../lib/ingredientMerger'
import {
  getMyHouseholds,
  subscribeToHouseholdShoppingLists,
  type Household,
} from '../lib/householdService'
import ShoppingListDetail from '../components/shopping/ShoppingListDetail'
import { buildSuggestions } from '../components/shopping/utils'

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
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function aggregateIngredients(
  startDate: string, endDate: string, mealPlans: MealPlan[],
  recipesById: Map<string, Recipe>, pantryItems: PantryItem[] = []
): { items: Omit<ShoppingItem, 'id'>[]; excludedCount: number } {
  const pantryNames = new Set(pantryItems.map((p) => p.name.toLowerCase()))
  const raw: { name: string; amount: number; unit: string }[] = []
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
            raw.push({ name: ing.name, amount: ing.amount * scale, unit: ing.unit })
          }
        }
      }
    }
  }
  const merged = mergeIngredients(raw)
  let excludedCount = 0
  const items: Omit<ShoppingItem, 'id'>[] = []
  for (const item of merged) {
    if (pantryNames.has(item.name.toLowerCase())) { excludedCount++; continue }
    items.push({ ...item, amount: Math.round(item.amount * 100) / 100, checked: false, category: categorizeIngredient(item.name) })
  }
  return { items, excludedCount }
}

function formatListText(list: ShoppingList): string {
  const items = list.items.filter((i) => !i.checked)
  const lines: string[] = [`Shopping List: ${list.name}`, '']
  const map = new Map<IngredientCategory, ShoppingItem[]>()
  for (const item of items) {
    const cat = item.category ?? 'Other'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(item)
  }
  for (const [cat, catItems] of map) {
    lines.push(cat)
    for (const item of catItems) {
      const qty = item.amount ? ` (${item.amount}${item.unit ? ' ' + item.unit : ''})` : ''
      lines.push(`- ${item.name}${qty}`)
    }
    lines.push('')
  }
  return lines.join('\n').trim()
}

export default function ShoppingListPage() {
  const toast = useToast()
  const qc = useQueryClient()
  const { user } = useAuth()
  const [unitSystem] = useUnitPreference()
  const [activeListId, setActiveListId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [startDate, setStartDate] = useState(() => toISODate(getMonday(new Date())))
  const [endDate, setEndDate] = useState(() => {
    const sun = getMonday(new Date())
    sun.setDate(sun.getDate() + 6)
    return toISODate(sun)
  })
  const [listName, setListName] = useState('')
  const [excludePantry, setExcludePantry] = useState(true)
  const [justChecked, setJustChecked] = useState<Set<string>>(new Set())
  const [showExport, setShowExport] = useState(false)
  const [showHouseholdShare, setShowHouseholdShare] = useState(false)
  const [households, setHouseholds] = useState<Household[]>([])
  const [householdsLoading, setHouseholdsLoading] = useState(false)
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null)

  const { data: lists = [], isLoading: loading } = useShoppingLists()
  const { data: activeList } = useShoppingList(activeListId ?? '')
  const { data: mealPlans = [] } = useMealPlans()
  const { data: recipes = [] } = useRecipes()
  const { data: pantryItems = [] } = usePantryItems()

  const createShoppingListMutation = useCreateShoppingList()
  const updateShoppingListMutation = useUpdateShoppingList()
  const deleteShoppingListMutation = useDeleteShoppingList()
  const toggleShoppingItemMutation = useToggleShoppingItem()
  const shareShoppingListMutation = useShareShoppingList()
  const unshareShoppingListMutation = useUnshareShoppingList()
  const creating = createShoppingListMutation.isPending

  useEffect(() => {
    const householdId = activeList?.householdId
    const listId = activeList?.id
    if (!householdId || !listId) return
    const unsub = subscribeToHouseholdShoppingLists(
      householdId,
      (updatedId) => {
        if (updatedId !== listId) return
        void qc.invalidateQueries({ queryKey: shoppingListKeys.detail(listId) })
        void qc.invalidateQueries({ queryKey: shoppingListKeys.all(user!.id) })
      },
      (deletedId) => {
        if (deletedId !== listId) return
        void qc.invalidateQueries({ queryKey: shoppingListKeys.detail(listId) })
      }
    )
    return unsub
  }, [activeList?.id, activeList?.householdId, user, qc])

  useEffect(() => {
    if (!showHouseholdShare || !user) return
    setHouseholdsLoading(true)
    void getMyHouseholds(user.id).then((h) => {
      setHouseholds(h)
      setSelectedHouseholdId(activeList?.householdId ?? h[0]?.id ?? null)
      setHouseholdsLoading(false)
    })
  }, [showHouseholdShare, user, activeList?.householdId])

  const recipesById = new Map(recipes.map((r) => [r.id, r]))
  const suggestions = useMemo(() => buildSuggestions(lists, recipes), [lists, recipes])

  const handleCreate = async () => {
    if (!listName.trim()) return
    const { items: aggregated, excludedCount } = aggregateIngredients(
      startDate, endDate, mealPlans, recipesById, excludePantry ? pantryItems : []
    )
    const itemsWithIds: ShoppingItem[] = aggregated.map((item) => ({ ...item, id: crypto.randomUUID() }))
    const list = await createShoppingListMutation.mutateAsync({ name: listName.trim(), items: itemsWithIds })
    setShowCreate(false)
    setListName('')
    setActiveListId(list.id)
    const sharedPlan = mealPlans.find((plan) => {
      if (!plan.householdId) return false
      const planEnd = (() => { const d = new Date(plan.weekStartDate + 'T00:00:00'); d.setDate(d.getDate() + 6); return d.toISOString().slice(0, 10) })()
      return planEnd >= startDate && plan.weekStartDate <= endDate
    })
    if (sharedPlan?.householdId) {
      await shareShoppingListMutation.mutateAsync({ listId: list.id, householdId: sharedPlan.householdId })
    }
    const base = excludedCount > 0
      ? `Shopping list created. ${excludedCount} pantry item${excludedCount !== 1 ? 's' : ''} excluded.`
      : 'Shopping list created.'
    toast.success(sharedPlan?.householdId ? `${base} Shared with your household.` : base)
  }

  const handleDelete = async (id: string) => {
    await deleteShoppingListMutation.mutateAsync(id)
    if (activeListId === id) setActiveListId(null)
  }

  const handleToggle = async (itemId: string) => {
    if (!activeListId) return
    const isChecking = activeList?.items.find((i) => i.id === itemId)?.checked === false
    if (isChecking) {
      setJustChecked((prev) => new Set([...prev, itemId]))
      setTimeout(() => setJustChecked((prev) => { const next = new Set(prev); next.delete(itemId); return next }), 300)
    }
    await toggleShoppingItemMutation.mutateAsync({ listId: activeListId, itemId })
  }

  const handleRemoveItem = async (itemId: string) => {
    if (!activeList) return
    const listId = activeList.id
    const removedItem = activeList.items.find((i) => i.id === itemId)
    if (!removedItem) return
    const items = activeList.items.filter((i) => i.id !== itemId)
    await updateShoppingListMutation.mutateAsync({ listId, data: { items } })
    toast.success(`"${removedItem.name}" removed.`, {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: async () => {
          const current = qc.getQueryData<ShoppingList | null>(shoppingListKeys.detail(listId))
          if (!current) return
          await updateShoppingListMutation.mutateAsync({ listId, data: { items: [...current.items, removedItem] } })
        },
      },
    })
  }

  const handleCategoryChange = async (itemId: string, newCat: IngredientCategory) => {
    if (!activeList) return
    const items = activeList.items.map((i) => (i.id === itemId ? { ...i, category: newCat } : i))
    await updateShoppingListMutation.mutateAsync({ listId: activeList.id, data: { items } })
  }

  const handleAmountChange = async (itemId: string, amount: number) => {
    if (!activeList) return
    const items = activeList.items.map((i) => (i.id === itemId ? { ...i, amount } : i))
    await updateShoppingListMutation.mutateAsync({ listId: activeList.id, data: { items } })
  }

  const handleAddItem = async (name: string, amount: number, unit: string) => {
    if (!activeList) return
    const newItem: ShoppingItem = {
      id: crypto.randomUUID(), name, amount, unit, checked: false, category: categorizeIngredient(name),
    }
    await updateShoppingListMutation.mutateAsync({
      listId: activeList.id, data: { items: [...activeList.items, newItem] },
    })
    toast.success(`"${newItem.name}" added.`)
  }

  const handleCopyToClipboard = async () => {
    if (!activeList) return
    await navigator.clipboard.writeText(formatListText(activeList))
    setShowExport(false)
    toast.success('Copied to clipboard.')
  }

  const handleShare = async () => {
    if (!activeList) return
    await navigator.share({ title: activeList.name, text: formatListText(activeList) })
    setShowExport(false)
  }

  const handleDownload = () => {
    if (!activeList) return
    const blob = new Blob([formatListText(activeList)], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeList.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.txt`
    a.click()
    URL.revokeObjectURL(url)
    setShowExport(false)
  }

  if (activeList) {
    return (
      <>
        <ShoppingListDetail
          activeList={activeList}
          justChecked={justChecked}
          unitSystem={unitSystem}
          suggestions={suggestions}
          onBack={() => setActiveListId(null)}
          onToggle={handleToggle}
          onRemoveItem={handleRemoveItem}
          onCategoryChange={handleCategoryChange}
          onAmountChange={handleAmountChange}
          onAddItem={handleAddItem}
          onOpenShare={() => setShowExport(true)}
          onOpenHouseholdShare={() => setShowHouseholdShare(true)}
        />

        {showHouseholdShare && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in" onClick={() => setShowHouseholdShare(false)}>
            <div role="dialog" aria-modal="true" aria-labelledby="household-share-dialog-title" className="bg-white dark:bg-gray-800 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl animate-slide-up sm:animate-scale-in" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 id="household-share-dialog-title" className="font-bold text-gray-800 dark:text-gray-100">Share with Household</h3>
                <button onClick={() => setShowHouseholdShare(false)} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors" aria-label="Close household sharing dialog">
                  <X size={20} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
              <div className="p-4">
                {activeList.householdId ? (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">This list is shared with your household. All members can see and check off items in real time.</p>
                    <button
                      onClick={async () => { await unshareShoppingListMutation.mutateAsync(activeList.id); setShowHouseholdShare(false); toast.success('Shopping list is now private.') }}
                      disabled={unshareShoppingListMutation.isPending}
                      className="w-full border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium py-2.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                    >
                      {unshareShoppingListMutation.isPending ? 'Removing…' : 'Stop sharing'}
                    </button>
                  </div>
                ) : householdsLoading ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Loading…</p>
                ) : households.length === 0 ? (
                  <p className="text-sm text-gray-600 dark:text-gray-300 text-center py-4">You're not in any household yet. Create or join one from your profile to share shopping lists.</p>
                ) : (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">Choose a household to share this list with:</p>
                    <div className="space-y-2 mb-4">
                      {households.map((h) => (
                        <label key={h.id} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${selectedHouseholdId === h.id ? 'border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-600' : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                          <input type="radio" name="household" value={h.id} checked={selectedHouseholdId === h.id} onChange={() => setSelectedHouseholdId(h.id)} className="accent-green-600" />
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{h.name}</span>
                        </label>
                      ))}
                    </div>
                    <button
                      onClick={async () => { if (!selectedHouseholdId) return; await shareShoppingListMutation.mutateAsync({ listId: activeList.id, householdId: selectedHouseholdId }); setShowHouseholdShare(false); toast.success('Shopping list shared with your household.') }}
                      disabled={!selectedHouseholdId || shareShoppingListMutation.isPending}
                      className="w-full bg-green-700 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {shareShoppingListMutation.isPending ? 'Sharing…' : 'Share with household'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showExport && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in" onClick={() => setShowExport(false)}>
            <div role="dialog" aria-modal="true" aria-labelledby="export-dialog-title" className="bg-white dark:bg-gray-800 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl animate-slide-up sm:animate-scale-in" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 id="export-dialog-title" className="font-bold text-gray-800 dark:text-gray-100">Share or Export</h3>
                <button onClick={() => setShowExport(false)} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors" aria-label="Close share or export dialog">
                  <X size={20} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
              <div className="p-4 space-y-2">
                {typeof navigator.share === 'function' && (
                  <button onClick={handleShare} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <Share2 size={18} strokeWidth={2} className="text-green-600 dark:text-green-400 shrink-0" aria-hidden="true" />
                    Share via…
                  </button>
                )}
                <button onClick={handleCopyToClipboard} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <Copy size={18} strokeWidth={2} className="text-green-600 dark:text-green-400 shrink-0" aria-hidden="true" />
                  Copy to clipboard
                </button>
                <button onClick={handleDownload} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <Download size={18} strokeWidth={2} className="text-green-600 dark:text-green-400 shrink-0" aria-hidden="true" />
                  Download as text file
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  // --- List view ---
  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Shopping Lists</h2>
        <button onClick={() => setShowCreate(true)} aria-label="New shopping list" className="bg-green-700 text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-green-800 transition-colors">
          + New List
        </button>
      </div>

      {loading ? (
        <div className="space-y-3" role="status" aria-busy="true" aria-label="Loading shopping lists">
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
            <div key={list.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => setActiveListId(list.id)}
                aria-label={`Open ${list.name}: ${total} item${total !== 1 ? 's' : ''}, ${done} checked`}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{list.name}</p>
                      {list.householdId && <Users size={13} strokeWidth={2} className="shrink-0 text-blue-500 dark:text-blue-400" aria-label="Shared with household" />}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {total} item{total !== 1 ? 's' : ''} &middot; {done} checked &middot; {formatDate(list.createdAt.slice(0, 10))}
                    </p>
                  </div>
                  <span className="text-gray-400 dark:text-gray-500 text-lg ml-2">&rsaquo;</span>
                </div>
                {total > 0 && (
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} aria-label={`${done} of ${total} items checked`}>
                    <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${(done / total) * 100}%` }} />
                  </div>
                )}
              </button>
              <div className="px-4 pb-3 flex justify-end">
                <button onClick={() => handleDelete(list.id)} aria-label={`Delete ${list.name}`} className="text-xs text-red-400 hover:text-red-600 transition-colors">
                  Delete
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in" onClick={() => setShowCreate(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="create-list-dialog-title" className="bg-white dark:bg-gray-800 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl animate-slide-up sm:animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 id="create-list-dialog-title" className="font-bold text-gray-800 dark:text-gray-100">New Shopping List</h3>
                <button onClick={() => setShowCreate(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" aria-label="Close new shopping list dialog">
                  <X size={20} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label htmlFor="new-list-name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">List name</label>
                <input id="new-list-name" type="text" value={listName} onChange={(e) => setListName(e.target.value)} placeholder="e.g. This week's groceries" className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Generate from meal plan</label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Select date range to pull ingredients from planned meals.</p>
                {pantryItems.length > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input type="checkbox" checked={excludePantry} onChange={(e) => setExcludePantry(e.target.checked)} className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
                    <span className="text-xs text-gray-600 dark:text-gray-300">Exclude {pantryItems.length} pantry item{pantryItems.length !== 1 ? 's' : ''} already at home</span>
                  </label>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="new-list-start-date" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Start date</label>
                    <input id="new-list-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                    <label htmlFor="new-list-end-date" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">End date</label>
                    <input id="new-list-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                </div>
              </div>
              <button onClick={handleCreate} disabled={!listName.trim() || creating} className="w-full bg-green-700 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {creating ? 'Creating…' : 'Create List'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
