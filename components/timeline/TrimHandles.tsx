interface TrimHandlesProps {
  trim: { start: number; end: number } | null
  videoDuration: number
  containerWidth: number
  onDragStart: (handle: 'start' | 'end') => void
}

/**
 * Trim overlay for the video lane: washes over the cut-out areas, a 3px paper
 * frame around the kept range and 14px paper pill handles on its edges.
 */
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

  const handle = (which: 'start' | 'end', percent: number) => (
    <div
      className="absolute top-0 h-full z-20 cursor-ew-resize group"
      style={{ left: `${percent}%`, width: '22px', transform: 'translateX(-11px)' }}
      title={which === 'start' ? 'Trim in  (I)' : 'Trim out  (O)'}
      onMouseDown={(e) => {
        e.stopPropagation()
        onDragStart(which)
      }}
    >
      {/* Visible 14px paper pill with two grip lines, 22px hit area */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3.5 h-full rounded-[7px] bg-paper flex items-center justify-center gap-0.5 group-hover:scale-x-110 transition-transform">
        <span className="w-[1.5px] h-4 bg-canvas" />
        <span className="w-[1.5px] h-4 bg-canvas" />
      </div>
    </div>
  )

  return (
    <>
      {/* Cut-out regions: light wash (scrim in dark) */}
      {startPercent > 0 && (
        <div
          className="absolute top-0 h-full bg-canvas/80 rounded-l-[10px] z-10 pointer-events-none"
          style={{ left: 0, width: `${startPercent}%` }}
        />
      )}
      {endPercent < 100 && (
        <div
          className="absolute top-0 h-full bg-canvas/80 rounded-r-[10px] z-10 pointer-events-none"
          style={{ left: `${endPercent}%`, right: 0 }}
        />
      )}

      {/* 3px paper frame around the kept range */}
      <div
        className="absolute top-0 h-full border-[3px] border-paper rounded-[10px] z-10 pointer-events-none"
        style={{ left: `${startPercent}%`, width: `${widthPercent}%` }}
      />

      {handle('start', startPercent)}
      {handle('end', endPercent)}
    </>
  )
}
