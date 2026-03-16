import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  action?: ToastAction
  duration?: number
}

interface Toast {
  id: string
  type: ToastType
  message: string
  action?: ToastAction
  duration: number
}

interface ToastContextValue {
  toasts: Toast[]
  toast: {
    success: (message: string, opts?: ToastOptions) => void
    error: (message: string, opts?: ToastOptions) => void
    info: (message: string, opts?: ToastOptions) => void
  }
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const add = useCallback(
    (type: ToastType, message: string, opts?: ToastOptions) => {
      const id = crypto.randomUUID()
      const duration = opts?.duration ?? 3000
      setToasts((prev) => [...prev, { id, type, message, action: opts?.action, duration }])
      const timer = setTimeout(() => dismiss(id), duration)
      timers.current.set(id, timer)
    },
    [dismiss]
  )

  const toast = {
    success: (message: string, opts?: ToastOptions) => add('success', message, opts),
    error: (message: string, opts?: ToastOptions) => add('error', message, opts),
    info: (message: string, opts?: ToastOptions) => add('info', message, opts),
  }

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue['toast'] {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx.toast
}

export function useToasts(): Pick<ToastContextValue, 'toasts' | 'dismiss'> {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToasts must be used inside ToastProvider')
  return { toasts: ctx.toasts, dismiss: ctx.dismiss }
}
