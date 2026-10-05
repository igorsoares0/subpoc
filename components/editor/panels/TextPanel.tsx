"use client"

import { Minus, Plus } from "lucide-react"
import { resolveFontFamily, type SubtitleStyle } from "@/lib/subtitle-track"
import { AnimationPreview } from "@/components/editor/AnimationPreview"
import { CustomSwatch, Segmented, Slider, Swatch } from "@/components/ui/controls"
import { cn } from "@/lib/utils"
import { Hint, PanelDivider, PanelSection, Row } from "./shared"
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
    <div className="flex flex-col gap-2.5 pt-3.5">
      <PanelSection label="Font" aside="Applies to all lines">
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Font">
          {FONTS.map((f) => {
            const active = same(style.fontFamily, f)
            return (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange({ fontFamily: f })}
                className={cn(
                  "h-11 rounded-[10px] flex flex-col items-center justify-center gap-0.5 cursor-pointer",
                  active ? "bg-paper text-canvas" : "bg-surface text-paper hover:bg-hover"
                )}
              >
                <span
                  className="text-[17px] leading-none"
                  style={{ fontFamily: resolveFontFamily(f), fontWeight: f === "Montserrat" ? 900 : 700 }}
                >
                  Aa
                </span>
                <span className={cn("text-[10.5px] font-semibold leading-none", !active && "text-ink-3")}>{f}</span>
              </button>
            )
          })}
        </div>
      </PanelSection>

      <Row label="Size" value={style.fontSize}>
        <Slider
          min={12}
          max={120}
          value={style.fontSize}
          onChange={(v) => onChange({ fontSize: v })}
          aria-label="Font size"
        />
      </Row>

      <Row label="Color">
        <div className="flex flex-wrap gap-1.5">
          {COLOR_PRESETS.map((c) => (
            <Swatch key={c} color={c} selected={same(style.color, c)} onClick={() => onChange({ color: c })} />
          ))}
          <CustomSwatch value={style.color} onChange={(v) => onChange({ color: v })} />
        </div>
      </Row>

      <Row label="Box">
        <div className="flex flex-1 items-center gap-1.5">
          <Swatch color={null} title="No box" selected={!bgOn} onClick={() => onChange({ backgroundOpacity: 0 })} />
          {BG_PRESETS.map((c) => (
            <Swatch
              key={c}
              color={c}
              selected={bgOn && same(style.backgroundColor, c)}
              onClick={() => onChange({ backgroundColor: c, backgroundOpacity: bgOn ? style.backgroundOpacity : 0.6 })}
            />
          ))}
          <CustomSwatch
            value={style.backgroundColor}
            onChange={(v) => onChange({ backgroundColor: v, backgroundOpacity: bgOn ? style.backgroundOpacity : 0.6 })}
          />
          <span className="flex-1" />
          <span className="font-mono text-[12px] text-ink-3">
            {bgOn ? `${Math.round(style.backgroundOpacity * 100)}%` : "off"}
          </span>
        </div>
      </Row>

      {bgOn && (
        <Row label="Opacity" value={`${Math.round(style.backgroundOpacity * 100)}%`}>
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={style.backgroundOpacity}
            onChange={(v) => onChange({ backgroundOpacity: v })}
            aria-label="Box opacity"
          />
        </Row>
      )}

      <PanelDivider />

      <PanelSection label="Entry animation" aside={isWordGroup ? "Word by word" : undefined}>
        {isWordGroup ? (
          <>
            <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Entry animation">
              {ANIMATIONS.map((a) => {
                const active = animation === a.value
                return (
                  <button
                    key={a.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onChange({ animationMode: a.value })}
                    className={cn(
                      "h-11 rounded-[10px] flex flex-col items-center justify-center gap-px cursor-pointer",
                      active ? "bg-accent text-white" : "bg-surface text-paper hover:bg-hover"
                    )}
                  >
                    <span
                      className={cn(
                        "leading-none font-black",
                        !active && a.value === "none" && "text-ink-3",
                        !active && a.value === "fade" && "opacity-35"
                      )}
                      style={{
                        fontFamily: resolveFontFamily("Montserrat"),
                        fontSize: active ? 16 : a.value === "scale" ? 11 : 14,
                        transform: a.value === "slide-up" && !active ? "translateY(3px)" : undefined,
                      }}
                    >
                      Aa
                    </span>
                    <span className={cn("text-[10px] leading-none", active ? "font-bold" : "font-semibold text-ink-3")}>
                      {a.label}
                    </span>
                  </button>
                )
              })}
            </div>
            {animation !== "none" && (
              <>
                <Segmented<"subtle" | "medium" | "strong">
                  size="sm"
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
            <button
              type="button"
              onClick={onOpenStyle}
              className="font-semibold text-paper underline underline-offset-[3px] hover:text-accent-ink cursor-pointer"
            >
              Pick a word-by-word look
            </button>{" "}
            to enable them.
          </Hint>
        )}
      </PanelSection>

      {isWordGroup && (
        <>
          <PanelDivider />
          <PanelSection label="Highlight" aside="Active word">
            <Segmented<"word" | "fill">
              size="sm"
              value={style.highlightMode ?? "word"}
              onChange={(v) => onChange({ highlightMode: v })}
              options={[
                { value: "word", label: "Word" },
                { value: "fill", label: "Letter fill" },
              ]}
            />
          </PanelSection>

          <PanelDivider />
          <PanelSection label="Grouping">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-paper">Words per group</span>
              <div className="flex items-center h-8 rounded-full bg-surface">
                <button
                  type="button"
                  title="Fewer words"
                  aria-label="Fewer words"
                  disabled={wordsPerGroup <= 1}
                  onClick={() => onChange({ wordsPerGroup: wordsPerGroup - 1 })}
                  className="w-8 h-full flex items-center justify-center text-paper rounded-full hover:bg-hover disabled:opacity-30 cursor-pointer"
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="w-[22px] text-center font-mono tabular-nums text-[13px] text-paper">{wordsPerGroup}</span>
                <button
                  type="button"
                  title="More words"
                  aria-label="More words"
                  disabled={wordsPerGroup >= 6}
                  onClick={() => onChange({ wordsPerGroup: wordsPerGroup + 1 })}
                  className="w-8 h-full flex items-center justify-center text-paper rounded-full hover:bg-hover disabled:opacity-30 cursor-pointer"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </div>
            <Row label="Max characters" labelWidth={110} value={style.maxCharsPerGroup ?? 24}>
              <Slider
                min={10}
                max={40}
                value={style.maxCharsPerGroup ?? 24}
                onChange={(v) => onChange({ maxCharsPerGroup: v })}
                aria-label="Max characters per group"
              />
            </Row>
            <Row label="Pause split" labelWidth={110} value={`${(style.splitPauseGap ?? 0.35).toFixed(2)}s`}>
              <Slider
                min={0.1}
                max={1}
                step={0.05}
                value={style.splitPauseGap ?? 0.35}
                onChange={(v) => onChange({ splitPauseGap: v })}
                aria-label="Pause split"
              />
            </Row>
          </PanelSection>
        </>
      )}
    </div>
  )
}
