'use client'

interface TimelineControlsProps {
  isPlaying: boolean
  currentTime: number
  duration: number
  isMuted: boolean
  trim: { start: number; end: number } | null
  onPlayPause: () => void
  onToggleMute: () => void
  onSetTrimStart: () => void
  onSetTrimEnd: () => void
  onClearTrim: () => void
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return '0:00'

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function TimelineControls({
  isPlaying,
  currentTime,
  duration,
  isMuted,
  trim,
  onPlayPause,
  onToggleMute,
  onSetTrimStart,
  onSetTrimEnd,
  onClearTrim
}: TimelineControlsProps) {
  return (
    <div className="flex items-center gap-3 mb-1.5 justify-center">
      <button
        onClick={onPlayPause}
        className="p-2 hover:bg-zinc-800 rounded transition-colors"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Trim controls */}
      <div className="flex items-center gap-1 ml-1 pl-1 border-l border-zinc-700">
        <button
          onClick={onSetTrimStart}
          className="p-1.5 hover:bg-zinc-800 rounded transition-colors"
          title="Set In Point (trim start at playhead)"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={onSetTrimEnd}
          className="p-1.5 hover:bg-zinc-800 rounded transition-colors"
          title="Set Out Point (trim end at playhead)"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>

        {trim && (
          <button
            onClick={onClearTrim}
            className="p-1.5 hover:bg-red-800 rounded transition-colors text-red-400"
            title="Clear trim"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="text-xs text-gray-400 font-mono">
        {formatTime(currentTime)} | {formatTime(duration)}
        {trim && <span className="text-purple-400 ml-1">(trimmed)</span>}
      </div>

      <button
        onClick={onToggleMute}
        className="p-2 hover:bg-zinc-800 rounded transition-colors"
        aria-label={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
            />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
            />
          </svg>
        )}
      </button>
    </div>
  )
}
