interface TrimHandlesProps {
  trim: { start: number; end: number } | null
  videoDuration: number // Original duration
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

  return (
    <>
      {/* Start Handle */}
      <div
        className="absolute top-0 h-full w-1 bg-white cursor-ew-resize z-20 hover:bg-gray-300 transition-colors group"
        style={{ left: `${startPercent}%` }}
        onMouseDown={(e) => {
          e.stopPropagation()
          onDragStart('start')
        }}
      >
        {/* Visual indicator - vertical bar with triangle pointing right */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-[8px] border-t-[6px] border-b-[6px] border-l-white border-t-transparent border-b-transparent group-hover:border-l-gray-300 transition-colors" />

        {/* Label */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-semibold">
          In
        </div>
      </div>

      {/* End Handle */}
      <div
        className="absolute top-0 h-full w-1 bg-white cursor-ew-resize z-20 hover:bg-gray-300 transition-colors group"
        style={{ left: `${endPercent}%` }}
        onMouseDown={(e) => {
          e.stopPropagation()
          onDragStart('end')
        }}
      >
        {/* Visual indicator - vertical bar with triangle pointing left */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0 h-0 border-r-[8px] border-t-[6px] border-b-[6px] border-r-white border-t-transparent border-b-transparent group-hover:border-r-gray-300 transition-colors" />

        {/* Label */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-semibold">
          Out
        </div>
      </div>
    </>
  )
}
