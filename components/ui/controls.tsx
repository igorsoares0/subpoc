"use client"

import { cn } from "@/lib/utils"

/** Filled track for range inputs: paper up to the thumb, faint rail after. Theme-aware. */
export function rangeFill(value: number, min: number, max: number): string {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
  return `linear-gradient(to right, var(--c-paper) 0%, var(--c-paper) ${pct}%, rgba(var(--c-line),0.14) ${pct}%, rgba(var(--c-line),0.14) 100%)`
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

export function Segmented<T extends string | number | null>({
  options,
  value,
  onChange,
  className,
  size = "md",
}: {
  options: { value: T; label: React.ReactNode; title?: string }[]
  value: T
  onChange: (v: T) => void
  className?: string
  size?: "sm" | "md"
}) {
  return (
    <div
      role="radiogroup"
      className={cn("flex p-[3px] rounded-md bg-surface border border-line/8", className)}
    >
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
              "flex-1 inline-flex items-center justify-center gap-1.5 rounded-[6px] font-medium transition-colors duration-150 whitespace-nowrap",
              size === "sm" ? "h-7 px-2 text-[12px]" : "h-[30px] px-2.5 text-[12.5px]",
              active ? "bg-hover text-paper" : "text-ink-3 hover:text-paper"
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
        "relative w-[34px] h-5 rounded-full flex-none transition-colors duration-150 disabled:opacity-40",
        checked ? "bg-accent" : "bg-track"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-4 rounded-full transition-all duration-150",
          checked ? "left-4 bg-on-accent" : "left-0.5 bg-ink-4"
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
  size = 22,
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
        background: color ?? "var(--c-surface)",
        boxShadow: selected
          ? "0 0 0 2px var(--c-canvas), 0 0 0 3.5px var(--c-ring)"
          : "0 0 0 1px rgba(var(--c-line),0.15)",
      }}
    >
      {color === null && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="block w-[70%] h-[1.5px] bg-danger-ink rotate-[-45deg]" />
        </span>
      )}
    </button>
  )
}

/** Native color picker styled as a "+" swatch. */
export function CustomSwatch({
  value,
  onChange,
  size = 22,
}: {
  value: string
  onChange: (v: string) => void
  size?: number
}) {
  return (
    <label
      title="Custom color"
      className="relative rounded-full flex-none flex items-center justify-center border border-dashed border-line/30 text-ink-3 hover:text-paper cursor-pointer"
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
    <kbd className="inline-flex items-center font-mono text-[10.5px] leading-none text-ink-2 border border-line/14 rounded-xs px-[5px] py-[3px]">
      {children}
    </kbd>
  )
}

/** Usage bar: paper fill, warn ≥80%, danger ≥100%. */
export function UsageBar({ used, limit, height = 6 }: { used: number; limit: number; height?: number }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const tone = pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-[#E8A33D]" : "bg-paper"
  return (
    <div className="rounded-full bg-line/12 overflow-hidden" style={{ height }}>
      <div className={cn("h-full rounded-full transition-[width] duration-300", tone)} style={{ width: `${pct}%` }} />
    </div>
  )
}
