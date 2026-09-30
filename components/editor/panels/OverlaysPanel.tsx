"use client"

import { useRef } from "react"
import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUpLeft,
  ArrowUpRight,
  Eraser,
  Heading,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react"
import { normalizePosition, type HookOverlayData, type SubtitleStyle } from "@/lib/subtitle-track"
import { Button, IconButton } from "@/components/ui/Button"
import { Segmented, Slider, Toggle } from "@/components/ui/controls"
import { cn } from "@/lib/utils"
import { Hint, PanelHeader, PanelSection, Row } from "./shared"
import type { LogoOverlay } from "../types"

const ROWS = [
  { y: 10, name: "Top", hint: "Clear of the speaker's mouth — good for talking heads." },
  { y: 50, name: "Middle", hint: "Best for word-by-word — stays clear of the Reels/TikTok UI." },
  { y: 90, name: "Bottom", hint: "Classic caption spot for horizontal video." },
]
const COLS = ["left", "center", "right"] as const

// Column centers keep a box of `boxWidth`% inside the frame (5% margin).
function columnXs(boxWidth: number) {
  const edge = Math.min(50, Math.max(20, boxWidth / 2 + 5))
  return [edge, 50, 100 - edge]
}

function positionName(row: number, col: number) {
  if (row === 1 && col === 1) return "Center"
  return `${ROWS[row].name} ${COLS[col]}`
}

/** Circular color picker (native input under a swatch). */
function ColorDot({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label
      title={label}
      className="relative size-[22px] rounded-full flex-none cursor-pointer"
      style={{ background: value, boxShadow: "0 0 0 1px rgba(var(--c-line),0.2)" }}
    >
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        aria-label={label}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />
    </label>
  )
}

export function OverlaysPanel({
  style,
  onPosition,
  onStyle,
  keywordColor,
  onAutoHighlight,
  onClearHighlights,
  hook,
  onHookChange,
  onHookEnable,
  onHookRemove,
  logo,
  isUploadingLogo,
  onLogoFile,
  onLogoRemove,
  onLogoChange,
}: {
  style: SubtitleStyle
  onPosition: (pos: { x: number; y: number }) => void
  onStyle: (partial: Partial<SubtitleStyle>) => void
  keywordColor: string
  onAutoHighlight: () => void
  onClearHighlights: () => void
  hook: HookOverlayData | null
  onHookChange: (partial: Partial<HookOverlayData>) => void
  onHookEnable: () => void
  onHookRemove: () => void
  logo: LogoOverlay | null
  isUploadingLogo: boolean
  onLogoFile: (file: File) => void
  onLogoRemove: () => void
  onLogoChange: (partial: Partial<LogoOverlay>) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const boxWidth = style.boxWidth ?? 90
  const xs = columnXs(boxWidth)
  const pos = normalizePosition(style.position)

  // Active cell = closest grid point, only when it's actually on it.
  let activeRow = -1
  let activeCol = -1
  ROWS.forEach((r, ri) =>
    xs.forEach((x, ci) => {
      if (Math.abs(pos.x - x) < 3 && Math.abs(pos.y - r.y) < 3) {
        activeRow = ri
        activeCol = ci
      }
    })
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      <PanelHeader title="Position" em="& overlays" meta="Or drag it on the video" />
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <PanelSection>
          <div className="flex gap-4">
            <div
              role="radiogroup"
              aria-label="Subtitle position"
              className="grid grid-cols-3 grid-rows-3 gap-1 p-1.5 size-[112px] flex-none rounded-lg bg-surface border border-line/8"
            >
              {ROWS.map((r, ri) =>
                xs.map((x, ci) => {
                  const active = ri === activeRow && ci === activeCol
                  return (
                    <button
                      key={`${ri}-${ci}`}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      title={positionName(ri, ci)}
                      onClick={() => onPosition({ x, y: r.y })}
                      className={cn(
                        "rounded-[5px] flex items-center justify-center transition-colors duration-150",
                        active ? "bg-accent/25" : "hover:bg-elevated"
                      )}
                    >
                      <span
                        className={cn("block h-[2px] rounded-full", active ? "w-4 bg-paper" : "w-3 bg-line/25")}
                      />
                    </button>
                  )
                })
              )}
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <span className="text-[13px] font-medium text-paper">
                {activeRow >= 0 ? positionName(activeRow, activeCol) : "Custom"}
              </span>
              <p className="text-[12px] leading-relaxed text-ink-3">
                {activeRow >= 0 ? ROWS[activeRow].hint : "Placed by dragging on the video."}
              </p>
            </div>
          </div>
          <Row label="Block width">
            <Slider
              min={20}
              max={100}
              value={boxWidth}
              onChange={(v) => onStyle({ boxWidth: v })}
              className="flex-1"
              aria-label="Block width"
            />
            <span className="w-11 text-right font-mono tabular-nums text-[12px] text-paper">{boxWidth}%</span>
          </Row>
        </PanelSection>

        <PanelSection
          label="Keywords"
          aside={
            <span className="flex items-center gap-2 text-[12px] text-ink-3">
              Color
              <ColorDot value={keywordColor} onChange={(v) => onStyle({ emphasisColor: v })} label="Keyword color" />
            </span>
          }
        >
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onAutoHighlight} className="flex-1 gap-1.5">
              <Sparkles className="size-3.5 text-accent-ink" />
              Auto-highlight
            </Button>
            <Button variant="ghost" size="sm" onClick={onClearHighlights} className="flex-1 gap-1.5">
              <Eraser className="size-3.5" />
              Clear
            </Button>
          </div>
          <Hint>Highlights keywords in a fixed color (heuristic). Requires word-by-word data.</Hint>
        </PanelSection>

        <PanelSection label="Overlays">
          {/* Hook */}
          <div className="rounded-lg bg-surface border border-line/8 p-3 flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <Heading className="size-[15px] text-ink-2" strokeWidth={1.75} />
              <span className="flex-1 text-[13px] text-paper">Hook</span>
              <Toggle
                label="Hook overlay"
                checked={!!hook}
                onChange={(on) => (on ? onHookEnable() : onHookRemove())}
              />
            </div>
            {hook && (
              <>
                <input
                  value={hook.text}
                  onChange={(e) => onHookChange({ text: e.target.value })}
                  placeholder="Hook text"
                  aria-label="Hook text"
                  className="h-[34px] rounded-[7px] bg-canvas border border-line/10 px-2.5 text-[13px] text-paper outline-none focus:border-line/25"
                />
                <Row label="Color" labelWidth={72}>
                  <ColorDot value={hook.color} onChange={(v) => onHookChange({ color: v })} label="Hook color" />
                  <span className="flex-1" />
                  <button
                    type="button"
                    onClick={() => onHookChange({ uppercase: !hook.uppercase })}
                    aria-pressed={!!hook.uppercase}
                    title="Uppercase"
                    className={cn(
                      "h-7 px-2 rounded-[6px] text-[11px] font-semibold border transition-colors duration-150",
                      hook.uppercase ? "bg-hover border-line/14 text-paper" : "border-line/10 text-ink-3 hover:text-paper"
                    )}
                  >
                    AA
                  </button>
                </Row>
                <Row label="Size" labelWidth={72}>
                  <Slider min={16} max={96} value={hook.fontSize} onChange={(v) => onHookChange({ fontSize: v })} className="flex-1" aria-label="Hook size" />
                  <span className="w-10 text-right font-mono tabular-nums text-[12px] text-paper">{hook.fontSize}</span>
                </Row>
                <Row label="Vertical" labelWidth={72}>
                  <Slider
                    min={2}
                    max={98}
                    value={hook.position.y}
                    onChange={(v) => onHookChange({ position: { x: hook.position.x, y: v } })}
                    className="flex-1"
                    aria-label="Hook vertical position"
                  />
                  <span className="w-10 text-right font-mono tabular-nums text-[12px] text-paper">{Math.round(hook.position.y)}%</span>
                </Row>
              </>
            )}
          </div>

          {/* Logo / watermark */}
          <div className="rounded-lg bg-surface border border-line/8 p-3 flex flex-col gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onLogoFile(file)
                e.target.value = ""
              }}
            />
            <div className="flex items-center gap-2.5">
              <ImageIcon className="size-[15px] text-ink-2" strokeWidth={1.75} />
              <span className="flex-1 text-[13px] text-paper">Logo / watermark</span>
              <Toggle
                label="Logo overlay"
                checked={!!logo || isUploadingLogo}
                disabled={isUploadingLogo}
                onChange={(on) => (on ? fileRef.current?.click() : onLogoRemove())}
              />
            </div>

            {isUploadingLogo ? (
              <div className="flex items-center gap-2.5 h-14 px-2.5 rounded-lg bg-canvas border border-line/8 text-[12.5px] text-ink-3">
                <Loader2 className="size-4 animate-spin text-accent-ink" />
                Uploading logo…
              </div>
            ) : logo ? (
              <>
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-canvas border border-line/8">
                  <span className="size-9 rounded-md bg-[#16150F] flex items-center justify-center overflow-hidden flex-none">
                    {logo.logoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logo.logoUrl} alt="" className="max-w-full max-h-full object-contain" />
                    )}
                  </span>
                  <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="text-left text-[13px] text-paper truncate hover:underline underline-offset-2"
                      title="Replace image"
                    >
                      Logo image
                    </button>
                    <span className="font-mono text-[11px] text-ink-4">PNG/JPG · up to 5 MB</span>
                  </span>
                  <IconButton title="Remove logo" destructive size={26} onClick={onLogoRemove} className="text-ink-3">
                    <Trash2 className="size-[13px]" />
                  </IconButton>
                </div>
                <Row label="Corner" labelWidth={72}>
                  <Segmented<LogoOverlay["position"]>
                    className="flex-1"
                    size="sm"
                    value={logo.position}
                    onChange={(v) => onLogoChange({ position: v })}
                    options={[
                      { value: "top-left", title: "Top left", label: <ArrowUpLeft className="size-3.5" /> },
                      { value: "top-right", title: "Top right", label: <ArrowUpRight className="size-3.5" /> },
                      { value: "bottom-left", title: "Bottom left", label: <ArrowDownLeft className="size-3.5" /> },
                      { value: "bottom-right", title: "Bottom right", label: <ArrowDownRight className="size-3.5" /> },
                    ]}
                  />
                </Row>
                <Row label="Size" labelWidth={72}>
                  <Slider min={5} max={20} value={logo.size} onChange={(v) => onLogoChange({ size: v })} className="flex-1" aria-label="Logo size" />
                  <span className="w-10 text-right font-mono tabular-nums text-[12px] text-paper">{logo.size}%</span>
                </Row>
                <Row label="Opacity" labelWidth={72}>
                  <Slider
                    min={0}
                    max={100}
                    value={Math.round(logo.opacity * 100)}
                    onChange={(v) => onLogoChange({ opacity: v / 100 })}
                    className="flex-1"
                    aria-label="Logo opacity"
                  />
                  <span className="w-10 text-right font-mono tabular-nums text-[12px] text-paper">{Math.round(logo.opacity * 100)}%</span>
                </Row>
              </>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-ink-4">PNG/JPG · up to 5 MB</span>
                <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} className="h-7 text-[12px] gap-1.5">
                  <Upload className="size-3.5" />
                  Upload
                </Button>
              </div>
            )}
          </div>
        </PanelSection>
      </div>
    </div>
  )
}
