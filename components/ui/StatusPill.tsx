import { cn } from "@/lib/utils"

const STATUS: Record<string, { label: string; className: string; dot: string }> = {
  uploading: { label: "Uploading", className: "bg-elevated text-paper", dot: "bg-accent" },
  transcribing: { label: "Transcribing", className: "bg-elevated text-paper", dot: "bg-accent" },
  rendering: { label: "Rendering", className: "bg-elevated text-paper", dot: "bg-accent" },
  ready: { label: "Ready to edit", className: "bg-paper text-canvas", dot: "bg-canvas" },
  completed: { label: "Rendered", className: "bg-accent text-on-accent", dot: "bg-on-accent" },
  failed: { label: "Failed", className: "bg-danger-surface text-danger-text", dot: "bg-danger" },
}

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const s = STATUS[status] ?? { label: status, className: "bg-elevated text-paper", dot: "bg-ink-4" }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 h-6 px-[9px] rounded-full text-[11.5px] font-medium whitespace-nowrap shadow-[0_2px_8px_rgba(0,0,0,0.2)]",
        s.className,
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  )
}
