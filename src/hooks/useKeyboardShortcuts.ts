import { useEffect, useLayoutEffect, useRef } from 'react'

function isEditableTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  return false
}

/**
 * Register global keyboard shortcuts.
 * Shortcuts are ignored when the user is focused inside an editable element.
 *
 * @param shortcuts Map of key string to handler. The key string is the
 *   `KeyboardEvent.key` value (e.g. 'n', '/', '?', 'ArrowLeft').
 * @param enabled  Whether shortcuts are active (default true).
 */
export function useKeyboardShortcuts(
  shortcuts: Record<string, () => void>,
  enabled = true,
) {
  const shortcutsRef = useRef(shortcuts)
  useLayoutEffect(() => {
    shortcutsRef.current = shortcuts
  })

  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(e: KeyboardEvent) {
      // Skip modifier combos (Ctrl, Alt, Meta) to avoid conflicts with browser/OS shortcuts
      if (e.ctrlKey || e.altKey || e.metaKey) return
      if (isEditableTarget(e.target)) return

      const handler = shortcutsRef.current[e.key]
      if (handler) {
        e.preventDefault()
        handler()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled])
}
