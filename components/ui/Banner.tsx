import { AlertCircle, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

/** Inline notice. "notice" = accent tint (success/info), "danger" = error. */
export function Banner({
  variant = "notice",
  children,
  className,
}: {
  variant?: "notice" | "danger"
  children: React.ReactNode
  className?: string
}) {
  const Icon = variant === "danger" ? AlertCircle : CheckCircle2
  return (
    <div
      role={variant === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-center gap-2.5 px-3.5 py-3 rounded-lg border text-[13px] text-paper",
        variant === "danger"
          ? "bg-danger-surface border-danger/40"
          : "bg-accent/12 border-accent-ink/25",
        className
      )}
    >
      <Icon
        className={cn("size-4 flex-none", variant === "danger" ? "text-danger-ink" : "text-accent-ink")}
        strokeWidth={1.75}
      />
      <span className="flex-1">{children}</span>
    </div>
  )
}
