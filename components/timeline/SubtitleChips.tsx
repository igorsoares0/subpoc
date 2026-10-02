'use client'

import type { Subtitle } from '@/lib/subtitle-track'
import { cn } from '@/lib/utils'

// Short gap label between blocks: ".48" under a second, "1.2s" above.
function gapLabel(gap: number) {
  if (gap < 1) return `.${String(Math.round(gap * 100)).padStart(2, '0')}`
  return `${gap.toFixed(1)}s`
}

/**
 * Subtitles lane (absolute video time). Clicking a block seeks to its start and
 * selects it. The selected block is the accent fill with word-boundary ticks;
 * gaps between blocks show their duration.
 */
export function SubtitleChips({
  subtitles,
  videoDuration,
  zoom,
  selectedId,
  activeId,
  isTranscribing,
  onSelect,
}: {
  subtitles: Subtitle[]
  videoDuration: number
  /** Timeline zoom — gap labels need enough room to show. */
  zoom: number
  selectedId: number | null
  activeId: number | null
  isTranscribing: boolean
  onSelect: (sub: Subtitle) => void
}) {
  if (subtitles.length === 0) {
    return (
      <div className="relative h-11">
        <div className="absolute inset-x-0 inset-y-1 rounded-[10px] edge-line bg-hatch overflow-hidden flex items-center">
          {isTranscribing ? (
            <>
              <span className="absolute inset-y-0 left-0 w-1/3 bg-accent-tint animate-[indeterminate_1.8s_ease-in-out_infinite]" />
              <span className="relative px-3.5 text-[12.5px] font-bold text-accent-ink">Transcribing…</span>
            </>
          ) : (
            <span className="w-full text-center text-[12.5px] font-semibold text-ink-3">
              Subtitles appear here after transcription
            </span>
          )}
        </div>
      </div>
    )
  }

  if (!videoDuration) return <div className="h-11" />

  const pct = (t: number) => (t / videoDuration) * 100

  return (
    <div className="relative h-11">
      {subtitles.map((sub, idx) => {
        const left = pct(sub.start)
        const width = Math.max(pct(sub.end - sub.start), 0.4)
        const selected = sub.id === selectedId
        const active = !selected && sub.id === activeId
        const next = subtitles[idx + 1]
        const gap = next ? next.start - sub.end : 0
        const showGap = gap >= 0.2 && pct(gap) * zoom >= 2.2

        // Word-boundary ticks on the selected block (1px white @ 28%).
        const span = sub.end - sub.start
        const ticks =
          selected && sub.words && sub.words.length > 1 && span > 0
            ? sub.words.slice(1).map((w) => Math.max(0, Math.min(100, ((w.start - sub.start) / span) * 100)))
            : []

        return (
          <div key={sub.id}>
            <button
              type="button"
              title={sub.text}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(sub)
              }}
              className={cn(
                'absolute top-1 bottom-1 rounded-[10px] flex items-center text-[12.5px] whitespace-nowrap overflow-hidden text-left cursor-pointer',
                selected
                  ? 'bg-accent text-white font-bold px-3.5'
                  : cn(
                      'bg-surface text-paper font-semibold px-2.5 hover:bg-hover',
                      active ? 'shadow-[inset_0_0_0_1.5px_var(--c-accent)]' : 'edge-line-1'
                    )
              )}
              style={{
                left: `${left}%`,
                width: `${width}%`,
                ...(ticks.length > 0 && {
                  backgroundImage: ticks.map(() => 'linear-gradient(rgba(255,255,255,.28), rgba(255,255,255,.28))').join(','),
                  backgroundSize: '1px 100%',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: ticks.map((t) => `${t}% 0`).join(','),
                }),
              }}
            >
              <span className="truncate relative">{sub.text}</span>
              {selected && (
                <>
                  <span className="absolute left-[3px] top-1.5 bottom-1.5 w-1.5 rounded-[3px] bg-white" />
                  <span className="absolute right-[3px] top-1.5 bottom-1.5 w-1.5 rounded-[3px] bg-white" />
                </>
              )}
            </button>
            {showGap && (
              <span
                className="absolute top-1 bottom-1 flex items-center justify-center font-mono text-[9.5px] text-ink-3 pointer-events-none"
                style={{ left: `${pct(sub.end)}%`, width: `${pct(gap)}%` }}
              >
                {gapLabel(gap)}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
