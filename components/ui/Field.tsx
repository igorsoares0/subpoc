import { forwardRef } from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  icon?: LucideIcon
  /** "lg" = 44px (auth), "md" = 40px (dashboard search), "sm" = 34px (panels) */
  inputSize?: "lg" | "md" | "sm"
  wrapperClassName?: string
}

/** Text input with an optional leading icon. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { icon: Icon, inputSize = "lg", wrapperClassName, className, ...props },
  ref
) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 bg-surface border border-line/10 transition-colors duration-150 focus-within:border-line/25",
        inputSize === "lg" && "h-11 rounded-lg px-3.5",
        inputSize === "md" && "h-10 rounded-lg px-3",
        inputSize === "sm" && "h-[34px] rounded-[7px] px-2.5",
        wrapperClassName
      )}
    >
      {Icon && <Icon className="size-[15px] text-ink-4 flex-none" strokeWidth={1.75} />}
      <input
        ref={ref}
        className={cn(
          "flex-1 min-w-0 bg-transparent border-none outline-none text-paper",
          inputSize === "sm" ? "text-[13px]" : inputSize === "md" ? "text-[13.5px]" : "text-[14px]",
          className
        )}
        {...props}
      />
    </div>
  )
})

/** Label above a control. `aside` renders on the right (e.g. "Forgot password?"). */
export function Field({
  label,
  aside,
  children,
}: {
  label: string
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex justify-between text-[12.5px] font-medium text-ink-2">
        {label}
        {aside}
      </span>
      {children}
    </label>
  )
}
