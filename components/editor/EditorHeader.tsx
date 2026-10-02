"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, Play, Redo2, Undo2 } from "lucide-react"
import { Wordmark } from "@/components/ui/Wordmark"
import { Button, IconButton } from "@/components/ui/Button"
import { Segmented } from "@/components/ui/controls"
import { Avatar, UserMenu } from "@/components/ui/ThemeMenu"
import { cn } from "@/lib/utils"
import { FORMAT_OPTIONS } from "./types"

// Header order: vertical first (most projects are Reels/TikTok/Shorts).
const FORMAT_ORDER = ["9:16", "16:9", "1:1", "4:3", "Original"] as const
const FORMAT_HINTS: Record<string, string> = {
  Original: "Keep source size",
  "16:9": "YouTube · horizontal",
  "9:16": "Reels · TikTok · Shorts",
  "1:1": "Instagram feed",
  "4:3": "Classic",
}
const HEADER_FORMATS = FORMAT_ORDER.map((label) => FORMAT_OPTIONS.find((f) => f.label === label)!)

function useClickOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close()
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open, close])
  return ref
}

export function EditorHeader({
  title,
  isSaving,
  format,
  onFormatChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  hasSubtitles,
  onExportSRT,
  onExportVTT,
  isRendering,
  hasRender,
  onRender,
  onPreviewRender,
  user,
}: {
  title: string
  isSaving: boolean
  format: string | null
  onFormatChange: (value: string | null) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  hasSubtitles: boolean
  onExportSRT: () => void
  onExportVTT: () => void
  isRendering: boolean
  hasRender: boolean
  onRender: () => void
  onPreviewRender: () => void
  user?: { name?: string | null; email?: string | null }
}) {
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useClickOutside(exportOpen, () => setExportOpen(false))

  const menuItem =
    "w-full text-left h-auto px-2.5 py-2 rounded-[9px] hover:bg-surface flex flex-col items-start gap-0.5 cursor-pointer"

  return (
    <header className="col-span-full h-16 flex items-center gap-4 px-5">
      {/* Left — back · wordmark · filename · save state */}
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <Link
          href="/dashboard"
          title="Back to projects"
          aria-label="Back to projects"
          className="size-9 flex-none rounded-full bg-surface flex items-center justify-center text-paper hover:bg-hover hover:text-paper"
        >
          <ArrowLeft className="size-[17px]" />
        </Link>
        <Wordmark size={20} />
        <span className="w-px h-[22px] bg-line/12 flex-none" />
        <span className="text-[15px] font-semibold text-paper truncate" title={title}>
          {title}
        </span>
        <span className="font-mono text-[12px] text-ink-3 whitespace-nowrap" aria-live="polite">
          {isSaving ? "saving…" : "saved"}
        </span>
      </div>

      {/* Center — aspect ratio + undo/redo */}
      <div className="flex items-center gap-1 flex-none">
        <Segmented
          variant="inverse"
          stretch={false}
          value={format}
          onChange={onFormatChange}
          options={HEADER_FORMATS.map((f) => ({
            value: f.value as string | null,
            label: f.label,
            title: `${f.label} — ${FORMAT_HINTS[f.label]}`,
          }))}
          className="mr-1"
        />
        <IconButton title="Undo  ⌘Z" size={36} onClick={onUndo} disabled={!canUndo}>
          <Undo2 className="size-[17px]" />
        </IconButton>
        <IconButton title="Redo  ⇧⌘Z" size={36} onClick={onRedo} disabled={!canRedo}>
          <Redo2 className="size-[17px]" />
        </IconButton>
      </div>

      {/* Right — export · render · user */}
      <div className="flex items-center justify-end gap-2 flex-1">
        <div ref={exportRef} className="relative">
          <Button
            variant="secondary"
            size="md"
            onClick={() => setExportOpen((o) => !o)}
            disabled={!hasSubtitles}
            aria-haspopup="menu"
            aria-expanded={exportOpen}
          >
            Export .srt / .vtt
          </Button>
          {exportOpen && (
            <div
              role="menu"
              className="absolute z-50 right-0 top-full mt-2 w-60 p-1.5 rounded-2xl bg-canvas shadow-[var(--shadow-menu)] flex flex-col gap-0.5"
            >
              {[
                { label: "Export .srt", hint: "Universal subtitle format", onClick: onExportSRT },
                { label: "Export .vtt", hint: "Web video text tracks", onClick: onExportVTT },
              ].map((item) => (
                <button
                  key={item.label}
                  role="menuitem"
                  onClick={() => {
                    item.onClick()
                    setExportOpen(false)
                  }}
                  className={menuItem}
                >
                  <span className="text-[13.5px] font-semibold text-paper">{item.label}</span>
                  <span className="text-[12px] text-ink-3">{item.hint}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {isRendering ? (
          // Indeterminate progress inside the button while the render job runs.
          <span
            role="status"
            className="relative h-10 px-5 flex-none flex items-center rounded-full bg-elevated text-ink-2 text-[13.5px] font-bold whitespace-nowrap overflow-hidden"
          >
            <span className="absolute inset-y-0 left-0 w-1/3 bg-accent-tint animate-[indeterminate_1.6s_ease-in-out_infinite]" />
            <span className="relative">Rendering…</span>
          </span>
        ) : hasRender ? (
          <Button variant="outline-accent" size="md" className="px-5 shadow-[inset_0_0_0_2px_var(--c-accent)]" onClick={onPreviewRender}>
            <Play className="size-3.5 fill-current" />
            Preview render
          </Button>
        ) : (
          <Button size="md" className="px-5" onClick={onRender} disabled={!hasSubtitles}>
            Render video
            <ArrowRight className="size-[15px]" />
          </Button>
        )}

        <UserMenu
          email={user?.email}
          triggerTitle="Account & theme"
          triggerClassName={cn("rounded-full cursor-pointer")}
          trigger={<Avatar name={user?.name} email={user?.email} />}
        />
      </div>
    </header>
  )
}
