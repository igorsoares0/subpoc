"use client"

import { Captions, Layers, Palette, Type } from "lucide-react"
import { cn } from "@/lib/utils"
import type { EditorPanel } from "./types"

const ITEMS: { id: EditorPanel; label: string; icon: typeof Captions }[] = [
  { id: "subtitles", label: "Subtitles", icon: Captions },
  { id: "style", label: "Style", icon: Palette },
  { id: "text", label: "Text", icon: Type },
  { id: "overlays", label: "Overlays", icon: Layers },
]

/** 64px task rail — one panel per task (replaces the Subtitles/Styles tabs). */
export function EditorRail({
  active,
  onChange,
}: {
  active: EditorPanel
  onChange: (panel: EditorPanel) => void
}) {
  return (
    <nav
      aria-label="Editor panels"
      className="border-r border-line/8 flex flex-col items-center py-3 gap-1"
    >
      {ITEMS.map(({ id, label, icon: Icon }) => {
        const isActive = id === active
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "w-[52px] pt-2 pb-1.5 rounded-lg flex flex-col items-center gap-[5px] text-[10.5px] font-medium transition-colors duration-150",
              isActive ? "bg-elevated text-accent-ink" : "text-ink-3 hover:text-paper"
            )}
          >
            <Icon className="size-[19px]" strokeWidth={1.75} />
            {label}
          </button>
        )
      })}
    </nav>
  )
}
