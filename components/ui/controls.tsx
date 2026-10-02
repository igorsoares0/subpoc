"use client"

import { cn } from "@/lib/utils"

/** Filled track for range inputs: paper up to the thumb, elevated rail after. Theme-aware. */
export function rangeFill(value: number, min: number, max: number): string {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
  return `linear-gradient(to right, var(--c-paper) 0%, var(--c-paper) ${pct}%, var(--c-elevated) ${pct}%, var(--c-elevated) 100%)`
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
  className,
  ...rest
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  /** Fired on release (mouse/touch/keyboard) — use for persisting. */
  onCommit?: (v: number) => void
  className?: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "min" | "max" | "step">) {
  const commit = (e: React.SyntheticEvent<HTMLInputElement>) => onCommit?.(Number(e.currentTarget.value))
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      onMouseUp={commit}
      onTouchEnd={commit}
      onKeyUp={commit}
      className={cn("w-full", className)}
      style={{ background: rangeFill(value, min, max) }}
      {...rest}
    />
  )
}

/**
 * Pill segmented control. `variant="canvas"` (panel tabs, strength): active item
 * is a canvas pill; `variant="inverse"` (aspect ratio, nav): active is paper/canvas.
 */
export function Segmented<T extends string | number | null>({
  options,
  value,
  onChange,
  className,
  variant = "canvas",
  size = "md",
  stretch = true,
}: {
  options: { value: T; label: React.ReactNode; title?: string }[]
  value: T
  onChange: (v: T) => void
  className?: string
  variant?: "canvas" | "inverse"
  /** "md" = 32px items, "sm" = 28px items */
  size?: "sm" | "md"
  /** Items share the width equally (tabs). Off = items hug their label. */
  stretch?: boolean
}) {
  return (
    <div role="radiogroup" className={cn("flex gap-1 p-1 rounded-full bg-surface", className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-full whitespace-nowrap cursor-pointer",
              stretch && "flex-1",
              size === "sm" ? "h-7 px-2.5 text-[12.5px]" : "h-8 px-3 text-[13px]",
              active
                ? variant === "inverse"
                  ? "bg-paper text-canvas font-semibold"
                  : "bg-canvas text-paper font-bold"
                : "text-ink-3 font-semibold hover:text-paper"
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative w-9 h-[22px] rounded-full flex-none disabled:opacity-40 cursor-pointer",
        checked ? "bg-accent" : "bg-elevated"
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] size-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-[left] duration-150",
          checked ? "left-[17px]" : "left-[3px]"
        )}
      />
    </button>
  )
}

/** Color swatch. `color` null renders the "none" (transparent) swatch. */
export function Swatch({
  color,
  selected,
  onClick,
  size = 24,
  title,
}: {
  color: string | null
  selected?: boolean
  onClick: () => void
  size?: number
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? color ?? "None"}
      aria-label={title ?? color ?? "None"}
      aria-pressed={selected}
      className="relative rounded-full flex-none transition-transform duration-150 hover:scale-110"
      style={{
        width: size,
        height: size,
        background: color ?? "var(--c-canvas)",
        boxShadow: [
          selected ? "0 0 0 2px var(--c-canvas), 0 0 0 4px var(--c-paper)" : null,
          // Hairline so white / canvas swatches don't vanish.
          "inset 0 0 0 1px rgba(var(--c-line),0.18)",
        ]
          .filter(Boolean)
          .join(", "),
      }}
    >
      {color === null && (
        <span className="absolute inset-0 rounded-full overflow-hidden">
          <span className="absolute left-1/2 -top-0.5 -bottom-0.5 w-0.5 -ml-px bg-danger rotate-45" />
        </span>
      )}
    </button>
  )
}

/** Native color picker styled as a "+" swatch. */
export function CustomSwatch({
  value,
  onChange,
  size = 24,
}: {
  value: string
  onChange: (v: string) => void
  size?: number
}) {
  return (
    <label
      title="Custom color"
      className="relative rounded-full flex-none flex items-center justify-center bg-surface text-ink-3 hover:text-paper cursor-pointer"
      style={{ width: size, height: size }}
    >
      <span className="text-[13px] leading-none">+</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />
    </label>
  )
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center font-mono text-[10.5px] leading-none text-ink-2 bg-surface rounded-xs px-[5px] py-[3px]">
      {children}
    </kbd>
  )
}

/** Usage meter on the elevated rail. `danger` switches the fill to the danger color. */
export function UsageBar({
  used,
  limit,
  height = 6,
  fill = "paper",
  danger,
}: {
  used: number
  limit: number
  height?: number
  fill?: "paper" | "accent"
  danger?: boolean
}) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const tone = danger ? "bg-danger" : fill === "accent" ? "bg-accent" : "bg-paper"
  return (
    <div className="rounded-full bg-elevated overflow-hidden" style={{ height }}>
      <div className={cn("h-full rounded-full transition-[width] duration-300", tone)} style={{ width: `${pct}%` }} />
    </div>
  )
}
