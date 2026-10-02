import { cn } from "@/lib/utils"

/** "super" + "title" on an accent block. `inverse` = white block / accent text (auth panel). */
export function Wordmark({
  size = 22,
  inverse,
  className,
}: {
  size?: number
  inverse?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        "font-black stretch-wide tracking-[-0.02em] leading-none whitespace-nowrap",
        inverse ? "text-white" : "text-paper",
        className
      )}
      style={{ fontSize: size }}
    >
      super
      <span
        className={inverse ? "bg-white text-accent" : "bg-accent text-on-accent"}
        style={{ padding: `0 ${size >= 26 ? 5 : 4}px` }}
      >
        title
      </span>
    </span>
  )
}
