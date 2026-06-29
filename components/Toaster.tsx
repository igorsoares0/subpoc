"use client"

import { useEffect } from "react"
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react"
import { useToastStore, type Toast } from "@/lib/toast"

const VARIANT_STYLES: Record<
  Toast["variant"],
  { border: string; icon: React.ReactNode }
> = {
  error: {
    border: "border-red-500/30",
    icon: <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />,
  },
  success: {
    border: "border-emerald-500/30",
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />,
  },
  info: {
    border: "border-blue-500/30",
    icon: <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />,
  },
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss)

  useEffect(() => {
    if (toast.duration <= 0) return
    const timer = setTimeout(() => dismiss(toast.id), toast.duration)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, dismiss])

  const variant = VARIANT_STYLES[toast.variant]

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 w-[320px] bg-[#1e1e24] border ${variant.border} rounded-xl shadow-2xl px-4 py-3`}
    >
      {variant.icon}
      <p className="flex-1 text-[13px] leading-snug text-zinc-100">{toast.message}</p>
      {toast.action && (
        <button
          onClick={() => {
            toast.action!.onClick()
            dismiss(toast.id)
          }}
          className="text-[12px] font-medium text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={() => dismiss(toast.id)}
        className="text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)

  return (
    <div className="fixed bottom-4 right-4 z-[10000] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
