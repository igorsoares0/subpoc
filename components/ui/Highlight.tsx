import { cn } from "@/lib/utils"

const TONES = {
  accent: "bg-accent text-on-accent",
  danger: "bg-danger text-white",
  // Keyword yellow: text on it is always near-black, in both themes.
  yellow: "bg-highlight text-[#0D0D0D]",
  // Auth panel (accent background): white block, accent text.
  inverse: "bg-white text-accent",
} as const

/**
 * The "Caption" highlight block: one key word on a solid rectangle, like a
 * burned-in subtitle keyword. Use on exactly one word per heading.
 */
export function Highlight({
  tone = "accent",
  className,
  children,
}: {
  tone?: keyof typeof TONES
  className?: string
  children: React.ReactNode
}) {
  return (
    <span className={cn("px-[0.15em] [box-decoration-break:clone]", TONES[tone], className)}>
      {children}
    </span>
  )
}
