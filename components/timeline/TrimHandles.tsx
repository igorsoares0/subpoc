interface TrimHandlesProps {
  trim: { start: number; end: number } | null
  videoDuration: number
  containerWidth: number
  onDragStart: (handle: 'start' | 'end') => void
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

  const handle = (which: 'start' | 'end', percent: number) => (
    <div
      className="absolute top-0 h-full z-20 cursor-ew-resize group"
      style={{ left: `${percent}%`, width: '20px', transform: 'translateX(-10px)' }}
      title={which === 'start' ? 'Trim in  (I)' : 'Trim out  (O)'}
      onMouseDown={(e) => {
        e.stopPropagation()
        onDragStart(which)
      }}
    >
      {/* Visible 10px accent handle, 20px hit area */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2.5 h-full bg-accent rounded-[3px] flex flex-col items-center justify-center gap-[3px] group-hover:bg-accent-hover transition-colors">
        <span className="w-[2px] h-[2px] rounded-full bg-on-accent/60" />
        <span className="w-[2px] h-[2px] rounded-full bg-on-accent/60" />
        <span className="w-[2px] h-[2px] rounded-full bg-on-accent/60" />
      </div>
    </div>
  )

  return (
    <>
      {/* Discarded regions */}
      {startPercent > 0 && (
        <div
          className="absolute top-0 h-full bg-scrim/80 z-10 pointer-events-none"
          style={{ left: 0, width: `${startPercent}%` }}
        />
      )}
      {endPercent < 100 && (
        <div
          className="absolute top-0 h-full bg-scrim/80 z-10 pointer-events-none"
          style={{ left: `${endPercent}%`, right: 0 }}
        />
      )}

      {/* 2px accent frame around the kept region */}
      <div
        className="absolute top-0 h-full border-y-2 border-accent z-10 pointer-events-none"
        style={{ left: `${startPercent}%`, width: `${widthPercent}%` }}
      />

      {handle('start', startPercent)}
      {handle('end', endPercent)}
    </>
  )
}
