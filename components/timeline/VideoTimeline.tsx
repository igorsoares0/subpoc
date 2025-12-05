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
      <div className="bg-[#1b1a1d] rounded-[10px] p-3 h-[140px]">
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

          {/* Divider */}
          <div className="h-[1px] bg-zinc-700/50 mb-2" />

          {/* Time markers */}
          <div className="flex justify-between mb-1 px-1">
            {Array.from({ length: 12 }).map((_, i) => {
              const timeValue = (duration / 11) * i
              const mins = Math.floor(timeValue / 60)
              const secs = Math.floor(timeValue % 60)
              return (
                <span key={i} className="text-[9px] text-white/25 font-medium">
                  {mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`}
                </span>
              )
            })}
          </div>

          {/* Timeline indicator (white triangle + line) */}
          <div
            className="absolute top-[42px] -translate-x-1/2 z-10 pointer-events-none"
            style={{ left: `${(currentTime / duration) * 100}%` }}
          >
            <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-white shadow-lg" />
            <div className="w-[2px] h-[80px] bg-white mx-auto" />
          </div>

          {/* Filmstrip */}
          <div className="p-[3px] bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg">
            <div ref={filmstripContainerRef} className="bg-black rounded-md p-1 overflow-hidden relative timeline-filmstrip-container">
              <TimelineFilmstrip
                videoId={videoId}
                videoUrl={videoUrl}
                duration={videoDuration} // Use original duration for filmstrip
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
