import { cn } from "@/lib/utils"

/** Serif panel title + meta line. */
export function PanelHeader({
  title,
  em,
  meta,
  children,
}: {
  title: string
  em?: string
  meta?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="pt-[22px] px-5 pb-3.5 flex flex-col gap-3.5 flex-none">
      <div className="flex flex-col gap-1.5">
        <h2 className="font-serif text-[30px] leading-none text-paper">
          {title}
          {em && (
            <>
              {" "}
              <em className="italic">{em}</em>
            </>
          )}
        </h2>
        {meta && <p className="text-[12px] text-ink-3">{meta}</p>}
      </div>
      {children}
    </div>
  )
}

/** Hairline-separated panel section with an optional label + right slot. */
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
    <section className={cn("px-5 py-4 border-t border-line/8 flex flex-col gap-3.5", className)}>
      {(label || aside) && (
        <div className="flex items-center justify-between gap-3">
          {label && <span className="text-[13px] font-medium text-paper">{label}</span>}
          {aside}
        </div>
      )}
      {children}
    </section>
  )
}

/** Row: fixed-width label + control. */
export function Row({
  label,
  children,
  labelWidth = 84,
}: {
  label: string
  children: React.ReactNode
  labelWidth?: number
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[13px] text-ink-2 flex-none" style={{ width: labelWidth }}>
        {label}
      </span>
      <div className="flex-1 min-w-0 flex items-center gap-2">{children}</div>
    </div>
  )
}

/** Small hint line under a control group. */
export function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] leading-relaxed text-ink-4">{children}</p>
}

/** Parse "#RRGGBB" + opacity into rgba(). */
export function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace("#", "")
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
