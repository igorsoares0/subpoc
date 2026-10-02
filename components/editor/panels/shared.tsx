import { cn } from "@/lib/utils"

/** Panel section: bold 13px label + optional right-side note, then content. */
export function PanelSection({
  label,
  aside,
  children,
  className,
}: {
  label?: string
  aside?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("flex flex-col gap-2.5", className)}>
      {(label || aside) && (
        <div className="flex items-baseline justify-between gap-3">
          {label && <span className="text-[13px] font-bold text-paper">{label}</span>}
          {aside && <span className="text-[12px] text-ink-3">{aside}</span>}
        </div>
      )}
      {children}
    </section>
  )
}

/** 1px hairline between panel sections. */
export function PanelDivider() {
  return <div className="h-px bg-line/12 my-0.5 flex-none" />
}

/** Row: fixed-width label + control (+ optional mono value on the right). */
export function Row({
  label,
  children,
  value,
  labelWidth = 76,
  small,
}: {
  label: string
  children: React.ReactNode
  /** Mono readout (slider value). */
  value?: React.ReactNode
  labelWidth?: number
  /** Card rows (hook): 12.5px label, 12px value. */
  small?: boolean
}) {
  return (
    <div
      className="grid items-center gap-2.5"
      style={{ gridTemplateColumns: value !== undefined ? `${labelWidth}px minmax(0,1fr) 44px` : `${labelWidth}px minmax(0,1fr)` }}
    >
      <span className={cn("font-semibold text-paper", small ? "text-[12.5px]" : "text-[13px]")}>{label}</span>
      <div className="min-w-0 flex items-center gap-1.5">{children}</div>
      {value !== undefined && (
        <span className={cn("font-mono tabular-nums text-right text-paper", small ? "text-[12px]" : "text-[13px]")}>
          {value}
        </span>
      )}
    </div>
  )
}

/** Small hint line under a control group. */
export function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[12.5px] leading-[1.45] text-ink-3">{children}</p>
}

/** Parse "#RRGGBB" + opacity into rgba(). */
export function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace("#", "")
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
