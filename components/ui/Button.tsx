import { forwardRef } from "react"
import { cn } from "@/lib/utils"

type Variant = "primary" | "secondary" | "inverse" | "danger" | "outline-accent" | "tint"
type Size = "xs" | "sm" | "md" | "lg" | "xl" | "2xl"

// Every button is a pill. Text on accent is white (on-accent) in both themes.
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-on-accent font-bold hover:bg-accent-hover disabled:bg-elevated disabled:text-ink-3",
  secondary:
    "bg-surface text-paper font-semibold hover:bg-hover disabled:bg-elevated disabled:text-ink-3",
  inverse:
    "bg-paper text-canvas font-bold hover:opacity-90 disabled:bg-elevated disabled:text-ink-3",
  danger: "bg-danger text-white font-bold hover:opacity-90 disabled:opacity-45",
  "outline-accent":
    "text-accent-ink font-bold shadow-[inset_0_0_0_1.5px_var(--c-accent)] hover:bg-accent-tint",
  tint: "bg-accent-tint text-accent-ink font-semibold hover:bg-accent/15",
}

const SIZES: Record<Size, string> = {
  xs: "h-[30px] px-3 text-[12.5px] gap-1.5",
  sm: "h-9 px-3.5 text-[13px] gap-1.5",
  md: "h-10 px-[18px] text-[13.5px] gap-2",
  lg: "h-11 px-[22px] text-[14px] gap-2",
  xl: "h-[46px] px-5 text-[14px] gap-2",
  "2xl": "h-[52px] px-[26px] text-[15px] gap-2",
}

/** Class string for buttons and for <Link>s that should look like buttons. */
export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center rounded-full whitespace-nowrap cursor-pointer disabled:cursor-not-allowed [&_svg]:flex-none",
    VARIANTS[variant],
    SIZES[size],
    className
  )
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, type = "button", ...props },
  ref
) {
  return <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...props} />
})

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Required: icon-only buttons are labelled by their title (include the shortcut). */
  title: string
  size?: number
  /** "plain" = transparent until hover; "surface" = filled round (header back/undo, close). */
  tone?: "plain" | "surface" | "inverse"
  destructive?: boolean
  active?: boolean
}

/** Round icon-only button. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { size = 30, tone = "plain", destructive, active, className, type = "button", style, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={props.title}
      style={{ width: size, height: size, ...style }}
      className={cn(
        "inline-flex items-center justify-center flex-none rounded-full cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
        tone === "surface" && "bg-surface text-paper hover:bg-hover",
        tone === "inverse" && "bg-paper text-canvas hover:opacity-90",
        tone === "plain" &&
          (active
            ? "bg-paper text-canvas"
            : destructive
              ? "text-ink-3 hover:bg-danger-surface hover:text-danger-ink"
              : "text-ink-2 hover:bg-surface hover:text-paper"),
        className
      )}
      {...props}
    />
  )
})
