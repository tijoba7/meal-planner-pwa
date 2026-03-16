import { useEffect, useState, useRef } from 'react'
import { Package, Plus, Trash2, Pencil, X, Check } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import { useToast } from '../contexts/ToastContext'
import type { PantryItem, IngredientCategory } from '../types'
import { getPantryItems, createPantryItem, updatePantryItem, deletePantryItem } from '../lib/db'
import { categorizeIngredient, ALL_CATEGORIES } from '../lib/ingredientCategories'

const UNITS = ['', 'g', 'kg', 'ml', 'L', 'tsp', 'tbsp', 'cup', 'cups', 'oz', 'lb', 'piece', 'pieces', 'can', 'bag', 'box', 'bunch', 'cloves', 'slices']

const CATEGORY_COLORS: Record<IngredientCategory, string> = {
  Produce: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  'Meat & Seafood': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  'Dairy & Eggs': 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  Bakery: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Frozen: 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300',
  Pantry: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Other: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}

function isExpiringSoon(expiryDate: string): boolean {
  const expiry = new Date(expiryDate + 'T00:00:00')
  const now = new Date()
  const diff = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  return diff >= 0 && diff <= 7
}

function isExpired(expiryDate: string): boolean {
  const expiry = new Date(expiryDate + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return expiry < now
}

interface ItemFormState {
  name: string
  quantity: string
  unit: string
  expiryDate: string
}

const BLANK_FORM: ItemFormState = { name: '', quantity: '', unit: '', expiryDate: '' }

function groupByCategory(items: PantryItem[]): Array<[IngredientCategory, PantryItem[]]> {
  const map = new Map<IngredientCategory, PantryItem[]>()
  for (const cat of ALL_CATEGORIES) map.set(cat, [])
  for (const item of items) {
    const cat = item.category ?? 'Other'
    map.get(cat)!.push(item)
  }
  return Array.from(map.entries()).filter(([, list]) => list.length > 0)
}

export default function PantryPage() {
  const [items, setItems] = useState<PantryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<ItemFormState>(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ItemFormState>(BLANK_FORM)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const nameInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  useEffect(() => {
    getPantryItems().then((data) => {
      setItems(data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (showAdd) nameInputRef.current?.focus()
  }, [showAdd])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const name = form.name.trim()
    if (!name) return
    setSaving(true)
    const item = await createPantryItem({
      name,
      quantity: parseFloat(form.quantity) || 1,
      unit: form.unit,
      expiryDate: form.expiryDate || undefined,
      category: categorizeIngredient(name),
    })
    setItems((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)))
    setForm(BLANK_FORM)
    setShowAdd(false)
    setSaving(false)
    toast.success(`"${item.name}" added to pantry.`)
  }

  function startEdit(item: PantryItem) {
    setEditingId(item.id)
    setEditForm({
      name: item.name,
      quantity: String(item.quantity),
      unit: item.unit,
      expiryDate: item.expiryDate ?? '',
    })
  }

  async function handleSaveEdit(itemId: string) {
    const name = editForm.name.trim()
    if (!name) return
    const updated = await updatePantryItem(itemId, {
      name,
      quantity: parseFloat(editForm.quantity) || 1,
      unit: editForm.unit,
      expiryDate: editForm.expiryDate || undefined,
      category: categorizeIngredient(name),
    })
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? updated : i)).sort((a, b) => a.name.localeCompare(b.name))
    )
    setEditingId(null)
    toast.success('Pantry item updated.')
  }

  async function handleDelete(itemId: string) {
    const item = items.find((i) => i.id === itemId)
    await deletePantryItem(itemId)
    setItems((prev) => prev.filter((i) => i.id !== itemId))
    setConfirmDeleteId(null)
    if (item) toast.success(`"${item.name}" removed from pantry.`)
  }

  function toggleCollapse(cat: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const groups = groupByCategory(items)
  const expiredCount = items.filter((i) => i.expiryDate && isExpired(i.expiryDate)).length
  const expiringSoonCount = items.filter((i) => i.expiryDate && !isExpired(i.expiryDate) && isExpiringSoon(i.expiryDate)).length

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Pantry</h2>
          {items.length > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {items.length} item{items.length !== 1 ? 's' : ''}
              {expiredCount > 0 && (
                <span className="ml-2 text-red-500">{expiredCount} expired</span>
              )}
              {expiringSoonCount > 0 && (
                <span className="ml-2 text-amber-600">{expiringSoonCount} expiring soon</span>
              )}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-green-700 text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-green-800 transition-colors"
        >
          <Plus size={14} aria-hidden="true" />
          Add Item
        </button>
      </div>

      {/* Add item form */}
      {showAdd && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Add pantry item</h3>
            <button
              onClick={() => { setShowAdd(false); setForm(BLANK_FORM) }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Cancel"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label htmlFor="pantry-name" className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                Item name <span className="text-red-500">*</span>
              </label>
              <input
                ref={nameInputRef}
                id="pantry-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Olive oil"
                required
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="pantry-qty" className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Quantity</label>
                <input
                  id="pantry-qty"
                  type="number"
                  min="0"
                  step="any"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                  placeholder="1"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label htmlFor="pantry-unit" className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Unit</label>
                <select
                  id="pantry-unit"
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>{u || '—'}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="pantry-expiry" className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Expiry date (optional)</label>
              <input
                id="pantry-expiry"
                type="date"
                value={form.expiryDate}
                onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={!form.name.trim() || saving}
                className="flex-1 bg-green-700 text-white text-sm font-medium py-2 rounded-lg hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Adding…' : 'Add to Pantry'}
              </button>
              <button
                type="button"
                onClick={() => { setShowAdd(false); setForm(BLANK_FORM) }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2" />
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, j) => (
                  <div key={j} className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-2/3" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Your pantry is empty"
          description="Track what you have at home. Items in your pantry will be excluded when generating shopping lists."
          action={{ label: 'Add your first item', onClick: () => setShowAdd(true) }}
        />
      ) : (
        <div className="space-y-4">
          {groups.map(([category, catItems]) => (
            <div key={category} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => toggleCollapse(category)}
                className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                aria-expanded={!collapsed.has(category)}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[category]}`}>
                    {category}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{catItems.length}</span>
                </div>
                <span className="text-gray-400 dark:text-gray-500 text-xs">
                  {collapsed.has(category) ? '▸' : '▾'}
                </span>
              </button>

              {!collapsed.has(category) && (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {catItems.map((item) => (
                    <li key={item.id} className="px-4 py-3">
                      {editingId === item.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                            autoFocus
                            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={editForm.quantity}
                              onChange={(e) => setEditForm((f) => ({ ...f, quantity: e.target.value }))}
                              placeholder="Qty"
                              className="border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                            <select
                              value={editForm.unit}
                              onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))}
                              className="border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                            >
                              {UNITS.map((u) => (
                                <option key={u} value={u}>{u || '—'}</option>
                              ))}
                            </select>
                          </div>
                          <input
                            type="date"
                            value={editForm.expiryDate}
                            onChange={(e) => setEditForm((f) => ({ ...f, expiryDate: e.target.value }))}
                            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveEdit(item.id)}
                              disabled={!editForm.name.trim()}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors disabled:opacity-50"
                            >
                              <Check size={12} aria-hidden="true" />
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                              <X size={12} aria-hidden="true" />
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : confirmDeleteId === item.id ? (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-300">Remove "{item.name}"?</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="px-3 py-1 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                            >
                              Remove
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                              Keep
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{item.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {item.quantity} {item.unit || ''}
                              {item.expiryDate && (
                                <span
                                  className={
                                    isExpired(item.expiryDate)
                                      ? ' ml-2 text-red-500 font-medium'
                                      : isExpiringSoon(item.expiryDate)
                                      ? ' ml-2 text-amber-600 font-medium'
                                      : ' ml-2 text-gray-400 dark:text-gray-500'
                                  }
                                >
                                  {isExpired(item.expiryDate)
                                    ? '· Expired'
                                    : isExpiringSoon(item.expiryDate)
                                    ? `· Expires soon`
                                    : `· Exp. ${new Date(item.expiryDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => startEdit(item)}
                              aria-label={`Edit ${item.name}`}
                              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                              <Pencil size={14} aria-hidden="true" />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(item.id)}
                              aria-label={`Remove ${item.name}`}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                              <Trash2 size={14} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
