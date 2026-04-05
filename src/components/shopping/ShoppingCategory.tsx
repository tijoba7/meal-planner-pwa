import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ShoppingItem, IngredientCategory } from '../../types'
import type { UnitSystem } from '../../lib/units'
import ShoppingItemRow from './ShoppingItem'

interface ShoppingCategoryProps {
  category: IngredientCategory
  items: ShoppingItem[]
  onToggle: (id: string) => void
  onRemove: (id: string) => void
  onCategoryChange: (id: string, cat: IngredientCategory) => void
  onAmountChange?: (id: string, amount: number) => void
  justChecked: Set<string>
  unitSystem: UnitSystem
}

export default function ShoppingCategory({
  category, items, onToggle, onRemove, onCategoryChange, onAmountChange, justChecked, unitSystem,
}: ShoppingCategoryProps) {
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
        <span className={`text-xs font-semibold uppercase tracking-wider ${allChecked ? 'text-gray-300 dark:text-gray-600 line-through' : 'text-gray-500 dark:text-gray-400'}`}>
          {category}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">({uncheckedCount}/{items.length})</span>
      </button>

      {!collapsed && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {items.map((item, i) => (
            <div key={item.id} className={i > 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''}>
              <ShoppingItemRow
                item={item}
                onToggle={() => onToggle(item.id)}
                isJustChecked={justChecked.has(item.id)}
                onRemove={() => onRemove(item.id)}
                onCategoryChange={(cat) => onCategoryChange(item.id, cat)}
                onAmountChange={onAmountChange ? (amount) => onAmountChange(item.id, amount) : undefined}
                unitSystem={unitSystem}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
