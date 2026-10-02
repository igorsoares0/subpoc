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
  Upload,
} from "lucide-react"
import { normalizePosition, type HookOverlayData, type SubtitleStyle } from "@/lib/subtitle-track"
import { Button } from "@/components/ui/Button"
import { Slider, Toggle } from "@/components/ui/controls"
import { cn } from "@/lib/utils"
import { Hint, PanelDivider, PanelSection, Row } from "./shared"
import type { LogoOverlay } from "../types"

const ROWS = [
  { y: 10, name: "Top", hint: "Clear of the speaker's mouth — good for talking heads." },
  { y: 50, name: "Middle", hint: "Best for word-by-word — stays clear of the Reels/TikTok UI." },
  { y: 90, name: "Bottom", hint: "Classic caption spot for horizontal video." },
]
const COLS = ["left", "center", "right"] as const

const CORNERS: { value: LogoOverlay["position"]; title: string; icon: typeof ArrowUpLeft }[] = [
  { value: "top-left", title: "Top left", icon: ArrowUpLeft },
  { value: "top-right", title: "Top right", icon: ArrowUpRight },
  { value: "bottom-left", title: "Bottom left", icon: ArrowDownLeft },
  { value: "bottom-right", title: "Bottom right", icon: ArrowDownRight },
]

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
      style={{ background: value, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.15)" }}
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
    <div className="flex flex-col gap-3 pt-4">
      <PanelSection label="Position" aside="Or drag it on the video">
        <div className="flex items-center gap-3.5">
          <div
            role="radiogroup"
            aria-label="Subtitle position"
            className="grid grid-cols-3 grid-rows-3 gap-1 p-[5px] size-24 flex-none rounded-xl bg-surface"
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
                      "rounded-[7px] flex items-center justify-center cursor-pointer",
                      active ? "bg-accent" : "hover:bg-hover"
                    )}
                  >
                    <span className={cn("block h-[3px] rounded-[2px]", active ? "w-4 bg-white" : "w-3 bg-line/15")} />
                  </button>
                )
              })
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <span className="text-[14px] font-bold text-paper">
              {activeRow >= 0 ? positionName(activeRow, activeCol) : "Custom"}
            </span>
            <Hint>{activeRow >= 0 ? ROWS[activeRow].hint : "Placed by dragging on the video."}</Hint>
          </div>
        </div>
      </PanelSection>

      <Row label="Block width" labelWidth={90} value={`${boxWidth}%`}>
        <Slider min={20} max={100} value={boxWidth} onChange={(v) => onStyle({ boxWidth: v })} aria-label="Block width" />
      </Row>

      <PanelDivider />

      <div className="flex items-center gap-2">
        <span className="flex-1 text-[13px] font-bold text-paper">Keywords</span>
        <span className="text-[12px] text-ink-3">Color</span>
        <ColorDot value={keywordColor} onChange={(v) => onStyle({ emphasisColor: v })} label="Keyword color" />
      </div>
      <div className="flex gap-1.5">
        <Button variant="tint" size="xs" onClick={onAutoHighlight} className="flex-1 h-8 font-bold">
          <Sparkles className="size-[13px]" />
          Auto-highlight
        </Button>
        <Button variant="secondary" size="xs" onClick={onClearHighlights} className="flex-1 h-8">
          <Eraser className="size-[13px]" />
          Clear
        </Button>
      </div>

      <PanelDivider />

      {/* Hook */}
      <div className="rounded-2xl bg-surface p-3 flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <Heading className="size-[15px] text-paper" />
          <span className="flex-1 text-[13px] font-bold text-paper">Hook</span>
          <Toggle label="Hook overlay" checked={!!hook} onChange={(on) => (on ? onHookEnable() : onHookRemove())} />
        </div>
        {hook && (
          <>
            <div className="flex gap-1.5">
              <input
                value={hook.text}
                onChange={(e) => onHookChange({ text: e.target.value })}
                placeholder="Hook text"
                aria-label="Hook text"
                className="flex-1 min-w-0 h-[34px] rounded-[10px] bg-canvas px-3 text-[13px] font-medium text-paper outline-none focus:edge-accent"
              />
              <span className="size-[34px] rounded-[10px] bg-canvas flex items-center justify-center flex-none">
                <ColorDot value={hook.color} onChange={(v) => onHookChange({ color: v })} label="Hook color" />
              </span>
              <button
                type="button"
                onClick={() => onHookChange({ uppercase: !hook.uppercase })}
                aria-pressed={!!hook.uppercase}
                title="Uppercase"
                className={cn(
                  "size-[34px] rounded-[10px] flex items-center justify-center text-[11px] font-extrabold flex-none cursor-pointer",
                  hook.uppercase ? "bg-paper text-canvas" : "bg-canvas text-ink-3 hover:text-paper"
                )}
              >
                AA
              </button>
            </div>
            <Row label="Size" labelWidth={64} small value={hook.fontSize}>
              <Slider min={16} max={96} value={hook.fontSize} onChange={(v) => onHookChange({ fontSize: v })} aria-label="Hook size" />
            </Row>
            <Row label="Vertical" labelWidth={64} small value={`${Math.round(hook.position.y)}%`}>
              <Slider
                min={2}
                max={98}
                value={hook.position.y}
                onChange={(v) => onHookChange({ position: { x: hook.position.x, y: v } })}
                aria-label="Hook vertical position"
              />
            </Row>
          </>
        )}
      </div>

      {/* Logo / watermark */}
      <div className="rounded-2xl bg-surface p-3 flex flex-col gap-2.5">
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
        <div className="flex items-center gap-2">
          <ImageIcon className="size-[15px] text-paper" />
          <span className="flex-1 text-[13px] font-bold text-paper">Logo / watermark</span>
          <Toggle
            label="Logo overlay"
            checked={!!logo || isUploadingLogo}
            disabled={isUploadingLogo}
            onChange={(on) => (on ? fileRef.current?.click() : onLogoRemove())}
          />
        </div>

        {isUploadingLogo ? (
          <div className="flex items-center gap-2.5 h-[34px] text-[12.5px] text-ink-3">
            <Loader2 className="size-4 animate-spin text-accent-ink" />
            Uploading logo…
          </div>
        ) : logo ? (
          <>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                title="Replace image"
                className="size-[34px] rounded-lg bg-white edge-line-1 flex items-center justify-center overflow-hidden flex-none cursor-pointer"
              >
                {logo.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo.logoUrl} alt="" className="max-w-full max-h-full object-contain" />
                )}
              </button>
              <span className="flex-1 min-w-0 flex flex-col">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-left text-[13px] font-semibold text-paper truncate hover:underline underline-offset-2 cursor-pointer"
                  title="Replace image"
                >
                  Logo image
                </button>
                <span className="font-mono text-[11px] text-ink-3">PNG/JPG · up to 5 MB</span>
              </span>
              <span role="radiogroup" aria-label="Logo corner" className="flex gap-0.5 p-[3px] rounded-full bg-canvas flex-none">
                {CORNERS.map(({ value, title, icon: Icon }) => {
                  const active = logo.position === value
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      title={title}
                      onClick={() => onLogoChange({ position: value })}
                      className={cn(
                        "w-[26px] h-6 rounded-full flex items-center justify-center cursor-pointer",
                        active ? "bg-paper text-canvas" : "text-ink-3 hover:text-paper"
                      )}
                    >
                      <Icon className="size-[13px]" />
                    </button>
                  )
                })}
              </span>
            </div>
            <Row label="Size" labelWidth={64} small value={`${logo.size}%`}>
              <Slider min={5} max={20} value={logo.size} onChange={(v) => onLogoChange({ size: v })} aria-label="Logo size" />
            </Row>
            <Row label="Opacity" labelWidth={64} small value={`${Math.round(logo.opacity * 100)}%`}>
              <Slider
                min={0}
                max={100}
                value={Math.round(logo.opacity * 100)}
                onChange={(v) => onLogoChange({ opacity: v / 100 })}
                aria-label="Logo opacity"
              />
            </Row>
          </>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] text-ink-3">PNG/JPG · up to 5 MB</span>
            <Button variant="secondary" size="xs" onClick={() => fileRef.current?.click()} className="bg-canvas hover:bg-hover">
              <Upload className="size-3.5" />
              Upload
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
