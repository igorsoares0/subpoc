'use client'

import { useRef, useEffect, useState } from 'react'
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
  onSetTrimStart: () => void
  onSetTrimEnd: () => void
  onClearTrim: () => void
  onTrimHandleDragStart: (handle: 'start' | 'end') => void
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
  onPlayPause,
  onToggleMute,
  onSeek,
  onSetTrimStart,
  onSetTrimEnd,
  onClearTrim,
  onTrimHandleDragStart
}: VideoTimelineProps) {
  const filmstripContainerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  // Measure container width for trim handles
  useEffect(() => {
    const updateWidth = () => {
      if (filmstripContainerRef.current) {
        setContainerWidth(filmstripContainerRef.current.offsetWidth)
      }
    }

    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  return (
    <div className="w-full flex-shrink-0">
      <div className="bg-[#16161a] rounded-xl p-3 h-[135px] border border-white/[0.04]">
        <div className="relative">
          {/* Controls */}
          <TimelineControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            isMuted={isMuted}
            trim={trim}
            onPlayPause={onPlayPause}
            onToggleMute={onToggleMute}
            onSetTrimStart={onSetTrimStart}
            onSetTrimEnd={onSetTrimEnd}
            onClearTrim={onClearTrim}
          />

          {/* Time markers */}
          <div className="flex justify-between mb-1 px-1">
            {Array.from({ length: 12 }).map((_, i) => {
              const timeValue = (duration / 11) * i
              const mins = Math.floor(timeValue / 60)
              const secs = Math.floor(timeValue % 60)
              return (
                <span key={i} className="text-[9px] text-white/20 font-mono">
                  {mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`}
                </span>
              )
            })}
          </div>

          {/* Timeline indicator (white triangle + line) */}
          <div
            className="absolute top-[38px] -translate-x-1/2 z-10 pointer-events-none"
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
  )
}
