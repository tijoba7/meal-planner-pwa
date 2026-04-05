import { useState, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Share2, Users, Plus, ChevronLeft } from 'lucide-react'
import EmptyState from '../EmptyState'
import { ClipboardIllustration } from '../EmptyStateIllustrations'
import ShoppingCategory from './ShoppingCategory'
import ShoppingItemRow from './ShoppingItem'
import AddItemForm from './AddItemForm'
import type { ShoppingList, IngredientCategory } from '../../types'
import type { UnitSystem } from '../../lib/units'
import type { SuggestionEntry } from './types'
import { groupByCategory } from './utils'

interface ShoppingListDetailProps {
  activeList: ShoppingList
  justChecked: Set<string>
  unitSystem: UnitSystem
  suggestions: SuggestionEntry[]
  onBack: () => void
  onToggle: (itemId: string) => void
  onRemoveItem: (itemId: string) => void
  onCategoryChange: (itemId: string, cat: IngredientCategory) => void
  onAmountChange: (itemId: string, amount: number) => void
  onAddItem: (name: string, amount: number, unit: string) => void
  onOpenShare: () => void
  onOpenHouseholdShare: () => void
}

export default function ShoppingListDetail({
  activeList, justChecked, unitSystem, suggestions, onBack,
  onToggle, onRemoveItem, onCategoryChange, onAmountChange, onAddItem,
  onOpenShare, onOpenHouseholdShare,
}: ShoppingListDetailProps) {
  const [showAddItem, setShowAddItem] = useState(false)
  const unchecked = activeList.items.filter((i) => !i.checked)
  const checked = activeList.items.filter((i) => i.checked)
  const total = activeList.items.length
  const doneCount = checked.length
  const uncheckedGroups = groupByCategory(unchecked)

  // Virtual scroller for large checked lists
  const checkedParentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: checked.length,
    getScrollElement: () => checkedParentRef.current,
    estimateSize: () => 44,
    overscan: 5,
  })

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <button
        onClick={onBack}
        className="text-sm text-green-600 dark:text-green-400 font-medium mb-4 flex items-center gap-1 hover:text-green-700 dark:hover:text-green-300 transition-colors"
      >
        <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" /> All lists
      </button>

      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{activeList.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-gray-500 dark:text-gray-400">{doneCount} of {total} items checked</p>
            {activeList.householdId && (
              <span className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                <Users size={12} aria-hidden="true" />
                Shared
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <button
            onClick={onOpenHouseholdShare}
            className={`flex items-center gap-1 text-sm transition-colors ${activeList.householdId ? 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300' : 'text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400'}`}
            aria-label={activeList.householdId ? 'Manage household sharing' : 'Share with household'}
          >
            <Users size={16} strokeWidth={2} aria-hidden="true" />
          </button>
          {total > 0 && (
            <button
              onClick={onOpenShare}
              className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
              aria-label="Share or export list"
            >
              <Share2 size={16} strokeWidth={2} aria-hidden="true" />
              Share
            </button>
          )}
        </div>
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
          <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${(doneCount / total) * 100}%` }} />
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
        <ShoppingCategory
          key={cat}
          category={cat}
          items={items}
          onToggle={onToggle}
          onRemove={onRemoveItem}
          onCategoryChange={onCategoryChange}
          onAmountChange={onAmountChange}
          justChecked={justChecked}
          unitSystem={unitSystem}
        />
      ))}

      {showAddItem ? (
        <AddItemForm
          suggestions={suggestions}
          onAdd={(name, amount, unit) => { onAddItem(name, amount, unit); setShowAddItem(false) }}
          onCancel={() => setShowAddItem(false)}
        />
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
          {/* Virtualized checked list for large sets */}
          <div ref={checkedParentRef} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden" style={{ maxHeight: checked.length > 20 ? '400px' : undefined, overflowY: checked.length > 20 ? 'auto' : undefined }}>
            {checked.length > 20 ? (
              <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
                {virtualizer.getVirtualItems().map((vRow) => {
                  const item = checked[vRow.index]
                  return (
                    <div
                      key={item.id}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vRow.start}px)` }}
                      className={vRow.index > 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''}
                    >
                      <ShoppingItemRow item={item} unitSystem={unitSystem} onToggle={() => onToggle(item.id)} onRemove={() => onRemoveItem(item.id)} onCategoryChange={(cat) => onCategoryChange(item.id, cat)} />
                    </div>
                  )
                })}
              </div>
            ) : (
              checked.map((item, i) => (
                <div key={item.id} className={i > 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''}>
                  <ShoppingItemRow item={item} unitSystem={unitSystem} onToggle={() => onToggle(item.id)} onRemove={() => onRemoveItem(item.id)} onCategoryChange={(cat) => onCategoryChange(item.id, cat)} />
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

