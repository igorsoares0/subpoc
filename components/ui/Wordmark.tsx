import { cn } from "@/lib/utils"

/** "Supertitle." — serif wordmark with the lime (accent-ink) period. */
export function Wordmark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("font-serif leading-none text-paper whitespace-nowrap", className)}
      style={{ fontSize: size }}
    >
      Supertitle<span className="text-accent-ink">.</span>
    </span>
  )
}

/** Serif display heading; `em` renders as the italic second phrase. */
export function Display({
  children,
  em,
  after,
  size = 52,
  className,
  as: Tag = "h1",
}: {
  children?: React.ReactNode
  em?: React.ReactNode
  after?: React.ReactNode
  size?: number
  className?: string
  as?: "h1" | "h2" | "h3" | "span"
}) {
  return (
    <Tag
      className={cn("font-serif font-normal text-paper tracking-[-0.01em]", className)}
      style={{ fontSize: size, lineHeight: size >= 44 ? 1.02 : 1.05 }}
    >
      {children}
      {em && <em className="italic">{em}</em>}
      {after}
    </Tag>
  )
}
