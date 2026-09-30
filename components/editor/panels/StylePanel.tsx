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
import { PanelHeader, hexToRgba } from "./shared"

export function StylePanel({
  style,
  frameUrl,
  sampleText,
  onApply,
  onOpenText,
}: {
  style: SubtitleStyle
  /** Still from the user's own video; null → neutral dark frame. */
  frameUrl: string | null
  /** First words of the transcript, used as the tile caption. */
  sampleText: string
  onApply: (preset: SubtitlePreset) => void
  onOpenText: () => void
}) {
  const wordGroup = SUBTITLE_PRESETS.filter((p) => p.style.displayMode === "word-group")
  const sentence = SUBTITLE_PRESETS.filter((p) => p.style.displayMode !== "word-group")
  const tokens = sampleText.split(/\s+/).filter(Boolean)

  return (
    <div className="flex flex-col h-full min-h-0">
      <PanelHeader title="Style" meta="Previewed on your own video" />
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 pb-5 flex flex-col gap-4">
        {[
          { label: "Word by word · animated", items: wordGroup },
          { label: "Full sentence", items: sentence },
        ].map((group) =>
          group.items.length === 0 ? null : (
            <div key={group.label} className="flex flex-col gap-2.5">
              <span className="text-[12.5px] font-medium text-ink-2">{group.label}</span>
              <div className="grid grid-cols-2 gap-2.5">
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
      <p className="px-5 py-3.5 border-t border-line/8 text-[12px] leading-relaxed text-ink-3 flex-none">
        Templates set font, colors, outline and animation. Fine-tune in{" "}
        <button type="button" onClick={onOpenText} className="text-paper underline underline-offset-[3px] hover:text-accent-ink">
          Text &amp; animation
        </button>
        .
      </p>
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
      className="flex flex-col gap-[7px] text-left group"
    >
      <span
        className={cn(
          "relative h-[104px] w-full rounded-lg overflow-hidden flex items-center justify-center px-2 transition-shadow duration-150",
          !active && "group-hover:shadow-[0_0_0_1px_rgba(var(--c-line),0.25)]"
        )}
        style={{
          // Video content never changes with theme.
          background: frameUrl
            ? `center / cover no-repeat url(${frameUrl})`
            : "radial-gradient(120% 90% at 50% 30%, #4a4a44 0%, #1D1D1A 70%)",
          boxShadow: active ? "0 0 0 2px var(--c-ring)" : undefined,
        }}
      >
        <span className="absolute inset-0 bg-black/35" />
        <span
          className="relative text-center leading-[1.1]"
          style={{
            fontFamily: resolveFontFamily(s.fontFamily),
            fontWeight: s.fontWeight ?? 700,
            fontSize: isWordGroup ? 17 : 12.5,
            color: s.color,
            textShadow,
            backgroundColor: isWordGroup && s.highlightBg ? undefined : bg,
            padding: s.backgroundOpacity > 0 && !(isWordGroup && s.highlightBg) ? "2px 6px" : undefined,
            borderRadius: 4,
          }}
        >
          {isWordGroup ? (
            <>
              {caseFn(first)}{" "}
              <span
                style={{
                  color: s.highlightBg ? s.highlightColor || "#FFFFFF" : s.highlightColor || "#FFD700",
                  backgroundColor: s.highlightBg || undefined,
                  padding: s.highlightBg ? "1px 5px" : undefined,
                  borderRadius: 4,
                }}
              >
                {caseFn(second)}
              </span>
            </>
          ) : (
            caseFn(sentenceText)
          )}
        </span>
        {active && (
          <span className="absolute top-1.5 right-1.5 size-5 rounded-full bg-accent flex items-center justify-center">
            <Check className="size-3 text-on-accent" strokeWidth={3} />
          </span>
        )}
      </span>
      <span className={cn("text-[12.5px]", active ? "text-paper font-medium" : "text-ink-3")}>{preset.name}</span>
    </button>
  )
}
