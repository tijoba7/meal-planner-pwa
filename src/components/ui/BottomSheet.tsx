import React from 'react'
import { Drawer } from 'vaul'
import { X } from 'lucide-react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  /** Extra classes applied to the sheet panel */
  className?: string
  children: React.ReactNode
}

/**
 * Mobile-first bottom sheet (vaul Drawer) with drag-to-dismiss.
 * On desktop (sm+) it repositions itself to the center of the screen
 * via CSS so it behaves like a standard dialog.
 *
 * Usage:
 *   <BottomSheet open={open} onClose={onClose} title="Options">
 *     {children}
 *   </BottomSheet>
 */
export function BottomSheet({
  open,
  onClose,
  title,
  description,
  className = '',
  children,
}: BottomSheetProps) {
  const dialogTitle = title ?? 'Dialog'
  const dialogDescription = description ?? `${dialogTitle} panel`

  return (
    <Drawer.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Drawer.Portal>
        {/* Backdrop */}
        <Drawer.Overlay className="fixed inset-0 bg-black/50 z-modal animate-fade-in" />

        {/* Sheet panel
            Mobile  : fixed to bottom, rounded top corners, drag handle visible
            Desktop : centred modal (sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2) */}
        <Drawer.Content
          aria-label={title}
          className={[
            // Base
            'fixed left-0 right-0 bottom-0 z-modal flex flex-col',
            'bg-white dark:bg-gray-800 shadow-[var(--shadow-modal)]',
            'rounded-t-2xl',
            // Desktop override — center it like a modal
            'sm:bottom-auto sm:top-1/2 sm:left-1/2',
            'sm:-translate-x-1/2 sm:-translate-y-1/2',
            'sm:max-w-md sm:w-full sm:rounded-2xl',
            className,
          ].join(' ')}
        >
          <Drawer.Title className="sr-only">{dialogTitle}</Drawer.Title>
          <Drawer.Description className="sr-only">{dialogDescription}</Drawer.Description>

          {/* Drag handle — hidden on desktop */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden" aria-hidden="true">
            <div className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
          </div>

          {/* Optional header */}
          {title && (
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <p className="text-base font-semibold text-gray-800 dark:text-gray-100">{title}</p>
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

          {/* Safe-area spacer for iOS home bar — hidden on desktop */}
          <div className="pb-[env(safe-area-inset-bottom)] sm:hidden" />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

/** Convenience body wrapper with standard padding — same as ModalBody. */
export function BottomSheetBody({
  className = '',
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={`p-5 ${className}`}>{children}</div>
}
