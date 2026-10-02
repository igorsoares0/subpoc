"use client"

import { ChevronDown, Move } from "lucide-react"
import { type SubtitleStyle } from "@/lib/subtitle-track"

const FONTS = ["Montserrat", "Arial", "Helvetica", "Inter", "Roboto", "Poppins"]

/**
 * Quick text controls: inverse pill pinned to the bottom center of the stage.
 * Font · size · color, plus the "Drag to move" hint for the subtitle on the video.
 */
export function FloatingToolbar({
  style,
  onChange,
}: {
  style: SubtitleStyle
  onChange: (partial: Partial<SubtitleStyle>) => void
}) {
  return (
    <div
      className="absolute z-20 left-1/2 bottom-4 -translate-x-1/2 flex items-center gap-1 p-[5px] rounded-full bg-paper text-canvas text-[12.5px] font-semibold whitespace-nowrap"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="relative">
        <select
          value={style.fontFamily}
          onChange={(e) => onChange({ fontFamily: e.target.value })}
          aria-label="Font"
          title="Font"
          className="h-[30px] appearance-none bg-transparent pl-3 pr-7 rounded-full text-canvas outline-none hover:bg-canvas/15 cursor-pointer"
        >
          {FONTS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <ChevronDown className="size-[13px] opacity-60 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
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
        className="w-11 h-[30px] rounded-full bg-transparent text-center font-mono tabular-nums text-canvas outline-none hover:bg-canvas/15 focus:bg-canvas/15 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <label title="Text color" className="relative size-[30px] mx-0.5 rounded-full flex items-center justify-center hover:bg-canvas/15 cursor-pointer">
        <span className="size-5 rounded-full" style={{ background: style.color, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.15)" }} />
        <input
          type="color"
          value={style.color}
          onChange={(e) => onChange({ color: e.target.value.toUpperCase() })}
          aria-label="Text color"
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </label>
      <span className="h-[30px] px-3 rounded-full flex items-center gap-1.5 bg-accent text-white select-none">
        <Move className="size-[13px]" />
        Drag to move
      </span>
    </div>
  )
}
