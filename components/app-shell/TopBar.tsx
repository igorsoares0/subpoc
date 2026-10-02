"use client"

import Link from "next/link"
import { Wordmark } from "@/components/ui/Wordmark"
import { UsageBar } from "@/components/ui/controls"
import { Avatar, UserMenu } from "@/components/ui/ThemeMenu"
import { cn } from "@/lib/utils"

export interface ShellPlan {
  id: string
  name: string
  minutesUsed: number
  minutesLimit: number
}

const NAV = [
  { key: "dashboard", href: "/dashboard", label: "Projects" },
  { key: "billing", href: "/dashboard/billing", label: "Billing" },
] as const

/** App top bar: wordmark, nav pills, usage pill, account menu. */
export function TopBar({
  active,
  user,
  plan,
}: {
  active: "dashboard" | "billing"
  user: { name?: string | null; email?: string | null }
  plan: ShellPlan
}) {
  return (
    <header className="h-[72px] flex items-center gap-7 px-10 flex-none">
      <Link href="/dashboard" aria-label="Supertitle — projects" className="hover:text-paper">
        <Wordmark size={22} />
      </Link>

      <nav className="flex gap-1 text-[14px] font-semibold">
        {NAV.map(({ key, href, label }) => {
          const isActive = key === active
          return (
            <Link
              key={key}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "h-9 px-3.5 rounded-full flex items-center",
                isActive ? "bg-paper text-canvas hover:text-canvas" : "text-ink-3 hover:text-paper"
              )}
            >
              {label}
            </Link>
          )
        })}
      </nav>

      <span className="flex-1" />

      <div
        className={cn(
          "flex-none whitespace-nowrap flex items-center gap-2.5 h-9 rounded-full bg-surface text-[12.5px] font-semibold",
          plan.id !== "pro" ? "pl-3.5 pr-1.5" : "px-3.5"
        )}
        title={`${plan.name} plan — ${plan.minutesUsed} of ${plan.minutesLimit} minutes used this month`}
      >
        <span className="font-mono font-medium tabular-nums">
          {plan.minutesUsed}/{plan.minutesLimit} min
        </span>
        <span className="w-16">
          <UsageBar used={plan.minutesUsed} limit={plan.minutesLimit} danger={plan.minutesUsed >= plan.minutesLimit} />
        </span>
        {plan.id !== "pro" && (
          <Link
            href="/dashboard/billing"
            className="h-[26px] px-2.5 rounded-full flex items-center bg-accent text-on-accent font-bold hover:bg-accent-hover hover:text-on-accent"
          >
            Upgrade
          </Link>
        )}
      </div>

      <UserMenu
        email={user.email}
        triggerClassName="rounded-full cursor-pointer"
        trigger={<Avatar name={user.name} email={user.email} />}
      />
    </header>
  )
}

/** Page frame: top bar + content with the 40px page gutter. */
export function AppShell({ topBar, children }: { topBar: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas text-paper flex flex-col">
      {topBar}
      <main className="flex-1 min-w-0 flex flex-col px-10 pb-10">{children}</main>
    </div>
  )
}
