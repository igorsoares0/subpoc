"use client"

import { ChevronDown, Minus, Plus } from "lucide-react"
import { resolveFontFamily, type SubtitleStyle } from "@/lib/subtitle-track"
import { AnimationPreview } from "@/components/editor/AnimationPreview"
import { CustomSwatch, Segmented, Slider, Swatch } from "@/components/ui/controls"
import { cn } from "@/lib/utils"
import { Hint, PanelHeader, PanelSection, Row } from "./shared"
import { COLOR_PRESETS } from "../types"

const FONTS = ["Montserrat", "Arial", "Helvetica", "Inter", "Roboto", "Poppins"]
const BG_PRESETS = ["#000000", "#FFFFFF", "#FFD700", "#FF4FD8"]

const ANIMATIONS = [
  { value: "none", label: "None" },
  { value: "pop", label: "Pop" },
  { value: "scale", label: "Scale" },
  { value: "slide-up", label: "Slide-up" },
  { value: "fade", label: "Fade" },
] as const

const same = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase()

export function TextPanel({
  style,
  onChange,
  onOpenStyle,
}: {
  style: SubtitleStyle
  /** Local update + debounced save. */
  onChange: (partial: Partial<SubtitleStyle>) => void
  onOpenStyle: () => void
}) {
  const isWordGroup = style.displayMode === "word-group"
  const bgOn = style.backgroundOpacity > 0
  const animation = style.animationMode ?? "none"
  const wordsPerGroup = style.wordsPerGroup ?? 3

  return (
    <div className="flex flex-col h-full min-h-0">
      <PanelHeader title="Text" em="& animation" meta="Applies to all blocks" />
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <PanelSection>
          <div className="flex flex-col gap-1.5">
            <div className="relative">
              <select
                value={style.fontFamily}
                onChange={(e) => onChange({ fontFamily: e.target.value })}
                aria-label="Font"
                className="w-full h-11 appearance-none rounded-lg bg-surface border border-line/10 pl-3.5 pr-9 text-[14px] font-bold text-paper outline-none focus:border-line/25 cursor-pointer"
                style={{ fontFamily: resolveFontFamily(style.fontFamily) }}
              >
                {FONTS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <ChevronDown className="size-4 text-ink-3 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <span className="text-[11.5px] text-ink-4">{FONTS.join(" · ")}</span>
          </div>

          <Row label="Size">
            <Slider
              min={12}
              max={120}
              value={style.fontSize}
              onChange={(v) => onChange({ fontSize: v })}
              className="flex-1"
              aria-label="Font size"
            />
            <input
              type="number"
              min={12}
              max={120}
              value={style.fontSize}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (!Number.isNaN(v)) onChange({ fontSize: Math.max(12, Math.min(120, v)) })
              }}
              aria-label="Font size value"
              className="w-[46px] h-[30px] rounded-[7px] bg-surface border border-line/10 text-center font-mono tabular-nums text-[12px] text-paper outline-none focus:border-line/25 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
          </Row>

          <Row label="Color">
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((c) => (
                <Swatch key={c} color={c} selected={same(style.color, c)} onClick={() => onChange({ color: c })} />
              ))}
              <CustomSwatch value={style.color} onChange={(v) => onChange({ color: v })} />
            </div>
          </Row>

          <Row label="Background">
            <div className="flex flex-wrap gap-2">
              <Swatch
                color={null}
                title="No background"
                selected={!bgOn}
                onClick={() => onChange({ backgroundOpacity: 0 })}
              />
              {BG_PRESETS.map((c) => (
                <Swatch
                  key={c}
                  color={c}
                  selected={bgOn && same(style.backgroundColor, c)}
                  onClick={() =>
                    onChange({ backgroundColor: c, backgroundOpacity: bgOn ? style.backgroundOpacity : 0.6 })
                  }
                />
              ))}
              <CustomSwatch
                value={style.backgroundColor}
                onChange={(v) => onChange({ backgroundColor: v, backgroundOpacity: bgOn ? style.backgroundOpacity : 0.6 })}
              />
            </div>
          </Row>

          <Row label="Opacity">
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={style.backgroundOpacity}
              onChange={(v) => onChange({ backgroundOpacity: v })}
              className="flex-1"
              aria-label="Background opacity"
            />
            <span className="w-11 text-right font-mono tabular-nums text-[12px] text-paper">
              {Math.round(style.backgroundOpacity * 100)}%
            </span>
          </Row>
        </PanelSection>

        <PanelSection label="Entry animation">
          {isWordGroup ? (
            <>
              <div className="grid grid-cols-5 gap-1.5">
                {ANIMATIONS.map((a) => {
                  const active = animation === a.value
                  return (
                    <button
                      key={a.value}
                      type="button"
                      onClick={() => onChange({ animationMode: a.value })}
                      aria-pressed={active}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <span
                        className={cn(
                          "w-full h-[52px] rounded-md bg-surface border flex items-center justify-center text-[15px] font-extrabold transition-colors duration-150",
                          active ? "border-ring text-accent-ink" : "border-line/10 text-paper hover:border-line/25",
                          a.value === "fade" && !active && "text-ink-4"
                        )}
                        style={{ fontFamily: resolveFontFamily("Montserrat"), fontSize: a.value === "scale" ? 12 : 15 }}
                      >
                        Aa
                      </span>
                      <span className={cn("text-[11px]", active ? "text-paper" : "text-ink-3")}>{a.label}</span>
                    </button>
                  )
                })}
              </div>
              {animation !== "none" && (
                <>
                  <Segmented<"subtle" | "medium" | "strong">
                    value={style.animationIntensity ?? "medium"}
                    onChange={(v) => onChange({ animationIntensity: v })}
                    options={[
                      { value: "subtle", label: "Subtle" },
                      { value: "medium", label: "Medium" },
                      { value: "strong", label: "Strong" },
                    ]}
                  />
                  <AnimationPreview
                    mode={animation}
                    intensity={style.animationIntensity ?? "medium"}
                    color={style.highlightColor || "#FFD700"}
                    fontFamily={style.fontFamily}
                    uppercase={style.uppercase}
                  />
                </>
              )}
            </>
          ) : (
            <Hint>
              Entry animations play word by word.{" "}
              <button type="button" onClick={onOpenStyle} className="text-paper underline underline-offset-[3px] hover:text-accent-ink">
                Pick a word-by-word template
              </button>{" "}
              to enable them.
            </Hint>
          )}
        </PanelSection>

        {isWordGroup && (
          <PanelSection label="Grouping">
            <Row label="Words per group" labelWidth={120}>
              <div className="flex items-center h-[34px] rounded-md bg-surface border border-line/10 ml-auto">
                <button
                  type="button"
                  title="Fewer words"
                  aria-label="Fewer words"
                  disabled={wordsPerGroup <= 1}
                  onClick={() => onChange({ wordsPerGroup: wordsPerGroup - 1 })}
                  className="w-8 h-full flex items-center justify-center text-ink-2 hover:text-paper disabled:opacity-30"
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="w-6 text-center font-mono tabular-nums text-[13px] text-paper">{wordsPerGroup}</span>
                <button
                  type="button"
                  title="More words"
                  aria-label="More words"
                  disabled={wordsPerGroup >= 6}
                  onClick={() => onChange({ wordsPerGroup: wordsPerGroup + 1 })}
                  className="w-8 h-full flex items-center justify-center text-ink-2 hover:text-paper disabled:opacity-30"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </Row>
            <Row label="Max characters" labelWidth={120}>
              <Slider
                min={10}
                max={40}
                value={style.maxCharsPerGroup ?? 24}
                onChange={(v) => onChange({ maxCharsPerGroup: v })}
                className="flex-1"
                aria-label="Max characters per group"
              />
              <span className="w-11 text-right font-mono tabular-nums text-[12px] text-paper">
                {style.maxCharsPerGroup ?? 24}
              </span>
            </Row>
            <Row label="Pause split" labelWidth={120}>
              <Slider
                min={0.1}
                max={1}
                step={0.05}
                value={style.splitPauseGap ?? 0.35}
                onChange={(v) => onChange({ splitPauseGap: v })}
                className="flex-1"
                aria-label="Pause split"
              />
              <span className="w-11 text-right font-mono tabular-nums text-[12px] text-paper">
                {(style.splitPauseGap ?? 0.35).toFixed(2)}s
              </span>
            </Row>
            <Hint>Splits speech into readable blocks by pause and length.</Hint>
          </PanelSection>
        )}
      </div>
    </div>
  )
}
