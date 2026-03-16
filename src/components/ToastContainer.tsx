import { X } from 'lucide-react'
import { useToasts, type ToastType } from '../contexts/ToastContext'

const STYLES: Record<ToastType, string> = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-gray-800 text-white dark:bg-gray-700',
}

export default function ToastContainer() {
  const { toasts, dismiss } = useToasts()

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-20 inset-x-4 md:bottom-4 md:left-auto md:right-4 md:w-80 z-50 flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-auto animate-fade-in-up ${STYLES[t.type]}`}
        >
          <span className="flex-1">{t.message}</span>
          {t.action && (
            <button
              onClick={() => { t.action!.onClick(); dismiss(t.id) }}
              className="shrink-0 text-sm font-bold underline hover:no-underline opacity-90 hover:opacity-100 transition-opacity"
            >
              {t.action.label}
            </button>
          )}
          <button
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss notification"
            className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
          >
            <X size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  )
}
