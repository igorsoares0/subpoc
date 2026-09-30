"use client"

import { useEffect } from "react"
import { Check, Info, X } from "lucide-react"
import { useToastStore, type Toast } from "@/lib/toast"
import { cn } from "@/lib/utils"

// 20px circular badge; glyph is always #0E0E0C on the colored fill.
const BADGE: Record<Toast["variant"], { className: string; icon: React.ReactNode }> = {
  success: { className: "bg-accent", icon: <Check className="size-3 text-on-accent" strokeWidth={3} /> },
  error: { className: "bg-danger", icon: <X className="size-3 text-on-accent" strokeWidth={3} /> },
  info: { className: "bg-paper", icon: <Info className="size-3 text-canvas" strokeWidth={2.5} /> },
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss)

  useEffect(() => {
    if (toast.duration <= 0) return
    const timer = setTimeout(() => dismiss(toast.id), toast.duration)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, dismiss])

  const badge = BADGE[toast.variant]

  return (
    <div
      role="status"
      className="pointer-events-auto flex items-center gap-3 max-w-[420px] bg-elevated border border-line/12 rounded-lg shadow-[var(--shadow-menu)] pl-3 pr-2 py-2.5 animate-[toast-in_200ms_ease-out]"
    >
      <span className={cn("size-5 rounded-full flex items-center justify-center flex-none", badge.className)}>
        {badge.icon}
      </span>
      <p className="flex-1 text-[13px] leading-snug text-paper">{toast.message}</p>
      {toast.action && (
        <button
          onClick={() => {
            toast.action!.onClick()
            dismiss(toast.id)
          }}
          className="text-[12.5px] font-medium text-accent-ink hover:underline underline-offset-2 flex-none"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={() => dismiss(toast.id)}
        className="size-6 rounded-[6px] flex items-center justify-center text-ink-3 hover:text-paper hover:bg-hover transition-colors duration-150 flex-none"
        aria-label="Dismiss"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10000] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
