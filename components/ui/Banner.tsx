import { AlertCircle, CheckCircle2, X, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type Variant = "danger" | "accent" | "ok"

const VARIANTS: Record<Variant, { className: string; icon: LucideIcon }> = {
  danger: { className: "bg-danger-surface text-danger-ink", icon: AlertCircle },
  accent: { className: "bg-accent-tint text-accent-ink", icon: CheckCircle2 },
  ok: { className: "bg-ok-surface text-ok", icon: CheckCircle2 },
}

/**
 * Inline notice. `children` is the bold lead sentence; `detail` is the
 * 500-weight ink-2 follow-up. `compact` is the form variant (auth pages).
 */
export function Banner({
  variant = "danger",
  icon,
  children,
  detail,
  action,
  onDismiss,
  compact,
  className,
}: {
  variant?: Variant
  /** Override the icon (pass a spinner element for "in progress"). */
  icon?: React.ReactNode
  children: React.ReactNode
  detail?: React.ReactNode
  action?: React.ReactNode
  onDismiss?: () => void
  compact?: boolean
  className?: string
}) {
  const v = VARIANTS[variant]
  const Icon = v.icon
  return (
    <div
      role={variant === "danger" ? "alert" : "status"}
      className={cn(
        "flex gap-3",
        compact
          ? "items-start gap-2.5 px-3.5 py-3 rounded-xl text-[13.5px] font-semibold leading-[1.4]"
          : "items-center min-h-12 py-2 pl-4 pr-2 rounded-2xl text-[14px] font-bold",
        v.className,
        className
      )}
    >
      <span className={cn("flex-none", compact && "mt-px")}>
        {icon ?? <Icon className={compact ? "size-4" : "size-[18px]"} strokeWidth={2} />}
      </span>
      <span className="flex-1 min-w-0">
        {children}
        {detail && <span className="font-medium text-ink-2"> {detail}</span>}
      </span>
      {action}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="size-[34px] flex-none rounded-full flex items-center justify-center text-ink-2 hover:bg-black/5"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

/** Small pill used as a Banner action ("See plans", "Try again", "Update payment"). */
export function BannerAction({
  tone = "inverse",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "inverse" | "danger" }) {
  return (
    <button
      type="button"
      className={cn(
        "h-[34px] px-4 rounded-full text-[13px] font-bold whitespace-nowrap flex-none cursor-pointer",
        tone === "danger" ? "bg-danger text-white hover:opacity-90" : "bg-paper text-canvas hover:opacity-90",
        className
      )}
      {...props}
    />
  )
}
