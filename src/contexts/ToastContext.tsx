import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastContextValue {
  toasts: Toast[]
  toast: {
    success: (message: string) => void
    error: (message: string) => void
    info: (message: string) => void
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
    (type: ToastType, message: string) => {
      const id = crypto.randomUUID()
      setToasts((prev) => [...prev, { id, type, message }])
      const timer = setTimeout(() => dismiss(id), 3000)
      timers.current.set(id, timer)
    },
    [dismiss]
  )

  const toast = {
    success: (message: string) => add('success', message),
    error: (message: string) => add('error', message),
    info: (message: string) => add('info', message),
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
