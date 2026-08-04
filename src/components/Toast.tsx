'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

type ToastAction = { label: string; run: () => void }
type Toast = { id: number; message: string; action?: ToastAction }

type ToastApi = {
  show: (message: string, action?: ToastAction) => void
}

const ToastContext = createContext<ToastApi | null>(null)

/** Undo lives here: "Hecho" needs a way back, and a dialog would be too heavy. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nextId = useRef(0)

  const show = useCallback((message: string, action?: ToastAction) => {
    if (timer.current) clearTimeout(timer.current)
    nextId.current += 1
    setToast({ id: nextId.current, message, action })
    timer.current = setTimeout(() => setToast(null), action ? 6000 : 3200)
  }, [])

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const api = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && (
        <div className="dg-toast" role="status" aria-live="polite">
          <span>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action!.run()
                setToast(null)
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  // Falling back to a no-op keeps components usable outside the provider
  // (e.g. the auth screens) without a null check at every call site.
  return api ?? { show: () => {} }
}
