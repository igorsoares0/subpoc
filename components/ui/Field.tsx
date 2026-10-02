import { forwardRef } from "react"
import { cn } from "@/lib/utils"

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** "lg" = 50px (forms), "md" = 44px (search), "sm" = 34px (panels) */
  inputSize?: "lg" | "md" | "sm"
  /** Shows the danger ring (validation error). */
  invalid?: boolean
}

/** Filled text input: surface fill, no border; focus = inset accent ring. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { inputSize = "lg", invalid, className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "w-full min-w-0 bg-surface text-paper border-none outline-none",
        inputSize === "lg" && "h-[50px] rounded-xl px-4 text-[15px]",
        inputSize === "md" && "h-11 rounded-full px-4 text-[14px]",
        inputSize === "sm" && "h-[34px] rounded-[10px] px-3 text-[13px]",
        invalid ? "edge-danger" : "focus:edge-accent",
        className
      )}
      {...props}
    />
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
      <span className="flex justify-between items-baseline text-[13px]">
        <span className="font-semibold text-paper">{label}</span>
        {aside}
      </span>
      {children}
    </label>
  )
}
