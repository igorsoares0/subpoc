"use client"

import { useEffect, useRef, useState } from "react"
import { Check, LogOut, Monitor, Moon, Sun } from "lucide-react"
import { signOut } from "next-auth/react"
import { getThemePref, setThemePref, watchSystemTheme, type ThemePref } from "@/lib/theme"
import { cn } from "@/lib/utils"

const OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
]

/**
 * User menu: theme switch (Light / Dark / System) + sign out.
 * `trigger` renders the button content; `placement` controls where the menu opens.
 */
export function UserMenu({
  trigger,
  triggerClassName,
  triggerTitle = "Account & theme",
  placement = "bottom-end",
  email,
}: {
  trigger: React.ReactNode
  triggerClassName?: string
  triggerTitle?: string
  placement?: "bottom-end" | "top-end" | "top-start"
  email?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [pref, setPref] = useState<ThemePref>("light")
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    watchSystemTheme()
  }, [])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title={triggerTitle}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          // Read the saved preference when opening (localStorage isn't available during SSR).
          if (!open) setPref(getThemePref())
          setOpen((o) => !o)
        }}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-50 w-56 p-1.5 rounded-2xl bg-canvas shadow-[var(--shadow-menu)]",
            placement === "bottom-end" && "right-0 top-full mt-2",
            placement === "top-end" && "right-0 bottom-full mb-2",
            placement === "top-start" && "left-0 bottom-full mb-2"
          )}
        >
          {email && <div className="px-2.5 pt-1.5 pb-2 font-mono text-[12px] text-ink-3 truncate">{email}</div>}
          <div className="px-2.5 pt-1 pb-1.5 text-[11.5px] font-semibold text-ink-3">Theme</div>
          {OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={pref === value}
              onClick={() => {
                setThemePref(value)
                setPref(value)
              }}
              className="w-full flex items-center gap-2.5 h-[38px] px-2.5 rounded-[9px] text-[13.5px] font-semibold text-paper hover:bg-surface cursor-pointer"
            >
              <Icon className="size-[15px] text-ink-3" strokeWidth={2} />
              <span className="flex-1 text-left">{label}</span>
              {pref === value && <Check className="size-[15px] text-accent-ink" strokeWidth={2} />}
            </button>
          ))}
          <div className="my-1 mx-1.5 h-px bg-line/12" />
          <button
            type="button"
            role="menuitem"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center gap-2.5 h-[38px] px-2.5 rounded-[9px] text-[13.5px] font-semibold text-paper hover:bg-surface cursor-pointer"
          >
            <LogOut className="size-[15px] text-ink-3" strokeWidth={2} />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

/** Initials avatar (inverse: paper fill, canvas text). */
export function Avatar({ name, email, size = 36 }: { name?: string | null; email?: string | null; size?: number }) {
  const source = (name || email || "?").trim()
  const parts = source.split(/\s+/)
  const initials = (parts.length > 1 ? parts[0][0] + parts[1][0] : source[0]).toUpperCase()
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-paper text-canvas font-bold flex-none"
      style={{ width: size, height: size, fontSize: Math.round(size / 3) }}
    >
      {initials}
    </span>
  )
}
