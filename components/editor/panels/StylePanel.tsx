"use client"

import { Check } from "lucide-react"
import {
  SUBTITLE_PRESETS,
  matchesPreset,
  resolveFontFamily,
  type SubtitlePreset,
  type SubtitleStyle,
} from "@/lib/subtitle-track"
import { cn } from "@/lib/utils"
import { hexToRgba } from "./shared"

/** "Looks" tab — subtitle templates previewed on a still from the user's video. */
export function StylePanel({
  style,
  frameUrl,
  sampleText,
  onApply,
}: {
  style: SubtitleStyle
  /** Still from the user's own video; null → neutral dark frame. */
  frameUrl: string | null
  /** First words of the transcript, used as the tile caption. */
  sampleText: string
  onApply: (preset: SubtitlePreset) => void
}) {
  const wordGroup = SUBTITLE_PRESETS.filter((p) => p.style.displayMode === "word-group")
  const sentence = SUBTITLE_PRESETS.filter((p) => p.style.displayMode !== "word-group")
  const tokens = sampleText.split(/\s+/).filter(Boolean)

  return (
    <div className="flex flex-col">
      {[
        { label: "Word by word", items: wordGroup },
        { label: "Full sentence", items: sentence },
      ].map((group, gi) =>
        group.items.length === 0 ? null : (
          <div key={group.label} className="flex flex-col">
            <span className={cn("mb-2.5 text-[13px] font-bold text-paper", gi === 0 ? "mt-5" : "mt-[18px]")}>
              {group.label}
            </span>
            <div className="grid grid-cols-2 gap-2">
              {group.items.map((preset) => (
                <TemplateTile
                  key={preset.id}
                  preset={preset}
                  active={matchesPreset(style, preset)}
                  frameUrl={frameUrl}
                  tokens={tokens}
                  onClick={() => onApply(preset)}
                />
              ))}
            </div>
          </div>
        )
      )}
    </div>
  )
}

function TemplateTile({
  preset,
  active,
  frameUrl,
  tokens,
  onClick,
}: {
  preset: SubtitlePreset
  active: boolean
  frameUrl: string | null
  tokens: string[]
  onClick: () => void
}) {
  const s = preset.style
  const isWordGroup = s.displayMode === "word-group"
  const caseFn = (t: string) => (s.uppercase ? t.toUpperCase() : t)

  const bg = s.backgroundOpacity > 0 ? hexToRgba(s.backgroundColor, s.backgroundOpacity) : "transparent"
  // Match worker: outline only renders when backgroundOpacity <= 0 (BorderStyle=1)
  const w = Math.max(1, Math.min(s.outlineWidth, 3))
  const oc = s.outlineColor
  const textShadow =
    s.outline && s.backgroundOpacity <= 0
      ? `${w}px 0 0 ${oc}, -${w}px 0 0 ${oc}, 0 ${w}px 0 ${oc}, 0 -${w}px 0 ${oc}, ${w}px ${w}px 0 ${oc}, -${w}px -${w}px 0 ${oc}, ${w}px -${w}px 0 ${oc}, -${w}px ${w}px 0 ${oc}`
      : "0 1px 3px rgba(0,0,0,0.6)"

  const first = tokens[0] ?? "DO"
  const second = tokens[1] ?? "IT"
  const sentenceText = tokens.length ? tokens.slice(0, 4).join(" ") : "Your subtitles here"

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={preset.name}
      className={cn(
        "relative h-24 w-full rounded-[10px] overflow-hidden flex items-center justify-center px-2 cursor-pointer",
        !active && "hover:shadow-[0_0_0_2px_rgba(var(--c-line),0.2)]"
      )}
      style={{
        // Video content never changes with theme.
        background: frameUrl
          ? `center 30% / cover no-repeat url(${frameUrl})`
          : "radial-gradient(120% 90% at 50% 30%, #55554f 0%, #1c1c1f 70%)",
        boxShadow: active ? "0 0 0 2.5px var(--c-accent)" : undefined,
      }}
    >
      {/* ≈ brightness(.65) on the frame */}
      <span className="absolute inset-0 bg-black/35" />
      <span
        className="relative text-center leading-[1.1]"
        style={{
          fontFamily: resolveFontFamily(s.fontFamily),
          fontWeight: s.fontWeight ?? 700,
          fontSize: isWordGroup ? 17 : 13,
          color: s.color,
          textShadow,
          backgroundColor: isWordGroup && s.highlightBg ? undefined : bg,
          padding: s.backgroundOpacity > 0 && !(isWordGroup && s.highlightBg) ? "3px 7px" : undefined,
        }}
      >
        {isWordGroup ? (
          <>
            {caseFn(first)}{" "}
            <span
              style={{
                color: s.highlightBg ? s.highlightColor || "#FFFFFF" : s.highlightColor || "#FFD700",
                backgroundColor: s.highlightBg || undefined,
                padding: s.highlightBg ? "0 4px" : undefined,
              }}
            >
              {caseFn(second)}
            </span>
          </>
        ) : (
          caseFn(sentenceText)
        )}
      </span>
      <span className="absolute left-2 bottom-1.5 text-[11px] font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">
        {preset.name}
      </span>
      {active && (
        <span className="absolute top-1.5 right-1.5 size-[18px] rounded-full bg-accent flex items-center justify-center">
          <Check className="size-[11px] text-white" strokeWidth={3} />
        </span>
      )}
    </button>
  )
}
