"use client"

import { ArrowRight, ChevronDown } from "lucide-react"
import { resolveFontFamily, type SubtitleStyle } from "@/lib/subtitle-track"

const FONTS = ["Montserrat", "Arial", "Helvetica", "Inter", "Roboto", "Poppins"]

/**
 * Quick text controls floating above the selected subtitle on the stage.
 * `left/top` are the anchor in stage-container px; `placement` flips it under
 * the subtitle when there's no room above.
 */
export function FloatingToolbar({
  style,
  left,
  top,
  placement,
  onChange,
  onOpenText,
}: {
  style: SubtitleStyle
  left: number
  top: number
  placement: "above" | "below"
  onChange: (partial: Partial<SubtitleStyle>) => void
  onOpenText: () => void
}) {
  return (
    <div
      className="absolute z-20 flex items-center gap-1 h-10 pl-2 pr-1 rounded-lg bg-surface border border-line/10 shadow-[var(--shadow-menu)] whitespace-nowrap"
      style={{
        left,
        top,
        transform: placement === "above" ? "translate(-50%, -100%)" : "translate(-50%, 0)",
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="relative">
        <select
          value={style.fontFamily}
          onChange={(e) => onChange({ fontFamily: e.target.value })}
          aria-label="Font"
          title="Font"
          className="h-7 appearance-none bg-transparent pl-1.5 pr-6 rounded-[6px] text-[13px] font-bold text-paper outline-none hover:bg-elevated cursor-pointer"
          style={{ fontFamily: resolveFontFamily(style.fontFamily) }}
        >
          {FONTS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <ChevronDown className="size-3 text-ink-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
      <span className="w-px h-4 bg-line/10" />
      <input
        type="number"
        min={12}
        max={120}
        value={style.fontSize}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (!Number.isNaN(v)) onChange({ fontSize: Math.max(12, Math.min(120, v)) })
        }}
        aria-label="Font size"
        title="Font size"
        className="w-10 h-7 rounded-[6px] bg-transparent text-center font-mono tabular-nums text-[12.5px] text-paper outline-none hover:bg-elevated focus:bg-elevated [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span className="w-px h-4 bg-line/10" />
      <label
        title="Text color"
        className="relative size-7 rounded-[6px] flex items-center justify-center hover:bg-elevated cursor-pointer"
      >
        <span
          className="size-[18px] rounded-full"
          style={{ background: style.color, boxShadow: "0 0 0 1px rgba(var(--c-line),0.2)" }}
        />
        <input
          type="color"
          value={style.color}
          onChange={(e) => onChange({ color: e.target.value.toUpperCase() })}
          aria-label="Text color"
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </label>
      <span className="w-px h-4 bg-line/10" />
      <button
        type="button"
        onClick={onOpenText}
        className="h-7 px-2 rounded-[6px] flex items-center gap-1 text-[12.5px] font-medium text-paper hover:bg-elevated"
      >
        Style
        <ArrowRight className="size-3.5" />
      </button>
    </div>
  )
}
