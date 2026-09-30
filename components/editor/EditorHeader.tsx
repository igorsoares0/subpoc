"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CloudCheck,
  FileText,
  Film,
  Loader2,
  Monitor,
  Play,
  Redo2,
  RectangleHorizontal,
  RectangleVertical,
  Square,
  Undo2,
} from "lucide-react"
import { Wordmark } from "@/components/ui/Wordmark"
import { Button, IconButton } from "@/components/ui/Button"
import { Avatar, UserMenu } from "@/components/ui/ThemeMenu"
import { cn } from "@/lib/utils"
import { FORMAT_OPTIONS, getFormatLabel } from "./types"

const FORMAT_ICONS: Record<string, typeof Monitor> = {
  Original: Monitor,
  "16:9": RectangleHorizontal,
  "9:16": RectangleVertical,
  "1:1": Square,
  "4:3": RectangleHorizontal,
}

const FORMAT_HINTS: Record<string, string> = {
  Original: "Keep source size",
  "16:9": "YouTube · horizontal",
  "9:16": "Reels · TikTok · Shorts",
  "1:1": "Instagram feed",
  "4:3": "Classic",
}

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
  const [formatOpen, setFormatOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const formatRef = useClickOutside(formatOpen, () => setFormatOpen(false))
  const exportRef = useClickOutside(exportOpen, () => setExportOpen(false))

  const formatLabel = getFormatLabel(format)
  const FormatIcon = FORMAT_ICONS[formatLabel] ?? Monitor

  const menu =
    "absolute z-50 top-full mt-2 p-1.5 rounded-lg bg-elevated border border-line/12 shadow-[var(--shadow-menu)] flex flex-col"
  const menuItem =
    "w-full text-left px-2.5 py-2 rounded-[7px] hover:bg-hover transition-colors duration-150 flex items-center gap-2.5"

  return (
    <header className="col-span-full h-14 flex items-center justify-between gap-4 border-b border-line/8 pr-3.5">
      {/* Left — back · wordmark · breadcrumb · save state */}
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="w-16 flex justify-center flex-none">
          <Link
            href="/dashboard"
            title="Back to dashboard"
            aria-label="Back to dashboard"
            className="size-8 rounded-md flex items-center justify-center text-ink-3 hover:bg-elevated hover:text-paper transition-colors duration-150"
          >
            <ArrowLeft className="size-4" />
          </Link>
        </div>
        <Wordmark size={24} />
        <span className="w-px h-5 bg-line/10 flex-none" />
        <div className="flex items-center gap-1.5 text-[13.5px] min-w-0">
          <Link href="/dashboard" className="text-ink-3 hover:text-paper whitespace-nowrap">
            Projects /
          </Link>
          <span className="font-medium text-paper truncate">{title}</span>
        </div>
        <span className="flex items-center gap-1.5 text-[12px] text-ink-3 whitespace-nowrap">
          {isSaving ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <CloudCheck className="size-3.5" strokeWidth={1.75} />
              Saved
            </>
          )}
        </span>
      </div>

      {/* Center — format + undo/redo */}
      <div className="flex items-center gap-1 p-[3px] rounded-lg bg-surface border border-line/8 flex-none">
        <div ref={formatRef} className="relative">
          <button
            type="button"
            onClick={() => setFormatOpen((o) => !o)}
            title={`Format: ${formatLabel}`}
            aria-haspopup="menu"
            aria-expanded={formatOpen}
            className={cn(
              "h-[30px] px-2.5 rounded-[7px] flex items-center gap-2 text-[12.5px] font-medium whitespace-nowrap transition-colors duration-150",
              formatOpen ? "bg-hover text-paper" : "bg-elevated text-paper hover:bg-hover"
            )}
          >
            <FormatIcon className="size-3.5" strokeWidth={1.75} />
            {formatLabel === "Original" ? "Original" : `${formatLabel}`}
            <ChevronDown className="size-3 text-ink-3" />
          </button>
          {formatOpen && (
            <div role="menu" className={cn(menu, "left-0 w-56")}>
              {FORMAT_OPTIONS.map((f) => {
                const Icon = FORMAT_ICONS[f.label] ?? Monitor
                const active = format === f.value
                return (
                  <button
                    key={f.label}
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => {
                      onFormatChange(f.value)
                      setFormatOpen(false)
                    }}
                    className={menuItem}
                  >
                    <Icon className="size-4 text-ink-3" strokeWidth={1.75} />
                    <span className="flex-1 flex flex-col gap-0.5">
                      <span className="text-[13px] font-medium text-paper">{f.label}</span>
                      <span className="text-[11.5px] text-ink-3">{FORMAT_HINTS[f.label]}</span>
                    </span>
                    {active && <Check className="size-4 text-accent-ink" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <span className="w-px h-4 bg-line/10 mx-1" />
        <IconButton title="Undo  ⌘Z" onClick={onUndo} disabled={!canUndo}>
          <Undo2 className="size-[15px]" />
        </IconButton>
        <IconButton title="Redo  ⇧⌘Z" onClick={onRedo} disabled={!canRedo}>
          <Redo2 className="size-[15px]" />
        </IconButton>
      </div>

      {/* Right — export · render · user */}
      <div className="flex items-center justify-end gap-2 flex-1">
        <div ref={exportRef} className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExportOpen((o) => !o)}
            disabled={!hasSubtitles}
            aria-haspopup="menu"
            aria-expanded={exportOpen}
            className="text-[13px] gap-2"
          >
            <FileText className="size-[15px]" strokeWidth={1.75} />
            Export subtitles
            <ChevronDown className="size-3.5 text-ink-3" />
          </Button>
          {exportOpen && (
            <div role="menu" className={cn(menu, "right-0 w-60")}>
              {[
                { label: "Export SRT", hint: "Universal subtitle format", onClick: onExportSRT },
                { label: "Export VTT", hint: "Web video text tracks", onClick: onExportVTT },
              ].map((item) => (
                <button
                  key={item.label}
                  role="menuitem"
                  onClick={() => {
                    item.onClick()
                    setExportOpen(false)
                  }}
                  className={cn(menuItem, "flex-col items-start gap-0.5")}
                >
                  <span className="text-[13px] font-medium text-paper">{item.label}</span>
                  <span className="text-[11.5px] text-ink-3">{item.hint}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {isRendering ? (
          <Button size="sm" disabled className="text-[13px] px-3.5">
            <Loader2 className="size-[15px] animate-spin" />
            Rendering…
          </Button>
        ) : hasRender ? (
          <Button variant="outline-accent" size="sm" onClick={onPreviewRender} className="text-[13px] px-3.5 font-semibold">
            <Play className="size-3.5" />
            Preview render
          </Button>
        ) : (
          <Button size="sm" onClick={onRender} disabled={!hasSubtitles} className="text-[13px] px-3.5">
            <Film className="size-[15px]" />
            Render video
          </Button>
        )}

        <div className="ml-1.5">
          <UserMenu
            email={user?.email}
            triggerTitle="Account & theme"
            triggerClassName="rounded-full hover:ring-2 hover:ring-line/14 transition-shadow"
            trigger={<Avatar name={user?.name} email={user?.email} />}
          />
        </div>
      </div>
    </header>
  )
}
