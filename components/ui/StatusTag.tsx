import { cn } from "@/lib/utils"

// Square-cornered label at a thumbnail's top-left. Sits on video, so the
// colors are fixed (they don't follow the theme) — except accent/danger fills.
const STATUS: Record<string, { label: string; className: string }> = {
  uploading: { label: "Uploading", className: "bg-[#0D0D0D] text-white" },
  transcribing: { label: "Transcribing…", className: "bg-[#0D0D0D] text-white" },
  rendering: { label: "Rendering…", className: "bg-[#0D0D0D] text-white" },
  ready: { label: "Ready to edit", className: "bg-white text-[#0D0D0D]" },
  completed: { label: "Rendered", className: "bg-accent text-white" },
  failed: { label: "Failed", className: "bg-danger text-white" },
}

export function statusLabel(status: string) {
  return STATUS[status]?.label ?? status
}

export function StatusTag({ status, className }: { status: string; className?: string }) {
  const s = STATUS[status] ?? { label: status, className: "bg-[#0D0D0D] text-white" }
  return (
    <span
      className={cn(
        "inline-block px-2 py-1 text-[11.5px] font-bold uppercase leading-none whitespace-nowrap",
        s.className,
        className
      )}
    >
      {s.label}
    </span>
  )
}
