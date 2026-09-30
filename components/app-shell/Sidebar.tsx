"use client"

import Link from "next/link"
import { signOut } from "next-auth/react"
import { CreditCard, LayoutGrid, LogOut, Sparkles, SunMoon } from "lucide-react"
import { Wordmark } from "@/components/ui/Wordmark"
import { buttonClass, IconButton } from "@/components/ui/Button"
import { UsageBar } from "@/components/ui/controls"
import { Avatar, UserMenu } from "@/components/ui/ThemeMenu"
import { cn } from "@/lib/utils"

export interface SidebarPlan {
  id: string
  name: string
  minutesUsed: number
  minutesLimit: number
}

const NAV = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { key: "billing", href: "/dashboard/billing", label: "Billing", icon: CreditCard },
] as const

export function Sidebar({
  active,
  user,
  plan,
}: {
  active: "dashboard" | "billing"
  user: { name?: string | null; email?: string | null }
  plan: SidebarPlan
}) {
  const displayName = user.name || user.email?.split("@")[0]

  return (
    <aside className="sticky top-0 h-screen border-r border-line/8 flex flex-col gap-7 pt-[22px] px-4 pb-4">
      <Link href="/dashboard" className="px-2">
        <Wordmark size={28} />
      </Link>

      <nav className="flex flex-col gap-0.5 flex-1">
        {NAV.map(({ key, href, label, icon: Icon }) => {
          const isActive = key === active
          return (
            <Link
              key={key}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "h-[38px] px-3 rounded-[9px] flex items-center gap-2.5 text-[13.5px] transition-colors duration-150",
                isActive
                  ? "bg-elevated text-paper font-medium hover:text-paper"
                  : "text-ink-3 hover:text-paper"
              )}
            >
              <Icon
                className={cn("size-4", isActive && "text-accent-ink")}
                strokeWidth={1.75}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-surface border border-line/8">
        <span className="text-[12.5px] font-medium text-paper">{plan.name} plan</span>
        <div className="flex flex-col gap-1.5">
          <UsageBar used={plan.minutesUsed} limit={plan.minutesLimit} height={4} />
          <span className="font-mono tabular-nums text-[11.5px] text-ink-3">
            {plan.minutesUsed} / {plan.minutesLimit} min this month
          </span>
        </div>
        {plan.id !== "pro" && (
          <Link href="/dashboard/billing" className={buttonClass("primary", "sm", "rounded-lg")}>
            <Sparkles className="size-3.5" />
            Upgrade plan
          </Link>
        )}
      </div>

      <div className="flex items-center gap-2.5 px-1">
        <Avatar name={user.name} email={user.email} />
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="text-[12.5px] text-paper truncate">{displayName}</span>
          <span className="text-[11.5px] text-ink-4 truncate">{user.email}</span>
        </div>
        <UserMenu
          placement="top-end"
          triggerTitle="Theme"
          triggerClassName="size-[30px] rounded-[7px] flex items-center justify-center text-ink-3 hover:bg-elevated hover:text-paper transition-colors duration-150"
          trigger={<SunMoon className="size-[15px]" strokeWidth={1.75} />}
        />
        <IconButton title="Sign out" onClick={() => signOut({ callbackUrl: "/login" })} className="text-ink-3">
          <LogOut className="size-[15px]" strokeWidth={1.75} />
        </IconButton>
      </div>
    </aside>
  )
}

/** Page frame: 248px sidebar + scrolling main. */
export function AppShell({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-canvas text-paper grid grid-cols-[248px_minmax(0,1fr)]">
      {sidebar}
      <main className="min-w-0 px-12 py-10">{children}</main>
    </div>
  )
}
