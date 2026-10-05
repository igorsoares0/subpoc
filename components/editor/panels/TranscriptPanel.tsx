"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, Eraser, Loader2, Merge, Pencil, Plus, Scissors, Search, Sparkles, Trash2, WandSparkles, X } from "lucide-react"
import { countMatches, type Subtitle } from "@/lib/subtitle-track"
import {
  TRANSCRIPTION_LANGUAGES,
  VOCABULARY_MAX_CHARS,
  isTranscriptionLanguage,
  type TranscriptionLanguage,
} from "@/lib/transcription-options"
import { Button, IconButton } from "@/components/ui/Button"
import { Field, Input } from "@/components/ui/Field"
import { Highlight } from "@/components/ui/Highlight"
import { cn } from "@/lib/utils"
import { formatShort, formatTimecode } from "../types"

export interface TranscribeOptions {
  language: TranscriptionLanguage
  vocabulary: string
}

// Per-browser convenience: most users always transcribe in the same language.
const LANGUAGE_STORAGE_KEY = "supertitle:transcribe-language"

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

/** "Script" — the transcript, always in the editor's left column. */
export function TranscriptPanel({
  subtitles,
  durationSeconds,
  selectedId,
  activeId,
  editingId,
  displayTime,
  keywordsActive,
  isTranscribing,
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
  onReplaceAll,
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
  onTranscribe: (opts: TranscribeOptions) => void
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
  /** Replaces every match across the transcript; returns how many. */
  onReplaceAll: (find: string, replace: string) => number
}) {
  const focusId = selectedId ?? activeId
  const focusRef = useRef<HTMLDivElement>(null)

  const [language, setLanguage] = useState<TranscriptionLanguage>("auto")
  const [vocabulary, setVocabulary] = useState("")
  const [findOpen, setFindOpen] = useState(false)
  const [findText, setFindText] = useState("")
  const [replaceText, setReplaceText] = useState("")
  const matchCount = findOpen ? countMatches(subtitles, findText) : 0

  // Restore the last language picked in this browser.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY)
      if (isTranscriptionLanguage(saved)) setLanguage(saved)
    } catch {}
  }, [])

  const pickLanguage = (value: string) => {
    if (!isTranscriptionLanguage(value)) return
    setLanguage(value)
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, value)
    } catch {}
  }

  const closeFind = () => {
    setFindOpen(false)
    setFindText("")
    setReplaceText("")
  }

  // Keep the block under the playhead (or the selected one) in view.
  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [focusId])

  const empty = subtitles.length === 0
  const meta = empty
    ? isTranscribing
      ? "listening…"
      : "no lines"
    : `${subtitles.length} ${subtitles.length === 1 ? "line" : "lines"} · ${formatShort(durationSeconds)}`

  return (
    <section className="flex flex-col h-full min-h-0 pt-2">
      <div className="flex items-baseline justify-between gap-3 pt-3 px-7 pb-4 flex-none">
        <h2 className="display text-[28px] tracking-[-0.02em] text-paper">Script</h2>
        <span className="flex-1" />
        <span className="font-mono text-[12px] text-ink-3">{meta}</span>
        {!empty && (
          <IconButton
            title="Find & replace"
            active={findOpen}
            onClick={() => (findOpen ? closeFind() : setFindOpen(true))}
            className="self-center"
          >
            <Search className="size-3.5" />
          </IconButton>
        )}
      </div>

      {findOpen && !empty && (
        <form
          className="flex flex-col gap-2 mx-4 mb-3 p-3 rounded-[12px] bg-surface flex-none"
          onSubmit={(e) => {
            e.preventDefault()
            if (matchCount > 0) onReplaceAll(findText, replaceText)
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeFind()
          }}
        >
          <div className="flex items-center gap-2">
            <Input
              inputSize="sm"
              autoFocus
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              placeholder="Find"
              aria-label="Find"
              className="bg-canvas"
            />
            <span className="w-[74px] flex-none text-right font-mono text-[12px] text-ink-3">
              {findText.trim() ? `${matchCount} ${matchCount === 1 ? "match" : "matches"}` : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              inputSize="sm"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="Replace with"
              aria-label="Replace with"
              className="bg-canvas"
            />
            <Button type="submit" size="sm" className="h-[34px] flex-none text-[12.5px]" disabled={matchCount === 0}>
              Replace all
            </Button>
            <IconButton title="Close (Esc)" size={34} onClick={closeFind}>
              <X className="size-3.5" />
            </IconButton>
          </div>
        </form>
      )}

      {empty && isTranscribing ? (
        <>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-[18px] px-7 pt-1" aria-hidden>
            {[
              { opacity: 1, lines: ["100%", "72%"] },
              { opacity: 0.7, lines: ["84%"] },
              { opacity: 0.45, lines: ["100%", "58%"] },
              { opacity: 0.25, lines: ["90%"] },
            ].map((block, i) => (
              <div key={i} className="flex flex-col gap-2" style={{ opacity: block.opacity }}>
                <span className="w-[110px] h-2.5 rounded-full bg-surface" />
                {block.lines.map((w, j) => (
                  <span key={j} className="h-[18px] rounded-md bg-surface" style={{ width: w }} />
                ))}
              </div>
            ))}
          </div>
          <p className="px-7 pt-3 pb-[18px] text-[13px] text-ink-3 flex-none">
            Lines appear here as soon as the transcript is ready.
          </p>
        </>
      ) : empty ? (
        <div className="flex-1 flex flex-col justify-center gap-[18px] px-7 pb-[60px]">
          <h3 className="display text-[40px] tracking-[-0.03em] text-paper">
            No subtitles <Highlight className="px-1.5">yet</Highlight>
          </h3>
          <p className="text-[15px] leading-normal text-ink-2">
            We transcribe the audio and split it into synced blocks. Then just review the text.
          </p>
          <Field label="Spoken language">
            <div className="relative">
              <select
                value={language}
                onChange={(e) => pickLanguage(e.target.value)}
                className="w-full h-[44px] appearance-none rounded-xl bg-surface pl-4 pr-10 text-[14px] text-paper outline-none focus:edge-accent cursor-pointer"
              >
                {TRANSCRIPTION_LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="size-4 text-ink-3 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </Field>
          <Field label="Names & terms" aside={<span className="text-ink-3">optional</span>}>
            <Input
              inputSize="md"
              className="rounded-xl"
              value={vocabulary}
              onChange={(e) => setVocabulary(e.target.value)}
              maxLength={VOCABULARY_MAX_CHARS}
              placeholder="e.g. Supertitle, Hormozi, CAC, churn"
            />
          </Field>
          <Button
            size="xl"
            className="self-start h-12 px-6 text-[15px]"
            onClick={() => onTranscribe({ language, vocabulary })}
            disabled={isTranscribing}
          >
            {isTranscribing ? (
              <>
                <Loader2 className="size-[17px] animate-spin" />
                Transcribing…
              </>
            ) : (
              <>
                <WandSparkles className="size-[17px]" />
                Auto transcribe
              </>
            )}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 flex flex-col gap-1">
            {subtitles.map((sub, idx) => {
              const isSelected = sub.id === selectedId
              const isActive = sub.id === activeId
              const isFocus = sub.id === focusId
              const isEditing = sub.id === editingId
              const isLast = idx === subtitles.length - 1

              return (
                <div
                  key={sub.id}
                  ref={isFocus ? focusRef : undefined}
                  onClick={() => onSelect(sub)}
                  className={cn(
                    "rounded-[10px] cursor-pointer flex flex-col",
                    isFocus ? "bg-surface px-3 py-3.5 gap-2.5" : "p-3 gap-1.5 hover:bg-surface/60"
                  )}
                >
                  {/* Timecodes */}
                  {isFocus ? (
                    <div className="flex items-center gap-2 font-mono tabular-nums text-[12px]" onClick={(e) => isSelected && e.stopPropagation()}>
                      {isSelected ? (
                        (["start", "end"] as const).map((field, i) => (
                          <span key={field} className="contents">
                            {i === 1 && <span className="text-ink-3">→</span>}
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
                              className="w-[66px] px-[7px] py-[3px] rounded-sm bg-canvas text-center text-paper outline-none focus:shadow-[inset_0_0_0_1.5px_var(--c-accent)]"
                            />
                          </span>
                        ))
                      ) : (
                        <>
                          <span className="px-[7px] py-[3px] rounded-sm bg-canvas text-paper">{formatTimecode(sub.start)}</span>
                          <span className="text-ink-3">→</span>
                          <span className="px-[7px] py-[3px] rounded-sm bg-canvas text-paper">{formatTimecode(sub.end)}</span>
                        </>
                      )}
                      <span className="flex-1" />
                      <span className="text-ink-3">{Math.max(0, sub.end - sub.start).toFixed(1)}s</span>
                    </div>
                  ) : (
                    <span className="font-mono tabular-nums text-[12px] text-ink-3">
                      {formatTimecode(sub.start)} → {formatTimecode(sub.end)}
                    </span>
                  )}

                  {/* Text */}
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
                      className="w-full resize-none rounded-[10px] bg-canvas px-3 py-2 text-[20px] font-semibold leading-[1.35] tracking-[-0.01em] text-paper outline-none edge-accent"
                    />
                  ) : (
                    <p
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        onEdit(sub)
                      }}
                      className={cn(
                        "text-[20px] font-semibold leading-[1.35] tracking-[-0.01em] text-pretty",
                        isFocus ? "text-paper" : "text-ink-2"
                      )}
                    >
                      <BlockText sub={sub} isActive={isActive && isFocus} displayTime={displayTime} />
                    </p>
                  )}

                  {/* Actions */}
                  {isSelected && (
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <ActionPill title="Split at playhead" onClick={() => onSplit(sub)}>
                        <Scissors className="size-[13px]" />
                        Split
                      </ActionPill>
                      <ActionPill title="Merge with next" onClick={() => onMerge(sub)} disabled={isLast}>
                        <Merge className="size-[13px]" />
                        Merge
                      </ActionPill>
                      {isEditing ? (
                        <ActionPill title="Done editing  ⌘↵" onClick={onStopEdit}>
                          <Check className="size-[13px]" />
                          Done
                        </ActionPill>
                      ) : (
                        <ActionPill title="Edit text (double-click)" onClick={() => onEdit(sub)}>
                          <Pencil className="size-[13px]" />
                          Edit
                        </ActionPill>
                      )}
                      <span className="flex-1" />
                      <IconButton destructive title="Delete subtitle" onClick={() => onDelete(sub.id)}>
                        <Trash2 className="size-3.5" />
                      </IconButton>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex items-center gap-2 px-7 pt-2.5 pb-3.5 flex-none">
            <Button
              variant="tint"
              size="sm"
              className={cn("h-[34px] text-[12.5px] font-bold", keywordsActive && "shadow-[inset_0_0_0_1.5px_var(--c-accent)]")}
              onClick={onAutoHighlight}
              title="Highlight keywords in a fixed color"
            >
              <Sparkles className="size-3.5" />
              Auto-highlight keywords
            </Button>
            <Button variant="secondary" size="sm" className="h-[34px] text-[12.5px]" onClick={onClearHighlights} title="Clear highlights">
              <Eraser className="size-3.5" />
              Clear
            </Button>
            <span className="flex-1" />
            <IconButton title="Add subtitle at playhead" tone="surface" size={34} onClick={onAdd}>
              <Plus className="size-[15px]" />
            </IconButton>
          </div>
        </>
      )}
    </section>
  )
}

function ActionPill({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { title: string }) {
  return (
    <button
      type="button"
      {...props}
      className="h-[30px] px-3 rounded-full bg-canvas flex items-center gap-1.5 text-[12.5px] font-semibold text-paper hover:bg-hover disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
    >
      {children}
    </button>
  )
}

// Word-level rendering on the active line: the spoken word sits on the accent
// highlight block, upcoming words read as ink-3. Keyword-emphasis words get the
// yellow highlight on every line.
function BlockText({
  sub,
  isActive,
  displayTime,
}: {
  sub: Subtitle
  isActive: boolean
  displayTime: number
}) {
  if (!sub.words || sub.words.length === 0) return <>{sub.text}</>
  return (
    <>
      {sub.words.map((w, i) => {
        const current = isActive && displayTime >= w.start && displayTime < w.end
        const upcoming = isActive && w.start > displayTime
        return (
          <span key={i}>
            <span
              className={cn(
                current
                  ? "bg-accent text-on-accent px-[3px] rounded-xs"
                  : w.emphasis
                    ? "bg-highlight text-[#0D0D0D] px-0.5"
                    : upcoming && "text-ink-3"
              )}
            >
              {w.word}
            </span>{" "}
          </span>
        )
      })}
    </>
  )
}
