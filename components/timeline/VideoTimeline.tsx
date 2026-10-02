'use client'

import { useRef, useEffect, useState } from 'react'
import {
  Captions,
  FastForward,
  Film,
  Layers,
  Minus,
  Pause,
  Play,
  Plus,
  Rewind,
  Scissors,
  Split,
  Volume2,
  VolumeX,
  X,
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
  /** Shows the transcribing placeholder in the subtitles lane. */
  isTranscribing?: boolean
  /** Overlays lane: hook text and logo corner, spanning the kept range. */
  overlays?: { hook?: string | null; logo?: string | null }
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
  onTrimHandleDragStart,
  isTranscribing = false,
  overlays,
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

  // Ruler: labels ~9 per viewport width, minor ticks at half the label step.
  const step =
    TICK_STEPS.find((s) => videoDuration / s <= 9 * zoom) ?? TICK_STEPS[TICK_STEPS.length - 1]
  const minorStep = step >= 2 ? step / 2 : step
  const ticks: number[] = []
  const minorTicks: number[] = []
  if (videoDuration > 0) {
    for (let t = 0; t < videoDuration; t += step) ticks.push(t)
    for (let t = minorStep; t < videoDuration; t += minorStep) minorTicks.push(t)
  }

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

  // Kept range (for the overlays lane) in % of the full video.
  const keptLeft = trim && videoDuration > 0 ? (trim.start / videoDuration) * 100 : 0
  const keptRight = trim && videoDuration > 0 ? 100 - (trim.end / videoDuration) * 100 : 0
  const hasOverlays = !!(overlays?.hook || overlays?.logo)

  const iconButton =
    'size-[34px] flex items-center justify-center rounded-full text-ink-2 hover:text-paper hover:bg-surface cursor-pointer'
  const pill =
    'h-[34px] flex-none whitespace-nowrap flex items-center gap-[7px] rounded-full text-[12.5px] font-semibold cursor-pointer'

  return (
    <div className="h-full min-h-0 flex flex-col gap-2 px-5 pb-3.5 border-t border-line/12">
      {/* Transport */}
      <div className="h-[52px] flex-none grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onSplit}
            title="Split selected block at playhead"
            className={cn(pill, 'px-3.5 bg-surface text-paper hover:bg-hover')}
          >
            <Split className="size-[13px]" />
            Split at playhead
          </button>
          {trim ? (
            <span className={cn(pill, 'gap-2 pl-3.5 pr-1.5 bg-paper text-canvas cursor-default')}>
              <Scissors className="size-[13px]" />
              Trim
              <span className="font-mono font-normal opacity-75 tabular-nums">
                {formatTimecode(trim.start)} → {formatTimecode(trim.end)}
              </span>
              <button
                type="button"
                onClick={onClearTrim}
                title="Clear trim"
                aria-label="Clear trim"
                className="size-6 rounded-full bg-canvas/15 hover:bg-canvas/25 flex items-center justify-center cursor-pointer"
              >
                <X className="size-3" />
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={onToggleTrim}
              title="Trim video (drag the handles, or I / O)"
              className={cn(pill, 'px-3.5 bg-surface text-paper hover:bg-hover')}
            >
              <Scissors className="size-[13px]" />
              Trim
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="w-[120px] pr-2 text-right font-mono tabular-nums text-[15px] font-medium text-paper">
            {formatTimecode(currentTime)}
          </span>
          <button type="button" onClick={() => seekBy(-SEEK_STEP)} title="Back  ←" aria-label="Back" className={iconButton}>
            <Rewind className="size-4" />
          </button>
          <button
            type="button"
            onClick={onPlayPause}
            title={isPlaying ? 'Pause  Space' : 'Play  Space'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="size-[42px] rounded-full bg-paper text-canvas flex items-center justify-center hover:opacity-90 cursor-pointer"
          >
            {isPlaying ? <Pause className="size-4" fill="currentColor" /> : <Play className="size-4 ml-0.5" fill="currentColor" />}
          </button>
          <button type="button" onClick={() => seekBy(SEEK_STEP)} title="Forward  →" aria-label="Forward" className={iconButton}>
            <FastForward className="size-4" />
          </button>
          <span className="w-[84px] pl-2 font-mono tabular-nums text-[15px] font-medium text-ink-3">
            {formatTimecode(duration)}
          </span>
          <button
            type="button"
            onClick={onToggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            className={iconButton}
          >
            {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
        </div>

        <div className="flex items-center justify-end">
          <div className="flex items-center gap-0.5 h-[34px] px-1 rounded-full bg-surface font-mono text-[12px] text-paper">
            <button
              type="button"
              onClick={() => canZoomOut && setZoom(ZOOM_LEVELS[zoomIndex - 1])}
              disabled={!canZoomOut}
              title="Zoom out"
              aria-label="Zoom out"
              className="size-7 rounded-full flex items-center justify-center hover:bg-hover disabled:opacity-30 cursor-pointer disabled:cursor-default"
            >
              <Minus className="size-[13px]" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              title="Fit to width"
              className="min-w-[30px] text-center tabular-nums cursor-pointer"
            >
              {zoom === 1 ? 'Fit' : `${zoom}x`}
            </button>
            <button
              type="button"
              onClick={() => canZoomIn && setZoom(ZOOM_LEVELS[zoomIndex + 1])}
              disabled={!canZoomIn}
              title="Zoom in"
              aria-label="Zoom in"
              className="size-7 rounded-full flex items-center justify-center hover:bg-hover disabled:opacity-30 cursor-pointer disabled:cursor-default"
            >
              <Plus className="size-[13px]" />
            </button>
          </div>
        </div>
      </div>

      {/* Tracks */}
      <div className="flex-1 min-h-0 grid grid-cols-[104px_minmax(0,1fr)]">
        <div className="flex flex-col text-[12px] font-semibold text-ink-2">
          <span className="h-[22px] flex-none" />
          <span className="h-11 flex-none whitespace-nowrap flex items-center gap-[7px]">
            <Captions className="size-3.5" />
            Subtitles
          </span>
          <span className="h-[26px] mt-1.5 flex-none flex items-center gap-[7px]">
            <Layers className="size-3.5" />
            Overlays
          </span>
          <span className="h-[50px] mt-1.5 flex-none flex items-center gap-[7px]">
            <Film className="size-3.5" />
            Video
          </span>
        </div>

        {/* Scrollable, zoomable area — ruler, lanes, playhead and filmstrip
            share the same inner width so they stay aligned at any zoom. */}
        <div ref={scrollRef} className="overflow-x-auto overflow-y-hidden custom-scrollbar">
          <div className="relative" style={{ width: `${zoom * 100}%`, minWidth: '100%' }}>
            {/* Ruler — click to seek */}
            <div
              className="relative h-[22px] cursor-pointer font-mono text-[10.5px] text-ink-3"
              onClick={seekFromEvent}
              title="Click to seek"
            >
              {videoDuration > 0 && (
                <>
                  {minorTicks.map((t) => (
                    <span
                      key={`m${t}`}
                      className="absolute bottom-0 w-px h-1.5 bg-line/12"
                      style={{ left: `${(t / videoDuration) * 100}%` }}
                    />
                  ))}
                  {ticks.map((t) => (
                    <span
                      key={t}
                      className={cn('absolute top-0.5 whitespace-nowrap', t > 0 && '-translate-x-1/2')}
                      style={{ left: `${(t / videoDuration) * 100}%` }}
                    >
                      {tickLabel(t)}
                    </span>
                  ))}
                </>
              )}
            </div>

            <SubtitleChips
              subtitles={subtitles}
              videoDuration={videoDuration}
              zoom={zoom}
              selectedId={selectedSubtitleId}
              activeId={activeSubtitleId}
              isTranscribing={isTranscribing}
              onSelect={onSelectSubtitle}
            />

            {/* Overlays lane */}
            <div className="relative h-[26px] mt-1.5">
              {hasOverlays &&
                [
                  overlays?.hook ? `Hook · ${overlays.hook}` : null,
                  overlays?.logo ? `Logo · ${overlays.logo}` : null,
                ].map(
                  (label, i) =>
                    label && (
                      <span
                        key={i}
                        className="absolute h-3 rounded-md bg-elevated px-2 flex items-center text-[10px] font-bold text-ink-2 whitespace-nowrap overflow-hidden"
                        style={{ left: `${keptLeft}%`, right: `${keptRight}%`, top: i === 0 ? 0 : 14 }}
                      >
                        <span className="truncate">{label}</span>
                      </span>
                    )
                )}
            </div>

            {/* Video lane (filmstrip). Not clipped, so the trim handles can
                overhang the edges; the filmstrip itself is clipped below. */}
            <div ref={filmstripContainerRef} className="relative mt-1.5 h-[50px] timeline-filmstrip-container">
              <div className="absolute inset-0 rounded-[10px] overflow-hidden bg-[#18181D]">
                <TimelineFilmstrip
                  videoId={videoId}
                  videoUrl={videoUrl}
                  duration={videoDuration}
                  currentTime={currentTime}
                  onSeek={onSeek}
                  height={50}
                />
              </div>
              <TrimHandles
                trim={trim}
                videoDuration={videoDuration}
                containerWidth={containerWidth}
                onDragStart={onTrimHandleDragStart}
              />
            </div>

            {/* Playhead: accent line + timecode flag */}
            <div
              className="absolute top-0 -bottom-1 w-0.5 -ml-px bg-accent pointer-events-none z-30"
              style={{ left: `${playheadPct}%` }}
            >
              <span
                className="absolute -top-px h-5 px-[7px] rounded-full bg-accent text-white font-mono text-[10.5px] font-medium tabular-nums whitespace-nowrap flex items-center"
                style={{
                  left: '50%',
                  transform: `translateX(${playheadPct < 4 ? '-4px' : playheadPct > 96 ? 'calc(-100% + 4px)' : '-50%'})`,
                }}
              >
                {formatTimecode(currentTime)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
