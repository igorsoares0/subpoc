interface TrimHandlesProps {
  trim: { start: number; end: number } | null
  videoDuration: number
  containerWidth: number
  onDragStart: (handle: 'start' | 'end') => void
}

function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0s'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  if (mins === 0) return `${secs}s`
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function TrimHandles({
  trim,
  videoDuration,
  containerWidth,
  onDragStart
}: TrimHandlesProps) {
  if (!trim || containerWidth === 0 || videoDuration === 0) return null

  const startPercent = (trim.start / videoDuration) * 100
  const endPercent = (trim.end / videoDuration) * 100
  const widthPercent = endPercent - startPercent
  const trimmedDuration = trim.end - trim.start

  return (
    <>
      {/* Darken region BEFORE trim.start (descartada) */}
      {startPercent > 0 && (
        <div
          className="absolute top-0 h-full bg-black/65 z-10 pointer-events-none"
          style={{ left: 0, width: `${startPercent}%` }}
        />
      )}

      {/* Darken region AFTER trim.end (descartada) */}
      {endPercent < 100 && (
        <div
          className="absolute top-0 h-full bg-black/65 z-10 pointer-events-none"
          style={{ left: `${endPercent}%`, right: 0 }}
        />
      )}

      {/* Highlight border around kept region */}
      <div
        className="absolute top-0 h-full border-y-2 border-blue-400/80 z-10 pointer-events-none"
        style={{ left: `${startPercent}%`, width: `${widthPercent}%` }}
      />

      {/* Duration pill — floats above the kept region */}
      <div
        className="absolute -top-7 z-30 pointer-events-none"
        style={{
          left: `${startPercent + widthPercent / 2}%`,
          transform: 'translateX(-50%)'
        }}
      >
        <div className="bg-blue-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap tabular-nums">
          {formatDuration(trimmedDuration)}
        </div>
      </div>

      {/* Start Handle — visible 4px bar, 20px invisible hit area */}
      <div
        className="absolute top-0 h-full z-20 cursor-ew-resize group"
        style={{ left: `${startPercent}%`, width: '20px', transform: 'translateX(-10px)' }}
        onMouseDown={(e) => {
          e.stopPropagation()
          onDragStart('start')
        }}
      >
        {/* Visible bar */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-full bg-white group-hover:bg-blue-300 transition-colors rounded-sm" />
        {/* Grip dots */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-0.5 pointer-events-none">
          <div className="w-0.5 h-0.5 bg-black/60 rounded-full" />
          <div className="w-0.5 h-0.5 bg-black/60 rounded-full" />
          <div className="w-0.5 h-0.5 bg-black/60 rounded-full" />
        </div>
      </div>

      {/* End Handle */}
      <div
        className="absolute top-0 h-full z-20 cursor-ew-resize group"
        style={{ left: `${endPercent}%`, width: '20px', transform: 'translateX(-10px)' }}
        onMouseDown={(e) => {
          e.stopPropagation()
          onDragStart('end')
        }}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-full bg-white group-hover:bg-blue-300 transition-colors rounded-sm" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-0.5 pointer-events-none">
          <div className="w-0.5 h-0.5 bg-black/60 rounded-full" />
          <div className="w-0.5 h-0.5 bg-black/60 rounded-full" />
          <div className="w-0.5 h-0.5 bg-black/60 rounded-full" />
        </div>
      </div>
    </>
  )
}
