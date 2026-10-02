"use client"

import { useEffect } from "react"
import { Check, Info, X } from "lucide-react"
import { useToastStore, type Toast } from "@/lib/toast"
import { cn } from "@/lib/utils"

// 24px circular badge on the inverse pill.
const BADGE: Record<Toast["variant"], { className: string; icon: React.ReactNode }> = {
  success: { className: "bg-accent", icon: <Check className="size-[13px] text-white" strokeWidth={2.5} /> },
  error: { className: "bg-danger", icon: <X className="size-[13px] text-white" strokeWidth={2.5} /> },
  info: { className: "bg-canvas/20", icon: <Info className="size-[13px] text-canvas" strokeWidth={2.5} /> },
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss)

  useEffect(() => {
    if (toast.duration <= 0) return
    const timer = setTimeout(() => dismiss(toast.id), toast.duration)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, dismiss])

  const badge = BADGE[toast.variant]
  // Persistent toasts (no auto-dismiss) need a close button; others stay a clean pill.
  const closable = toast.duration <= 0

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex items-center gap-2.5 min-h-11 max-w-[560px] rounded-full bg-paper text-canvas shadow-[var(--shadow-toast)] pl-2.5 py-[7px] animate-[toast-in_200ms_ease-out]",
        toast.action || closable ? "pr-2" : "pr-[18px]"
      )}
    >
      <span className={cn("size-6 rounded-full flex items-center justify-center flex-none", badge.className)}>
        {badge.icon}
      </span>
      <p className="flex-1 text-[13.5px] font-semibold leading-snug">{toast.message}</p>
      {toast.action && (
        <button
          onClick={() => {
            toast.action!.onClick()
            dismiss(toast.id)
          }}
          className="h-[30px] px-3 rounded-full bg-canvas/15 text-[13px] font-semibold text-canvas hover:bg-canvas/25 flex-none cursor-pointer"
        >
          {toast.action.label}
        </button>
      )}
      {closable && (
        <button
          onClick={() => dismiss(toast.id)}
          className="size-[30px] rounded-full flex items-center justify-center text-canvas/70 hover:text-canvas hover:bg-canvas/15 flex-none cursor-pointer"
          aria-label="Dismiss"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

/**
 * Bottom-centered toast stack. Pages can lift it with the `--toast-bottom`
 * CSS variable (the editor sets it so toasts sit above the timeline).
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[10000] flex flex-col items-center gap-2 pointer-events-none"
      style={{ bottom: "var(--toast-bottom, 32px)" }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
