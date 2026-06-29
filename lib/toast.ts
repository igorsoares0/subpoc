import { create } from "zustand"

export type ToastVariant = "error" | "success" | "info"

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface Toast {
  id: number
  message: string
  variant: ToastVariant
  action?: ToastAction
  /** Auto-dismiss delay in ms. 0 keeps the toast until dismissed manually. */
  duration: number
}

interface ToastStore {
  toasts: Toast[]
  push: (toast: Omit<Toast, "id">) => number
  dismiss: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = nextId++
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))
    return id
  },
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

// Imperative helper so call sites don't need the hook.
// Errors stick around longer (and forever when they carry an action) so the
// user has time to read them and click "Try again".
export const toast = {
  error: (message: string, action?: ToastAction) =>
    useToastStore.getState().push({
      message,
      variant: "error",
      action,
      duration: action ? 0 : 6000,
    }),
  success: (message: string) =>
    useToastStore.getState().push({ message, variant: "success", duration: 3000 }),
  info: (message: string) =>
    useToastStore.getState().push({ message, variant: "info", duration: 4000 }),
}
