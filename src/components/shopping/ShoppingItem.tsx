import { useState, useRef } from 'react'
import { X, Trash2 } from 'lucide-react'
import { convertUnit, type UnitSystem } from '../../lib/units'
import { ALL_CATEGORIES } from '../../lib/ingredientCategories'
import type { ShoppingItem as ShoppingItemType, IngredientCategory } from '../../types'

export const SWIPE_REVEAL = 80 // px

export const CATEGORY_COLORS: Record<IngredientCategory, string> = {
  Produce: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  'Meat & Seafood': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  'Dairy & Eggs': 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  Bakery: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Frozen: 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300',
  Pantry: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Other: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}

interface ShoppingItemProps {
  item: ShoppingItemType
  onToggle: () => void
  onRemove: () => void
  onCategoryChange: (cat: IngredientCategory) => void
  onAmountChange?: (amount: number) => void
  isJustChecked?: boolean
  unitSystem: UnitSystem
}

export default function ShoppingItemRow({
  item, onToggle, onRemove, onCategoryChange, onAmountChange, isJustChecked = false, unitSystem,
}: ShoppingItemProps) {
  const [editingCat, setEditingCat] = useState(false)
  const [editingAmount, setEditingAmount] = useState(false)
  const [draftAmount, setDraftAmount] = useState('')
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [swipeOpen, setSwipeOpen] = useState(false)
  const [isSwipeDragging, setIsSwipeDragging] = useState(false)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const swipeAxisLocked = useRef<'h' | 'v' | 'check' | null>(null)
  const cat = item.category ?? 'Other'
  const { amount: rawDisplayAmount, unit: displayUnit } = convertUnit(item.amount, item.unit, unitSystem)
  const displayAmount = Math.round(rawDisplayAmount * 10) / 10

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    swipeAxisLocked.current = null
    setIsSwipeDragging(false)
  }

  function handleTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current
    if (!swipeAxisLocked.current) {
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return
      swipeAxisLocked.current = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'check' : 'h') : 'v'
    }
    if (swipeAxisLocked.current === 'v') {
      setIsSwipeDragging(false)
      return
    }
    if (swipeAxisLocked.current === 'check') {
      // Swipe right = check off — show green hint but don't set offset
      setIsSwipeDragging(false)
      return
    }
    setIsSwipeDragging(true)
    e.preventDefault()
    const base = swipeOpen ? -SWIPE_REVEAL : 0
    setSwipeOffset(Math.max(-SWIPE_REVEAL, Math.min(0, base + dx)))
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (swipeAxisLocked.current === 'check') {
      const dx = e.changedTouches[0].clientX - touchStartX.current
      if (dx > 48) onToggle()
      setIsSwipeDragging(false)
      return
    }
    if (swipeAxisLocked.current !== 'h') {
      setIsSwipeDragging(false)
      return
    }
    if (swipeOffset < -SWIPE_REVEAL / 2) {
      setSwipeOffset(-SWIPE_REVEAL)
      setSwipeOpen(true)
    } else {
      setSwipeOffset(0)
      setSwipeOpen(false)
    }
    setIsSwipeDragging(false)
  }

  function closeSwipe() {
    setSwipeOffset(0)
    setSwipeOpen(false)
    setIsSwipeDragging(false)
  }

  function commitAmount() {
    const parsed = parseFloat(draftAmount)
    if (!isNaN(parsed) && parsed >= 0 && onAmountChange) {
      onAmountChange(parsed)
    }
    setEditingAmount(false)
  }

  if (item.checked) {
    return (
      <div className="flex items-center px-2 min-h-[44px] gap-1">
        <button
          onClick={onToggle}
          className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label={`Uncheck ${item.name}`}
        >
          <span className="w-5 h-5 rounded border-2 border-green-500 bg-green-500 text-white text-xs flex items-center justify-center" aria-hidden="true">&#10003;</span>
        </button>
        <span className="flex-1 text-sm text-gray-400 dark:text-gray-500 line-through">{item.name}</span>
        <span className="text-xs text-gray-300 dark:text-gray-600 shrink-0">{displayAmount} {displayUnit}</span>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden">
      {/* Red delete zone — revealed on left swipe */}
      <div
        className="absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-1 bg-red-500 text-white"
        style={{ width: SWIPE_REVEAL }}
        aria-hidden="true"
      >
        <button
          tabIndex={swipeOpen ? 0 : -1}
          onClick={() => { closeSwipe(); onRemove() }}
          className="w-full h-full flex flex-col items-center justify-center gap-1"
          aria-label={`Delete ${item.name}`}
        >
          <Trash2 size={18} strokeWidth={2} aria-hidden="true" />
          <span className="text-xs font-medium">Delete</span>
        </button>
      </div>

      {/* Swipeable row */}
      <div
        className="relative bg-white dark:bg-gray-800 flex items-center px-2 min-h-[44px] gap-1"
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwipeDragging ? 'none' : 'transform 0.22s ease',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <button
          onClick={() => { if (swipeOpen) { closeSwipe(); return } onToggle() }}
          className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label={`Check ${item.name}`}
        >
          <span
            className={`w-5 h-5 rounded border-2 flex items-center justify-center border-gray-300 dark:border-gray-600 ${isJustChecked ? 'animate-check-pop' : ''}`}
            aria-hidden="true"
          />
        </button>

        <div className="flex-1 min-w-0">
          <span className="text-sm text-gray-800 dark:text-gray-100">{item.name}</span>
          <div className="mt-0.5">
            {editingCat ? (
              <select
                value={cat}
                autoFocus
                onChange={(e) => { onCategoryChange(e.target.value as IngredientCategory); setEditingCat(false) }}
                onBlur={() => setEditingCat(false)}
                className="text-xs border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-green-500"
              >
                {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <button
                onClick={() => { if (swipeOpen) { closeSwipe(); return } setEditingCat(true) }}
                className={`text-xs px-1.5 py-0.5 rounded font-medium ${CATEGORY_COLORS[cat]} hover:opacity-80 transition-opacity`}
                aria-label={`Change category for ${item.name}: currently ${cat}`}
              >
                {cat}
              </button>
            )}
          </div>
        </div>

        {/* Inline amount edit */}
        {editingAmount ? (
          <input
            type="number"
            value={draftAmount}
            autoFocus
            min="0"
            step="any"
            onChange={(e) => setDraftAmount(e.target.value)}
            onBlur={commitAmount}
            onKeyDown={(e) => { if (e.key === 'Enter') commitAmount(); if (e.key === 'Escape') setEditingAmount(false) }}
            className="w-16 text-xs text-right border border-green-400 rounded px-1 py-0.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none"
            aria-label={`Edit amount for ${item.name}`}
          />
        ) : (
          <button
            onClick={() => {
              if (swipeOpen) { closeSwipe(); return }
              if (onAmountChange) {
                setDraftAmount(String(displayAmount))
                setEditingAmount(true)
              }
            }}
            className={`text-xs text-gray-400 dark:text-gray-500 shrink-0 ${onAmountChange ? 'hover:text-green-600 dark:hover:text-green-400 hover:underline' : ''}`}
            aria-label={onAmountChange ? `Edit amount for ${item.name}` : undefined}
          >
            {displayAmount} {displayUnit}
          </button>
        )}

        <button
          onClick={onRemove}
          className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors"
          aria-label={`Remove ${item.name}`}
        >
          <X size={14} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
