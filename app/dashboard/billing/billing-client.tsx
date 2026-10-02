"use client"

import { useEffect, useState } from "react"
import { ArrowUpRight, Check, CreditCard, Loader2 } from "lucide-react"
import { initializePaddle, type Paddle } from "@paddle/paddle-js"
import { PLANS, type PlanId } from "@/lib/plans"
import { AppShell, TopBar } from "@/components/app-shell/TopBar"
import { Button } from "@/components/ui/Button"
import { Banner, BannerAction } from "@/components/ui/Banner"
import { Highlight } from "@/components/ui/Highlight"
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

  const currentPlan = PLANS[subscription.plan as PlanId] ?? PLANS.free
  const hasSub = subscription.hasPaddleSubscription
  const periodLabel = !periodEnd
    ? null
    : subscription.cancelAtPeriodEnd
      ? `Cancels ${periodEnd}`
      : hasSub
        ? `Renews ${periodEnd} · $${currentPlan.priceUsd}/mo`
        : `Resets ${periodEnd}`

  return (
    <AppShell
      topBar={
        <TopBar
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
      <div className="flex items-end justify-between gap-6 flex-wrap pt-7 pb-[22px]">
        <h1 className="display text-[64px] leading-[0.95] text-paper">
          Your <Highlight className="px-2.5">plan</Highlight>
        </h1>
        {hasSub && (
          <Button variant="secondary" size="lg" className="px-5" onClick={openPortal} disabled={busyPlan === "free"}>
            {busyPlan === "free" && <Loader2 className="size-4 animate-spin" />}
            Manage subscription
            <ArrowUpRight className="size-[15px]" />
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4 empty:hidden mb-4">
        {activating && (
          <Banner
            variant="accent"
            icon={<span className="block size-[18px] rounded-full border-[2.5px] border-accent/25 border-t-accent animate-spin" />}
            detail="This takes a few seconds."
          >
            Updating your subscription…
          </Banner>
        )}
        {subscription.status === "past_due" && (
          <Banner
            variant="danger"
            icon={<CreditCard className="size-[18px]" />}
            detail={`Update your card to keep ${currentPlanName}.`}
            action={
              hasSub ? (
                <BannerAction tone="danger" onClick={openPortal} disabled={busyPlan === "free"}>
                  Update payment
                </BannerAction>
              ) : undefined
            }
          >
            Payment past due.
          </Banner>
        )}
        {error && (
          <Banner variant="danger" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        )}
      </div>

      {/* Uso atual */}
      <section className="grid grid-cols-1 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] items-end gap-y-6 rounded-[18px] bg-surface px-7 py-[26px]">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-3">Current plan</span>
          <span className="display text-[40px] tracking-[-0.03em] text-paper">{currentPlanName}</span>
          {periodLabel && <span className="text-[13px] text-ink-3">{periodLabel}</span>}
        </div>
        <Meter
          label="Minutes"
          used={subscription.minutesUsed}
          limit={subscription.minutesLimit}
          fill="accent"
          danger={subscription.minutesLimit > 0 && subscription.minutesUsed / subscription.minutesLimit > 0.8}
          className="md:px-7 md:border-l border-line/12"
        />
        <Meter
          label="Videos in library"
          used={subscription.videosStored}
          limit={subscription.videosLimit}
          danger={subscription.videosStored >= subscription.videosLimit}
          className="md:pl-7 md:border-l border-line/12"
        />
      </section>

      {/* Planos */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.values(PLANS).map((plan) => {
          const isCurrent = subscription.plan === plan.id
          const busy = busyPlan === plan.id
          // Starter is the hero (accent CTA + badge) for free users.
          const hero = plan.id === "starter" && !hasSub && !isCurrent
          return (
            <div
              key={plan.id}
              className={cn(
                "rounded-[18px] p-6 flex flex-col gap-[18px]",
                isCurrent ? "bg-canvas edge-paper" : "bg-surface"
              )}
            >
              <div className="flex items-center justify-between h-[26px]">
                <span className="text-[17px] font-bold text-paper">{plan.name}</span>
                {isCurrent && (
                  <span className="h-6 px-2.5 rounded-full bg-paper text-canvas flex items-center text-[11.5px] font-bold">
                    Current
                  </span>
                )}
                {hero && (
                  <span className="h-6 px-2.5 rounded-full bg-accent-tint text-accent-ink flex items-center text-[11.5px] font-bold whitespace-nowrap">
                    Most picked
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="display text-[64px] leading-[0.9] tracking-[-0.045em] text-paper">${plan.priceUsd}</span>
                <span className="text-[14px] text-ink-3">/ month</span>
              </div>
              <ul className="flex flex-col gap-[9px] flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-[9px] text-[14px] leading-[1.4] text-paper">
                    <Check className="size-[15px] text-accent-ink mt-0.5 shrink-0" strokeWidth={2} />
                    {feature}
                  </li>
                ))}
              </ul>
              {plan.id !== "free" && !isCurrent && (
                <Button
                  variant={hero ? "primary" : "inverse"}
                  size="xl"
                  onClick={() => selectPlan(plan.id)}
                  disabled={busy || (!paddle && !hasSub)}
                  className={cn("w-full", activating && "opacity-45 pointer-events-none")}
                >
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  {hasSub ? "Switch to " + plan.name : "Upgrade to " + plan.name}
                </Button>
              )}
              {isCurrent && plan.id === "free" && (
                <span className="h-[46px] flex items-center justify-center text-[13px] text-ink-3">
                  You&apos;re on this plan
                </span>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-3.5 text-[12.5px] text-ink-3">
        Payments are processed securely by Paddle. Prices in USD; local taxes may apply at checkout.
      </p>
    </AppShell>
  )
}

function Meter({
  label,
  used,
  limit,
  fill = "paper",
  danger,
  className,
}: {
  label: string
  used: number
  limit: number
  fill?: "paper" | "accent"
  danger?: boolean
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <div className="flex items-baseline justify-between">
        <span className="text-[14px] font-semibold text-paper">{label}</span>
        <span className="font-mono tabular-nums text-[15px] font-medium text-paper">
          {used} <span className="text-ink-3">/ {limit}</span>
        </span>
      </div>
      <UsageBar used={used} limit={limit} height={10} fill={fill} danger={danger} />
    </div>
  )
}
