import { useId, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'

interface TagPickerProps {
  tags: string[]
  onChange: (tags: string[]) => void
  suggestions: string[]
  placeholder?: string
}

export default function TagPicker({
  tags,
  onChange,
  suggestions,
  placeholder = 'Add a tag…',
}: TagPickerProps) {
  const [inputVal, setInputVal] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const filtered = useMemo(() => {
    const available = suggestions.filter((s) => !tags.includes(s))
    if (!inputVal.trim()) return available.slice(0, 8)
    const q = inputVal.toLowerCase()
    return available.filter((s) => s.toLowerCase().includes(q)).slice(0, 6)
  }, [inputVal, suggestions, tags])

  const showDropdown = open && filtered.length > 0

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase()
    if (!tag || tags.includes(tag)) return
    onChange([...tags, tag])
    setInputVal('')
    setActiveIdx(-1)
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (showDropdown && activeIdx >= 0) {
        addTag(filtered[activeIdx])
      } else if (inputVal.trim()) {
        addTag(inputVal)
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIdx(-1)
    } else if (e.key === 'Backspace' && !inputVal && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  return (
    <div
      className="flex flex-wrap gap-1.5 min-h-[42px] px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg cursor-text focus-within:ring-2 focus-within:ring-green-500 dark:bg-gray-800"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs px-2 py-0.5 rounded-full"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              removeTag(tag)
            }}
            aria-label={`Remove tag ${tag}`}
            className="hover:text-green-900 dark:hover:text-green-200"
          >
            <X size={10} strokeWidth={2.5} aria-hidden="true" />
          </button>
        </span>
      ))}
      <div className="relative flex-1 min-w-[120px]">
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={(e) => {
            setInputVal(e.target.value)
            setOpen(true)
            setActiveIdx(-1)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false)
            setActiveIdx(-1)
          }}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="w-full text-sm bg-transparent outline-none text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 py-1"
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-controls={showDropdown ? listId : undefined}
          autoComplete="off"
        />
        {showDropdown && (
          <ul
            id={listId}
            role="listbox"
            onMouseDown={(e) => e.preventDefault()}
            className="absolute z-10 mt-1 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-md max-h-40 overflow-y-auto"
          >
            {filtered.map((s, idx) => (
              <li
                key={s}
                role="option"
                aria-selected={idx === activeIdx}
                onClick={() => addTag(s)}
                onMouseEnter={() => setActiveIdx(idx)}
                className={`px-3 py-1.5 text-sm cursor-pointer ${
                  idx === activeIdx
                    ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
