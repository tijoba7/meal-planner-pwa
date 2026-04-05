import { useState, useMemo, useId } from 'react'

type SuggestionEntry = { name: string; unit: string }

/** Parse "2 cups flour" or "1/2 lb chicken" → { name, amount, unit }. Returns null if no match. */
export function parseQuickAdd(raw: string): { name: string; amount: number; unit: string } | null {
  const UNITS =
    /^(cups?|tbsps?|tsps?|lbs?|oz|g|kg|ml|l|liters?|pounds?|ounces?|grams?|kilograms?|cans?|bunches?|cloves?|slices?|pieces?|heads?|stalks?|sprigs?)$/i
  const m = raw.trim().match(/^(\d+(?:[./]\d+)?)\s+(\S+)\s+(.+)$/)
  if (!m) return null
  const [, qty, possibleUnit, rest] = m
  if (!UNITS.test(possibleUnit)) return null
  const amount = qty.includes('/')
    ? (() => { const [n, d] = qty.split('/'); return +n / +d })()
    : parseFloat(qty)
  return { name: rest.trim(), amount, unit: possibleUnit.trim() }
}

function ItemNameInput({
  value, onChange, onSelectSuggestion, suggestions,
}: {
  value: string
  onChange: (v: string) => void
  onSelectSuggestion: (name: string, unit: string) => void
  suggestions: SuggestionEntry[]
}) {
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const listId = useId()
  const parsed = useMemo(() => parseQuickAdd(value), [value])
  const filtered = useMemo(() => {
    if (!value.trim()) return []
    const q = (parsed?.name ?? value).toLowerCase()
    return suggestions.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 8)
  }, [value, suggestions, parsed])
  const showDropdown = open && filtered.length > 0

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!showDropdown) { setOpen(true); return }
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && showDropdown && activeIdx >= 0) {
      e.preventDefault()
      const s = filtered[activeIdx]
      onSelectSuggestion(s.name, s.unit)
      setOpen(false); setActiveIdx(-1)
    } else if (e.key === 'Escape') {
      setOpen(false); setActiveIdx(-1)
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActiveIdx(-1) }}
        onFocus={() => setOpen(true)}
        onBlur={() => { setOpen(false); setActiveIdx(-1) }}
        onKeyDown={handleKeyDown}
        placeholder='Name or "2 cups flour"'
        aria-label="Item name"
        autoComplete="off"
        autoFocus
        role="combobox"
        aria-expanded={showDropdown}
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-controls={showDropdown ? listId : undefined}
        className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      {parsed && (
        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
          <span className="text-xs text-green-600 dark:text-green-400 font-medium bg-white dark:bg-gray-700 pl-1">
            {parsed.amount} {parsed.unit}
          </span>
        </div>
      )}
      {showDropdown && (
        <ul id={listId} role="listbox" onMouseDown={(e) => e.preventDefault()} className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-md max-h-48 overflow-y-auto">
          {filtered.map((s, idx) => (
            <li
              key={s.name}
              role="option"
              aria-selected={idx === activeIdx}
              onClick={() => { onSelectSuggestion(s.name, s.unit); setOpen(false); setActiveIdx(-1) }}
              onMouseEnter={() => setActiveIdx(idx)}
              className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between ${idx === activeIdx ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
              <span>{s.name}</span>
              {s.unit && <span className="text-xs text-gray-400 dark:text-gray-500 ml-2 shrink-0">{s.unit}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface AddItemFormProps {
  suggestions: SuggestionEntry[]
  onAdd: (name: string, amount: number, unit: string) => void
  onCancel: () => void
}

export default function AddItemForm({ suggestions, onAdd, onCancel }: AddItemFormProps) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [unit, setUnit] = useState('')

  function handleAdd() {
    if (!name.trim()) return
    const quickParsed = parseQuickAdd(name.trim())
    const resolvedName = quickParsed?.name ?? name.trim()
    const resolvedAmount = parseFloat(amount) || quickParsed?.amount || 0
    const resolvedUnit = unit.trim() || quickParsed?.unit || ''
    onAdd(resolvedName, resolvedAmount, resolvedUnit)
    setName(''); setAmount(''); setUnit('')
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">Add item</p>
      <div className="space-y-3">
        <ItemNameInput
          value={name}
          onChange={setName}
          onSelectSuggestion={(n, u) => { setName(n); if (!unit.trim()) setUnit(u) }}
          suggestions={suggestions}
        />
        <div className="flex gap-2">
          <input
            type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="Qty" aria-label="Quantity" min="0" step="any"
            className="w-20 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <input
            type="text" value={unit} onChange={(e) => setUnit(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
            placeholder="Unit (e.g. oz)" aria-label="Unit"
            className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleAdd}
            disabled={!name.trim()}
            className="flex-1 bg-green-700 text-white text-sm font-medium py-2 rounded-lg hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >Add</button>
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >Cancel</button>
        </div>
      </div>
    </div>
  )
}
