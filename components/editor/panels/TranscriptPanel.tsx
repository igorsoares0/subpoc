"use client"

import { useEffect, useRef } from "react"
import { AudioLines, Eraser, Loader2, Merge, Pencil, Plus, Scissors, Sparkles, Trash2, WandSparkles, Check } from "lucide-react"
import type { Subtitle } from "@/lib/subtitle-track"
import { Button, IconButton } from "@/components/ui/Button"
import { Kbd } from "@/components/ui/controls"
import { cn } from "@/lib/utils"
import { PanelHeader } from "./shared"
import { formatShort, formatTimecode } from "../types"

// Accepts "m:ss.cc", "ss.cc" or plain seconds.
function parseTimecode(input: string): number {
  const t = input.trim()
  if (!t) return NaN
  if (t.includes(":")) {
    const [m, s] = t.split(":")
    return Number(m) * 60 + Number(s)
  }
  return Number(t)
}

export function TranscriptPanel({
  subtitles,
  durationSeconds,
  selectedId,
  activeId,
  editingId,
  displayTime,
  keywordsActive,
  isTranscribing,
  emphasisColor,
  onTranscribe,
  onSelect,
  onEdit,
  onStopEdit,
  onTextChange,
  onTimingChange,
  onSplit,
  onMerge,
  onDelete,
  onAdd,
  onAutoHighlight,
  onClearHighlights,
}: {
  subtitles: Subtitle[]
  durationSeconds: number
  /** Block the user picked (null while playing freely). */
  selectedId: number | null
  /** Block under the playhead. */
  activeId: number | null
  editingId: number | null
  displayTime: number
  keywordsActive: boolean
  isTranscribing: boolean
  emphasisColor: string
  onTranscribe: () => void
  onSelect: (sub: Subtitle) => void
  onEdit: (sub: Subtitle) => void
  onStopEdit: () => void
  onTextChange: (id: number, text: string) => void
  onTimingChange: (id: number, field: "start" | "end", value: number) => void
  onSplit: (sub: Subtitle) => void
  onMerge: (sub: Subtitle) => void
  onDelete: (id: number) => void
  onAdd: () => void
  onAutoHighlight: () => void
  onClearHighlights: () => void
}) {
  const focusId = selectedId ?? activeId
  const focusRef = useRef<HTMLDivElement>(null)

  // Keep the block under the playhead (or the selected one) in view.
  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [focusId])

  if (subtitles.length === 0) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <PanelHeader title="Transcript" meta="No blocks yet" />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 pb-16 text-center">
          <div className="size-14 rounded-[14px] bg-surface border border-line/8 flex items-center justify-center">
            <AudioLines className="size-6 text-accent-ink" strokeWidth={1.75} />
          </div>
          <h3 className="font-serif text-[30px] leading-[1.05] text-paper">
            Your video has <em className="italic">no subtitles yet</em>
          </h3>
          <p className="text-[13.5px] leading-normal text-ink-3">
            We transcribe the audio and split it into synced blocks. Then just review the text.
          </p>
          <Button onClick={onTranscribe} disabled={isTranscribing} className="w-full">
            {isTranscribing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Transcribing…
              </>
            ) : (
              <>
                <WandSparkles className="size-[15px]" />
                Auto transcribe
              </>
            )}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <PanelHeader
        title="Transcript"
        meta={`${subtitles.length} ${subtitles.length === 1 ? "block" : "blocks"} · ${formatShort(durationSeconds)}`}
      >
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onAutoHighlight}
            className={cn("flex-1 gap-1.5", keywordsActive && "bg-elevated")}
            title="Highlight keywords in a fixed color"
          >
            <Sparkles className="size-3.5 text-accent-ink" />
            Auto-highlight keywords
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearHighlights}
            title="Clear highlights"
            aria-label="Clear highlights"
            className="w-[34px] px-0 text-ink-2"
          >
            <Eraser className="size-3.5" />
          </Button>
        </div>
      </PanelHeader>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 py-1 flex flex-col">
        {subtitles.map((sub, idx) => {
          const prev = subtitles[idx - 1]
          const gap = prev ? sub.start - prev.end : 0
          const isSelected = sub.id === selectedId
          const isActive = sub.id === activeId
          const isEditing = sub.id === editingId
          const isLast = idx === subtitles.length - 1

          return (
            <div key={sub.id}>
              {gap > 0.05 && (
                <div className="flex items-center gap-2 py-1.5 pr-3 pl-[82px] font-mono text-[10.5px] text-ink-4">
                  <span className="flex-1 h-px bg-line/6" />
                  pause {gap.toFixed(2)}s
                  <span className="flex-1 h-px bg-line/6" />
                </div>
              )}
              <div
                ref={sub.id === focusId ? focusRef : undefined}
                onClick={() => onSelect(sub)}
                className={cn(
                  "grid grid-cols-[58px_1fr] gap-3 p-3 rounded-xl cursor-pointer transition-colors duration-150",
                  isSelected ? "bg-elevated" : "hover:bg-surface"
                )}
              >
                {/* Timecodes */}
                {isSelected ? (
                  <div className="flex flex-col gap-1.5 pt-0.5" onClick={(e) => e.stopPropagation()}>
                    {(["start", "end"] as const).map((field) => (
                      <input
                        key={`${field}-${sub[field]}`}
                        defaultValue={formatTimecode(sub[field])}
                        onBlur={(e) => {
                          const v = parseTimecode(e.target.value)
                          if (Number.isNaN(v)) e.target.value = formatTimecode(sub[field])
                          else onTimingChange(sub.id, field, v)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                          if (e.key === "Escape") {
                            ;(e.target as HTMLInputElement).value = formatTimecode(sub[field])
                            ;(e.target as HTMLInputElement).blur()
                          }
                        }}
                        title={field === "start" ? "Start time" : "End time"}
                        aria-label={field === "start" ? "Start time" : "End time"}
                        className={cn(
                          "w-[62px] h-6 px-1 -ml-1 rounded-xs bg-surface font-mono tabular-nums text-[11px] text-paper outline-none border focus:border-accent-ink/60",
                          field === "start" ? "border-accent-ink/50" : "border-line/12"
                        )}
                      />
                    ))}
                  </div>
                ) : (
                  <div
                    className={cn(
                      "flex flex-col gap-[3px] pt-[3px] font-mono tabular-nums text-[11px] leading-[1.3]",
                      isActive ? "text-accent-ink" : "text-ink-3"
                    )}
                  >
                    <span>{formatTimecode(sub.start)}</span>
                    <span>{formatTimecode(sub.end)}</span>
                  </div>
                )}

                {/* Text + actions */}
                <div className="flex flex-col gap-2.5 min-w-0">
                  {isEditing ? (
                    <textarea
                      value={sub.text}
                      onChange={(e) => onTextChange(sub.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) onStopEdit()
                      }}
                      rows={3}
                      autoFocus
                      className="w-full resize-none rounded-md bg-canvas border border-accent/40 px-2.5 py-2 text-[15px] leading-[1.5] text-paper outline-none focus:border-accent-ink/50"
                    />
                  ) : (
                    <p
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        onEdit(sub)
                      }}
                      className={cn(
                        "text-[15.5px] leading-[1.55] [text-wrap:pretty]",
                        isActive || isSelected ? "text-paper" : "text-ink-2"
                      )}
                    >
                      <BlockText sub={sub} isActive={isActive} displayTime={displayTime} emphasisColor={emphasisColor} />
                    </p>
                  )}

                  {isSelected && (
                    <div className="flex items-center gap-1 -ml-1.5" onClick={(e) => e.stopPropagation()}>
                      <ActionButton title="Split at playhead" onClick={() => onSplit(sub)}>
                        <Scissors className="size-[13px]" />
                        Split
                      </ActionButton>
                      <ActionButton title="Merge with next" onClick={() => onMerge(sub)} disabled={isLast}>
                        <Merge className="size-[13px]" />
                        Merge
                      </ActionButton>
                      {isEditing ? (
                        <ActionButton title="Done editing  ⌘↵" onClick={onStopEdit}>
                          <Check className="size-[13px]" />
                          Done
                        </ActionButton>
                      ) : (
                        <ActionButton title="Edit text (double-click)" onClick={() => onEdit(sub)}>
                          <Pencil className="size-[13px]" />
                          Edit
                        </ActionButton>
                      )}
                      <span className="flex-1" />
                      <IconButton size={26} destructive title="Delete subtitle" onClick={() => onDelete(sub.id)} className="text-ink-3">
                        <Trash2 className="size-[13px]" />
                      </IconButton>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        <button
          type="button"
          onClick={onAdd}
          className="mt-2 mb-3 mx-3 h-9 flex-none flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-line/14 text-[12.5px] text-ink-3 hover:text-paper hover:bg-surface transition-colors duration-150"
        >
          <Plus className="size-3.5" />
          Add subtitle at playhead
        </button>
      </div>

      <div className="px-5 pt-3 pb-4 border-t border-line/8 flex flex-wrap gap-x-3.5 gap-y-2 text-[11.5px] text-ink-3 flex-none">
        <span className="flex items-center gap-1.5 whitespace-nowrap"><Kbd>Space</Kbd>Play</span>
        <span className="flex items-center gap-1.5 whitespace-nowrap"><Kbd>←</Kbd><Kbd>→</Kbd>Seek</span>
        <span className="flex items-center gap-1.5 whitespace-nowrap"><Kbd>I</Kbd><Kbd>O</Kbd>Trim in/out</span>
        <span className="flex items-center gap-1.5 whitespace-nowrap"><Kbd>⌘Z</Kbd>Undo</span>
      </div>
    </div>
  )
}

function ActionButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { title: string }) {
  return (
    <button
      type="button"
      {...props}
      className="h-[26px] px-2 rounded-sm flex items-center gap-[5px] text-[11.5px] font-medium text-ink-2 hover:bg-hover hover:text-paper transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
    >
      {children}
    </button>
  )
}

// Word-level rendering: spoken words read as paper, the current word gets a
// lime wash, keyword-emphasis words are underlined in the emphasis color.
function BlockText({
  sub,
  isActive,
  displayTime,
  emphasisColor,
}: {
  sub: Subtitle
  isActive: boolean
  displayTime: number
  emphasisColor: string
}) {
  if (!sub.words || sub.words.length === 0) return <>{sub.text}</>
  return (
    <>
      {sub.words.map((w, i) => {
        const spoken = isActive && w.start <= displayTime
        const current = isActive && displayTime >= w.start && displayTime < w.end
        return (
          <span key={i}>
            <span
              className={cn(
                "rounded-[3px] transition-colors duration-100",
                isActive && !spoken && "text-ink-3",
                current && "bg-accent/35 text-paper"
              )}
              style={
                w.emphasis
                  ? { textDecoration: "underline", textDecorationColor: emphasisColor, textDecorationThickness: 2, textUnderlineOffset: 4 }
                  : undefined
              }
            >
              {w.word}
            </span>{" "}
          </span>
        )
      })}
    </>
  )
}
