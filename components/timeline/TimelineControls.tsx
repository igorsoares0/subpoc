'use client'

interface TimelineControlsProps {
  isPlaying: boolean
  currentTime: number
  duration: number
  isMuted: boolean
  trim: { start: number; end: number } | null
  onPlayPause: () => void
  onToggleMute: () => void
  onToggleTrim: () => void
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
  onToggleTrim
}: TimelineControlsProps) {
  const trimActive = trim !== null

  return (
    <div className="flex items-center gap-2 mb-1.5 justify-center">
      <button
        onClick={onPlayPause}
        className="p-1.5 hover:bg-white/[0.06] rounded-md transition-colors"
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

      <div className="w-px h-4 bg-white/[0.08]" />

      {/* Trim toggle — single button that creates or clears a trim */}
      <button
        onClick={onToggleTrim}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors text-[11px] font-medium ${
          trimActive
            ? 'bg-blue-500/15 text-blue-300 hover:bg-blue-500/25'
            : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
        }`}
        title={trimActive ? 'Remover corte' : 'Cortar vídeo (arraste as alças nas pontas)'}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
        </svg>
        <span>{trimActive ? 'Remover corte' : 'Cortar'}</span>
      </button>

      <div className="w-px h-4 bg-white/[0.08]" />

      <div className="text-[11px] text-zinc-500 font-mono tabular-nums min-w-[100px] text-center">
        <span className="text-zinc-300">{formatTime(currentTime)}</span>
        <span className="mx-1">/</span>
        <span>{formatTime(duration)}</span>
      </div>

      <div className="w-px h-4 bg-white/[0.08]" />

      <button
        onClick={onToggleMute}
        className="p-1.5 hover:bg-white/[0.06] rounded-md transition-colors text-zinc-400 hover:text-white"
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
