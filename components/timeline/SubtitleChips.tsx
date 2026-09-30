'use client'

import type { Subtitle } from '@/lib/subtitle-track'
import { cn } from '@/lib/utils'

/**
 * Subtitle blocks as chips on the timeline (absolute video time). Clicking a
 * chip seeks to its start and selects the block.
 */
export function SubtitleChips({
  subtitles,
  videoDuration,
  selectedId,
  activeId,
  onSelect,
}: {
  subtitles: Subtitle[]
  videoDuration: number
  selectedId: number | null
  activeId: number | null
  onSelect: (sub: Subtitle) => void
}) {
  if (!videoDuration) return <div className="h-9" />

  return (
    <div className="relative h-9">
      {subtitles.map((sub) => {
        const left = (sub.start / videoDuration) * 100
        const width = Math.max(((sub.end - sub.start) / videoDuration) * 100, 0.4)
        const selected = sub.id === selectedId
        const active = !selected && sub.id === activeId
        return (
          <button
            key={sub.id}
            type="button"
            title={sub.text}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(sub)
            }}
            className={cn(
              'absolute top-[3px] bottom-[3px] rounded-sm border px-2 flex items-center text-[11px] font-medium whitespace-nowrap overflow-hidden text-ellipsis text-left transition-colors duration-150',
              selected
                ? 'bg-accent border-accent text-on-accent'
                : active
                  ? 'bg-elevated border-ring/60 text-paper'
                  : 'bg-elevated border-line/10 text-ink-2 hover:border-line/25 hover:text-paper'
            )}
            style={{ left: `${left}%`, width: `${width}%` }}
          >
            <span className="truncate">{sub.text}</span>
          </button>
        )
      })}
    </div>
  )
}
