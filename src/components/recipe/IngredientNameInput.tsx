import { useId, useMemo, useState } from 'react'

export interface IngredientSuggestion {
  name: string
  unit: string
}

interface IngredientNameInputProps {
  value: string
  onChange: (name: string) => void
  onSelectSuggestion: (name: string, unit: string) => void
  allSuggestions: IngredientSuggestion[]
  placeholder?: string
  className?: string
}

export default function IngredientNameInput({
  value,
  onChange,
  onSelectSuggestion,
  allSuggestions,
  placeholder,
  className,
}: IngredientNameInputProps) {
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const listId = useId()

  const filtered = useMemo(() => {
    if (!value.trim()) return []
    const q = value.toLowerCase()
    return allSuggestions.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 6)
  }, [value, allSuggestions])

  const showDropdown = open && filtered.length > 0

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!showDropdown) {
        setOpen(true)
        return
      }
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && showDropdown && activeIdx >= 0) {
      e.preventDefault()
      const s = filtered[activeIdx]
      onSelectSuggestion(s.name, s.unit)
      setOpen(false)
      setActiveIdx(-1)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIdx(-1)
    }
  }

  return (
    <div className="relative flex-1">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActiveIdx(-1)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false)
          setActiveIdx(-1)
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        role="combobox"
        aria-expanded={showDropdown}
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-controls={showDropdown ? listId : undefined}
      />
      {showDropdown && (
        <ul
          id={listId}
          role="listbox"
          onMouseDown={(e) => e.preventDefault()}
          className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-md max-h-48 overflow-y-auto"
        >
          {filtered.map((s, idx) => (
            <li
              key={s.name}
              role="option"
              aria-selected={idx === activeIdx}
              onClick={() => {
                onSelectSuggestion(s.name, s.unit)
                setOpen(false)
                setActiveIdx(-1)
              }}
              onMouseEnter={() => setActiveIdx(idx)}
              className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between ${
                idx === activeIdx
                  ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <span>{s.name}</span>
              {s.unit && (
                <span className="text-xs text-gray-400 dark:text-gray-500 ml-2 shrink-0">
                  {s.unit}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
