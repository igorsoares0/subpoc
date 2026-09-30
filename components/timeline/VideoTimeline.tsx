'use client'

import { useRef, useEffect, useState } from 'react'
import {
  Captions,
  FastForward,
  Film,
  Pause,
  Play,
  Rewind,
  Scissors,
  Split,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { Subtitle } from '@/lib/subtitle-track'
import { formatTimecode } from '@/components/editor/types'
import { cn } from '@/lib/utils'
import { TimelineFilmstrip } from './TimelineFilmstrip'
import { TrimHandles } from './TrimHandles'
import { SubtitleChips } from './SubtitleChips'

interface VideoTimelineProps {
  videoId: string
  videoUrl: string
  /** Output duration (trimmed) — for the time readout. */
  duration: number
  /** Output time (relative to trim start) — for the time readout. */
  currentTime: number
  isPlaying: boolean
  isMuted: boolean
  trim: { start: number; end: number } | null
  videoDuration: number // Original duration (not trimmed)
  subtitles: Subtitle[]
  selectedSubtitleId: number | null
  activeSubtitleId: number | null
  onSelectSubtitle: (sub: Subtitle) => void
  onPlayPause: () => void
  onToggleMute: () => void
  /** Absolute video time. */
  onSeek: (time: number) => void
  onToggleTrim: () => void
  onClearTrim: () => void
  onSplit: () => void
  onTrimHandleDragStart: (handle: 'start' | 'end') => void
}

// Discrete zoom steps — keeps the horizontal scroll predictable.
const ZOOM_LEVELS = [1, 2, 3, 4, 6]
const TICK_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600]
const SEEK_STEP = 5 // matches the ←/→ shortcut

function tickLabel(t: number) {
  if (t < 60) return `${t}s`
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`
}

export function VideoTimeline({
  videoId,
  videoUrl,
  duration,
  currentTime,
  isPlaying,
  isMuted,
  trim,
  videoDuration,
  subtitles,
  selectedSubtitleId,
  activeSubtitleId,
  onSelectSubtitle,
  onPlayPause,
  onToggleMute,
  onSeek,
  onToggleTrim,
  onClearTrim,
  onSplit,
  onTrimHandleDragStart
}: VideoTimelineProps) {
  const filmstripContainerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [zoom, setZoom] = useState(1)

  // Playhead / tracks are in absolute video time.
  const absoluteTime = trim ? currentTime + trim.start : currentTime
  const playheadPct = videoDuration > 0 ? Math.min(100, (absoluteTime / videoDuration) * 100) : 0

  // Measure container width for trim handles (re-measure when zoom changes,
  // since the inner content grows wider than the viewport).
  useEffect(() => {
    const updateWidth = () => {
      if (filmstripContainerRef.current) {
        setContainerWidth(filmstripContainerRef.current.offsetWidth)
      }
    }

    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [zoom])

  // Keep the playhead in view while playing when zoomed in.
  useEffect(() => {
    if (zoom <= 1 || !scrollRef.current || videoDuration <= 0) return
    const el = scrollRef.current
    const playheadX = (absoluteTime / videoDuration) * el.scrollWidth
    const margin = el.clientWidth * 0.15
    if (playheadX < el.scrollLeft + margin) {
      el.scrollLeft = Math.max(0, playheadX - margin)
    } else if (playheadX > el.scrollLeft + el.clientWidth - margin) {
      el.scrollLeft = playheadX - el.clientWidth + margin
    }
  }, [absoluteTime, videoDuration, zoom])

  const zoomIndex = ZOOM_LEVELS.indexOf(zoom)
  const canZoomOut = zoomIndex > 0
  const canZoomIn = zoomIndex < ZOOM_LEVELS.length - 1

  // Ruler ticks: ~9 per viewport width.
  const step =
    TICK_STEPS.find((s) => videoDuration / s <= 9 * zoom) ?? TICK_STEPS[TICK_STEPS.length - 1]
  const ticks: number[] = []
  if (videoDuration > 0) for (let t = 0; t < videoDuration; t += step) ticks.push(t)

  const seekFromEvent = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    onSeek(ratio * videoDuration)
  }

  const seekBy = (delta: number) => {
    const lower = trim ? trim.start : 0
    const upper = trim ? trim.end : videoDuration
    onSeek(Math.max(lower, Math.min(absoluteTime + delta, upper)))
  }

  const toolButton =
    'h-7 px-2.5 rounded-[7px] flex items-center gap-1.5 text-[12px] font-medium transition-colors duration-150'

  return (
    <div className="h-[184px] flex-none border-t border-line/8 flex flex-col">
      {/* Toolbar */}
      <div className="h-12 flex-none grid grid-cols-[1fr_auto_1fr] items-center px-4 border-b border-line/6">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleTrim}
            aria-pressed={!!trim}
            title={trim ? 'Remove trim' : 'Trim video (drag the handles, or I / O)'}
            className={cn(
              toolButton,
              trim ? 'bg-elevated text-accent-ink' : 'text-ink-2 hover:bg-elevated hover:text-paper'
            )}
          >
            <Scissors className="size-3.5" />
            Trim video
          </button>
          <button
            type="button"
            onClick={onSplit}
            title="Split selected block at playhead"
            className={cn(toolButton, 'text-ink-2 hover:bg-elevated hover:text-paper')}
          >
            <Split className="size-3.5" />
            Split
          </button>
        </div>

        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => seekBy(-SEEK_STEP)}
            title="Back  ←"
            aria-label="Back"
            className="size-7 flex items-center justify-center rounded-[7px] text-ink-2 hover:text-paper hover:bg-elevated"
          >
            <Rewind className="size-[15px]" />
          </button>
          <button
            type="button"
            onClick={onPlayPause}
            title={isPlaying ? 'Pause  Space' : 'Play  Space'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="size-9 rounded-full bg-accent hover:bg-accent-hover text-on-accent flex items-center justify-center transition-colors duration-150"
          >
            {isPlaying ? <Pause className="size-4" fill="currentColor" /> : <Play className="size-4 ml-0.5" fill="currentColor" />}
          </button>
          <button
            type="button"
            onClick={() => seekBy(SEEK_STEP)}
            title="Forward  →"
            aria-label="Forward"
            className="size-7 flex items-center justify-center rounded-[7px] text-ink-2 hover:text-paper hover:bg-elevated"
          >
            <FastForward className="size-[15px]" />
          </button>
          <span className="font-mono tabular-nums text-[13px] font-medium text-paper whitespace-nowrap min-w-[150px]">
            {formatTimecode(currentTime)}
            <span className="text-ink-4"> / {formatTimecode(duration)}</span>
          </span>
        </div>

        <div className="flex items-center justify-end gap-2">
          {trim && (
            <>
              <span className="font-mono tabular-nums text-[12px] text-ink-3 whitespace-nowrap">
                trim {formatTimecode(trim.start)} → {formatTimecode(trim.end)}
              </span>
              <button
                type="button"
                onClick={onClearTrim}
                className="h-7 px-2.5 rounded-[7px] border border-line/14 flex items-center gap-1.5 text-[12px] font-medium text-paper hover:bg-elevated whitespace-nowrap"
              >
                <X className="size-3.5" />
                Clear trim
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onToggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            className="size-7 flex items-center justify-center rounded-[7px] text-ink-2 hover:text-paper hover:bg-elevated"
          >
            {isMuted ? <VolumeX className="size-[15px]" /> : <Volume2 className="size-[15px]" />}
          </button>
          <div className="flex items-center rounded-[7px] border border-line/10">
            <button
              type="button"
              onClick={() => canZoomOut && setZoom(ZOOM_LEVELS[zoomIndex - 1])}
              disabled={!canZoomOut}
              title="Zoom out"
              aria-label="Zoom out"
              className="size-7 flex items-center justify-center text-ink-2 hover:text-paper disabled:opacity-30"
            >
              <ZoomOut className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              title="Reset zoom"
              className="min-w-[26px] text-center font-mono tabular-nums text-[10.5px] text-ink-3 hover:text-paper"
            >
              {zoom}x
            </button>
            <button
              type="button"
              onClick={() => canZoomIn && setZoom(ZOOM_LEVELS[zoomIndex + 1])}
              disabled={!canZoomIn}
              title="Zoom in"
              aria-label="Zoom in"
              className="size-7 flex items-center justify-center text-ink-2 hover:text-paper disabled:opacity-30"
            >
              <ZoomIn className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tracks */}
      <div className="flex-1 min-h-0 grid grid-cols-[88px_minmax(0,1fr)] pt-2 pr-4 pb-3">
        <div className="flex flex-col pl-4 text-[11px] text-ink-3">
          <span className="h-[22px]" />
          <span className="h-9 flex items-center gap-1.5">
            <Captions className="size-[13px]" />
            Subtitles
          </span>
          <span className="h-11 mt-1.5 flex items-center gap-1.5">
            <Film className="size-[13px]" />
            Video
          </span>
        </div>

        {/* Scrollable, zoomable area — ruler, chips, playhead and filmstrip
            share the same inner width so they stay aligned at any zoom. */}
        <div ref={scrollRef} className="overflow-x-auto overflow-y-hidden custom-scrollbar">
          <div className="relative" style={{ width: `${zoom * 100}%`, minWidth: '100%' }}>
            {/* Ruler — click to seek */}
            <div
              className="relative h-[22px] cursor-pointer font-mono text-[10px] text-ink-4"
              onClick={seekFromEvent}
              title="Click to seek"
            >
              {videoDuration > 0 &&
                ticks.map((t) => (
                  <span
                    key={t}
                    className="absolute top-0.5 h-3 leading-3 pl-1 border-l border-line/12 whitespace-nowrap"
                    style={{ left: `${(t / videoDuration) * 100}%` }}
                  >
                    {tickLabel(t)}
                  </span>
                ))}
            </div>

            <SubtitleChips
              subtitles={subtitles}
              videoDuration={videoDuration}
              selectedId={selectedSubtitleId}
              activeId={activeSubtitleId}
              onSelect={onSelectSubtitle}
            />

            {/* Filmstrip */}
            <div
              ref={filmstripContainerRef}
              className="relative mt-1.5 h-11 rounded-sm overflow-hidden border border-line/10 bg-[#1D1D1A] timeline-filmstrip-container"
            >
              <TimelineFilmstrip
                videoId={videoId}
                videoUrl={videoUrl}
                duration={videoDuration}
                currentTime={currentTime}
                onSeek={onSeek}
                height={42}
              />
              <TrimHandles
                trim={trim}
                videoDuration={videoDuration}
                containerWidth={containerWidth}
                onDragStart={onTrimHandleDragStart}
              />
            </div>

            {/* Playhead */}
            <div
              className="absolute top-0 -bottom-1 w-[2px] bg-ring -translate-x-1/2 pointer-events-none z-30"
              style={{ left: `${playheadPct}%` }}
            >
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3.5 bg-ring rounded-[3px_3px_6px_6px]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
