"use client"

import { useEffect } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { IconButton } from "@/components/ui/Button"

/**
 * Modal shell: backdrop + centered card (radius 20) that fades/scales in.
 * Closes on Esc and backdrop click unless `locked` (e.g. while a request runs).
 */
export function Dialog({
  open,
  onClose,
  locked,
  width = 460,
  padding = 24,
  label,
  className,
  children,
}: {
  open: boolean
  onClose: () => void
  locked?: boolean
  width?: number
  padding?: number
  /** Accessible name for the dialog. */
  label: string
  className?: string
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!open || locked) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, locked, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-[var(--backdrop)] animate-[fade-in_150ms_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !locked) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={cn(
          "w-full max-h-[calc(100vh-32px)] overflow-y-auto bg-canvas rounded-[20px] shadow-[var(--shadow-modal)] flex flex-col animate-[dialog-in_150ms_ease-out]",
          className
        )}
        style={{ maxWidth: width, padding }}
      >
        {children}
      </div>
    </div>
  )
}

/** Title row with the round close button. */
export function DialogHeader({
  children,
  onClose,
  closeDisabled,
}: {
  children: React.ReactNode
  onClose?: () => void
  closeDisabled?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      {children}
      {onClose && (
        <IconButton title="Close" tone="surface" size={36} onClick={onClose} disabled={closeDisabled}>
          <X className="size-4" />
        </IconButton>
      )}
    </div>
  )
}
