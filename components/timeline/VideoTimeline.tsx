'use client'

import { useRef, useEffect, useState } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { TimelineControls } from './TimelineControls'
import { TimelineFilmstrip } from './TimelineFilmstrip'
import { TrimHandles } from './TrimHandles'

interface VideoTimelineProps {
  videoId: string
  videoUrl: string
  duration: number
  currentTime: number
  isPlaying: boolean
  isMuted: boolean
  trim: { start: number; end: number } | null
  videoDuration: number // Original duration (not trimmed)
  onPlayPause: () => void
  onToggleMute: () => void
  onSeek: (time: number) => void
  onToggleTrim: () => void
  onTrimHandleDragStart: (handle: 'start' | 'end') => void
}

// Discrete zoom steps — keeps the horizontal scroll predictable.
const ZOOM_LEVELS = [1, 2, 3, 4, 6]

export function VideoTimeline({
  videoId,
  videoUrl,
  duration,
  currentTime,
  isPlaying,
  isMuted,
  trim,
  videoDuration,
  onPlayPause,
  onToggleMute,
  onSeek,
  onToggleTrim,
  onTrimHandleDragStart
}: VideoTimelineProps) {
  const filmstripContainerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [zoom, setZoom] = useState(1)

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
    if (zoom <= 1 || !scrollRef.current || duration <= 0) return
    const el = scrollRef.current
    const playheadX = (currentTime / duration) * el.scrollWidth
    const margin = el.clientWidth * 0.15
    if (playheadX < el.scrollLeft + margin) {
      el.scrollLeft = Math.max(0, playheadX - margin)
    } else if (playheadX > el.scrollLeft + el.clientWidth - margin) {
      el.scrollLeft = playheadX - el.clientWidth + margin
    }
  }, [currentTime, duration, zoom])

  const zoomIndex = ZOOM_LEVELS.indexOf(zoom)
  const canZoomOut = zoomIndex > 0
  const canZoomIn = zoomIndex < ZOOM_LEVELS.length - 1
  const zoomOut = () => canZoomOut && setZoom(ZOOM_LEVELS[zoomIndex - 1])
  const zoomIn = () => canZoomIn && setZoom(ZOOM_LEVELS[zoomIndex + 1])

  return (
    <div className="w-full flex-shrink-0">
      <div className="bg-surface rounded-xl p-3 h-[140px] border border-white/[0.08]">
        {/* Controls row — play/trim/time/mute centered, zoom cluster on the right */}
        <div className="relative">
          <TimelineControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            isMuted={isMuted}
            trim={trim}
            onPlayPause={onPlayPause}
            onToggleMute={onToggleMute}
            onToggleTrim={onToggleTrim}
          />

          <div className="absolute right-0 top-0 flex items-center gap-0.5 bg-white/[0.04] rounded-md p-0.5">
            <button
              onClick={zoomOut}
              disabled={!canZoomOut}
              className="p-1 rounded text-zinc-400 hover:bg-white/[0.08] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              title="Zoom out"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="px-1 min-w-[28px] text-center text-[10px] font-mono tabular-nums text-zinc-400 hover:text-white transition-colors"
              title="Reset zoom"
            >
              {zoom}x
            </button>
            <button
              onClick={zoomIn}
              disabled={!canZoomIn}
              className="p-1 rounded text-zinc-400 hover:bg-white/[0.08] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              title="Zoom in"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Scrollable, zoomable area — markers, playhead and filmstrip share the
            same inner width so they stay aligned at any zoom level. All inner
            positioning is percentage-based, so seek/trim math is unaffected. */}
        <div ref={scrollRef} className="overflow-x-auto overflow-y-hidden custom-scrollbar">
          <div className="relative" style={{ width: `${zoom * 100}%`, minWidth: '100%' }}>
            {/* Time markers */}
            <div className="flex justify-between mb-1 px-1">
              {Array.from({ length: 12 }).map((_, i) => {
                const timeValue = (duration / 11) * i
                const mins = Math.floor(timeValue / 60)
                const secs = Math.floor(timeValue % 60)
                return (
                  <span key={i} className="text-[9px] text-white/40 font-mono">
                    {mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`}
                  </span>
                )
              })}
            </div>

            {/* Timeline indicator (triangle + line) */}
            <div
              className="absolute top-0 -translate-x-1/2 z-10 pointer-events-none"
              style={{ left: `${(currentTime / duration) * 100}%` }}
            >
              <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[10px] border-l-transparent border-r-transparent border-t-blue-400 shadow-lg" />
              <div className="w-[2px] h-[75px] bg-blue-400/80 mx-auto" />
            </div>

            {/* Filmstrip */}
            <div className="p-[2px] bg-gradient-to-r from-blue-600/60 to-blue-500/40 rounded-lg">
              <div ref={filmstripContainerRef} className="bg-black rounded-[5px] p-0.5 overflow-hidden relative timeline-filmstrip-container">
                <TimelineFilmstrip
                  videoId={videoId}
                  videoUrl={videoUrl}
                  duration={videoDuration}
                  currentTime={currentTime}
                  onSeek={onSeek}
                />

                {/* Trim Handles */}
                <TrimHandles
                  trim={trim}
                  videoDuration={videoDuration}
                  containerWidth={containerWidth}
                  onDragStart={onTrimHandleDragStart}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
