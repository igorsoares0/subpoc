"use client"

import { useEffect, useState } from "react"
import { Check, Loader2 } from "lucide-react"
import { initializePaddle, type Paddle } from "@paddle/paddle-js"
import { PLANS, type PlanId } from "@/lib/plans"
import { AppShell, Sidebar } from "@/components/app-shell/Sidebar"
import { Button } from "@/components/ui/Button"
import { Banner } from "@/components/ui/Banner"
import { UsageBar } from "@/components/ui/controls"
import { cn } from "@/lib/utils"

interface BillingClientProps {
  user: { id: string; email: string; name: string | null }
  subscription: {
    plan: string
    status: string
    minutesUsed: number
    minutesLimit: number
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
    hasPaddleSubscription: boolean
    videosStored: number
    videosLimit: number
  }
  currentPlanName: string
}

export default function BillingClient({
  user,
  subscription,
  currentPlanName,
}: BillingClientProps) {
  const [paddle, setPaddle] = useState<Paddle | null>(null)
  const [busyPlan, setBusyPlan] = useState<PlanId | null>(null)
  const [activating, setActivating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
    if (!token) {
      console.error("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is not set")
      return
    }
    initializePaddle({
      environment:
        process.env.NEXT_PUBLIC_PADDLE_ENV === "production"
          ? "production"
          : "sandbox",
      token,
      eventCallback(event) {
        if (event.name === "checkout.completed") {
          // O webhook ativa a assinatura; dá uma folga pra ele chegar.
          setActivating(true)
          setTimeout(() => window.location.reload(), 4000)
        }
      },
    }).then((instance) => setPaddle(instance ?? null))
  }, [])

  const periodEnd = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null

  async function selectPlan(planId: PlanId) {
    setError(null)
    const plan = PLANS[planId]
    if (!plan.priceId) return

    if (subscription.hasPaddleSubscription) {
      // Já assina: troca de plano via API (proração), sem novo checkout.
      setBusyPlan(planId)
      try {
        const res = await fetch("/api/billing/change-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: planId }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to change plan")
        setActivating(true)
        setTimeout(() => window.location.reload(), 4000)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to change plan")
        setBusyPlan(null)
      }
      return
    }

    if (!paddle) return
    paddle.Checkout.open({
      items: [{ priceId: plan.priceId, quantity: 1 }],
      customer: { email: user.email },
      customData: { userId: user.id },
    })
  }

  async function openPortal() {
    setError(null)
    setBusyPlan("free")
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to open portal")
      window.open(data.url, "_blank", "noopener")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to open portal")
    } finally {
      setBusyPlan(null)
    }
  }

  return (
    <AppShell
      sidebar={
        <Sidebar
          active="billing"
          user={user}
          plan={{
            id: subscription.plan,
            name: currentPlanName,
            minutesUsed: subscription.minutesUsed,
            minutesLimit: subscription.minutesLimit,
          }}
        />
      }
    >
      <div className="max-w-[1040px] flex flex-col gap-7">
        <div className="flex flex-col gap-2.5">
          <h1 className="font-serif text-[52px] leading-none tracking-[-0.01em] text-paper">Billing</h1>
          <p className="text-[13.5px] text-ink-3">Manage your plan and usage.</p>
        </div>

        {activating && (
          <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-lg border bg-accent/12 border-accent-ink/25 text-[13px] text-paper">
            <Loader2 className="size-4 animate-spin text-accent-ink" />
            Updating your subscription…
          </div>
        )}
        {error && <Banner variant="danger">{error}</Banner>}

        {/* Uso atual */}
        <section className="rounded-2xl bg-surface border border-line/8 px-6 py-[22px] flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[12.5px] text-ink-3">Current plan</span>
              <span className="text-[17px] font-semibold text-paper">
                {currentPlanName}
                {subscription.cancelAtPeriodEnd && (
                  <span className="ml-2 text-[12px] font-normal text-ink-3">
                    cancels {periodEnd ? `on ${periodEnd}` : "at period end"}
                  </span>
                )}
                {subscription.status === "past_due" && (
                  <span className="ml-2 text-[12px] font-normal text-danger-ink">
                    payment past due
                  </span>
                )}
              </span>
            </div>
            {subscription.hasPaddleSubscription && (
              <Button variant="ghost" size="sm" onClick={openPortal} disabled={busyPlan === "free"}>
                {busyPlan === "free" && <Loader2 className="size-3.5 animate-spin" />}
                Manage subscription
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Meter label="Minutes" used={subscription.minutesUsed} limit={subscription.minutesLimit} />
            <Meter
              label="Videos in library"
              used={subscription.videosStored}
              limit={subscription.videosLimit}
            />
          </div>
          {periodEnd && <span className="text-[12px] text-ink-4">Resets {periodEnd}</span>}
        </section>

        {/* Planos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.values(PLANS).map((plan) => {
            const isCurrent = subscription.plan === plan.id
            const busy = busyPlan === plan.id
            return (
              <div
                key={plan.id}
                className={cn(
                  "rounded-2xl bg-surface border p-6 flex flex-col gap-5",
                  isCurrent ? "border-ring" : "border-line/8"
                )}
              >
                <div className="flex items-center justify-between h-[22px]">
                  <span className="text-[15px] font-semibold text-paper">{plan.name}</span>
                  {isCurrent && (
                    <span className="h-[22px] px-[9px] rounded-full bg-accent text-on-accent flex items-center text-[11px] font-semibold">
                      Current
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-serif text-[64px] leading-none text-paper">${plan.priceUsd}</span>
                  <span className="text-[13px] text-ink-3">/ month</span>
                </div>
                <ul className="flex flex-col gap-2.5 flex-1">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-[13.5px] leading-[1.4] text-ink-2"
                    >
                      <Check className="size-3.5 text-accent-ink mt-[3px] shrink-0" strokeWidth={2.25} />
                      {feature}
                    </li>
                  ))}
                </ul>
                {plan.id !== "free" && !isCurrent && (
                  <Button
                    onClick={() => selectPlan(plan.id)}
                    disabled={busy || activating || (!paddle && !subscription.hasPaddleSubscription)}
                    className="w-full"
                  >
                    {busy && <Loader2 className="size-4 animate-spin" />}
                    {subscription.hasPaddleSubscription
                      ? "Switch to " + plan.name
                      : "Upgrade to " + plan.name}
                  </Button>
                )}
              </div>
            )
          })}
        </div>

        <p className="text-[12px] text-ink-4">
          Payments are processed securely by Paddle. Prices in USD; local taxes
          may apply at checkout.
        </p>
      </div>
    </AppShell>
  )
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] text-ink-2">{label}</span>
        <span className="font-mono tabular-nums text-[13px] font-medium text-paper">
          {used} <span className="text-ink-4">/ {limit}</span>
        </span>
      </div>
      <UsageBar used={used} limit={limit} />
    </div>
  )
}
