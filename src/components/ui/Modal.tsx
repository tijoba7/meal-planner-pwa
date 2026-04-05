import React, { useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { useFocusTrap } from '../../hooks/useFocusTrap'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  /** 'bottom' slides up from bottom on mobile, centered on desktop (default for most dialogs).
   *  'center' is always centered (use for confirmation dialogs). */
  position?: 'bottom' | 'center'
  /** Extra classes for the panel */
  className?: string
  children: React.ReactNode
}

/**
 * Modal/Dialog shell — backdrop + focus-trapped panel.
 * Matches ShoppingListPage and PlannerPage modal patterns.
 */
export function Modal({
  open,
  onClose,
  title,
  position = 'bottom',
  className = '',
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef)

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const backdropAlign =
    position === 'center' ? 'items-center p-4' : 'items-end sm:items-center sm:p-4'

  const panelRounding = position === 'center' ? 'rounded-xl' : 'rounded-t-2xl sm:rounded-2xl'

  const panelAnimation =
    position === 'center' ? 'animate-scale-in' : 'animate-slide-up sm:animate-scale-in'

  return (
    <div
      className={`fixed inset-0 bg-black/50 z-modal flex justify-center ${backdropAlign} animate-fade-in`}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-white dark:bg-gray-800 w-full max-w-md shadow-xl ${panelRounding} ${panelAnimation} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">{title}</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close"
            >
              <X size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

/** Convenience body wrapper with standard padding. */
export function ModalBody({
  className = '',
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={`p-5 ${className}`}>{children}</div>
}

/** Confirmation dialog variant — always centered, small max-width. */
interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  loading?: boolean
  danger?: boolean
}

export function ConfirmModal({
  open,
  onClose,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  loading = false,
  danger = false,
}: ConfirmModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef)

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 z-modal flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-sm w-full shadow-xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h4
          id="confirm-modal-title"
          className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2"
        >
          {title}
        </h4>
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{description}</p>
        )}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 text-white text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50 ${danger ? 'bg-red-500 hover:bg-red-600' : 'bg-green-700 hover:bg-green-800'}`}
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
