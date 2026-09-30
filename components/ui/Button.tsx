import { forwardRef } from "react"
import { cn } from "@/lib/utils"

type Variant = "primary" | "ghost" | "outline-accent" | "danger"
type Size = "lg" | "md" | "sm"

const VARIANTS: Record<Variant, string> = {
  // Text on lime is always #0E0E0C (on-accent), in both themes.
  primary:
    "bg-accent text-on-accent font-semibold hover:bg-accent-hover disabled:bg-track disabled:text-ink-4",
  ghost:
    "border border-line/14 text-paper font-medium hover:bg-elevated disabled:text-ink-4",
  "outline-accent":
    "border border-accent/50 text-accent-ink font-medium hover:bg-accent/8",
  danger: "bg-danger text-on-accent font-semibold hover:opacity-90",
}

const SIZES: Record<Size, string> = {
  lg: "h-11 px-[18px] rounded-lg text-[14px]",
  md: "h-10 px-[18px] rounded-lg text-[13.5px]",
  sm: "h-[34px] px-3 rounded-md text-[12.5px]",
}

/** Class string for buttons and for <Link>s that should look like buttons. */
export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed",
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
  size?: 26 | 30 | 32
  destructive?: boolean
  active?: boolean
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { size = 30, destructive, active, className, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={props.title}
      className={cn(
        "inline-flex items-center justify-center flex-none transition-colors duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
        size === 26 ? "size-[26px] rounded-sm" : size === 30 ? "size-[30px] rounded-[7px]" : "size-8 rounded-md",
        active ? "bg-elevated text-accent-ink" : "text-ink-2",
        destructive
          ? "hover:bg-danger/14 hover:text-danger-ink"
          : "hover:bg-elevated hover:text-paper",
        className
      )}
      {...props}
    />
  )
})
