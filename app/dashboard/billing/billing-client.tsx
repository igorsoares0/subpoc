"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Check, Loader2 } from "lucide-react"
import { initializePaddle, type Paddle } from "@paddle/paddle-js"
import { PLANS, type PlanId } from "@/lib/plans"

interface BillingClientProps {
  user: { id: string; email: string }
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

  const usagePct = Math.min(
    100,
    Math.round((subscription.minutesUsed / subscription.minutesLimit) * 100)
  )
  const periodEnd = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
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
    <div className="min-h-screen bg-canvas text-white p-6">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-300 text-[13px] transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to dashboard
        </Link>

        <h1 className="text-xl font-semibold mb-1">Billing</h1>
        <p className="text-zinc-500 text-[13px] mb-8">
          Manage your plan and usage.
        </p>

        {activating && (
          <div className="mb-6 flex items-center gap-3 bg-blue-600/10 border border-blue-500/20 text-blue-300 rounded-xl px-4 py-3 text-[13px]">
            <Loader2 className="w-4 h-4 animate-spin" />
            Updating your subscription…
          </div>
        )}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-[13px]">
            {error}
          </div>
        )}

        {/* Uso atual */}
        <div className="bg-surface border border-white/[0.04] rounded-xl p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-[13px] text-zinc-400">Current plan</span>
              <div className="text-[15px] font-semibold">
                {currentPlanName}
                {subscription.cancelAtPeriodEnd && (
                  <span className="ml-2 text-[11px] font-normal text-amber-400">
                    cancels {periodEnd ? `on ${periodEnd}` : "at period end"}
                  </span>
                )}
                {subscription.status === "past_due" && (
                  <span className="ml-2 text-[11px] font-normal text-red-400">
                    payment past due
                  </span>
                )}
              </div>
            </div>
            {subscription.hasPaddleSubscription && (
              <button
                onClick={openPortal}
                className="text-[13px] text-zinc-400 hover:text-white border border-white/[0.08] hover:border-white/[0.16] rounded-lg px-4 py-2 transition-colors"
              >
                Manage subscription
              </button>
            )}
          </div>
          <div className="flex items-center justify-between text-[12px] text-zinc-500 mb-2">
            <span>
              {subscription.minutesUsed} / {subscription.minutesLimit} minutes
              used
              <span className="mx-2 text-zinc-700">·</span>
              {subscription.videosStored} / {subscription.videosLimit} videos
            </span>
            {periodEnd && <span>Resets {periodEnd}</span>}
          </div>
          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                usagePct >= 100
                  ? "bg-red-500"
                  : usagePct >= 80
                    ? "bg-amber-500"
                    : "bg-blue-600"
              }`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
        </div>

        {/* Planos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.values(PLANS).map((plan) => {
            const isCurrent = subscription.plan === plan.id
            const busy = busyPlan === plan.id
            return (
              <div
                key={plan.id}
                className={`bg-surface rounded-xl p-5 border transition-colors ${
                  isCurrent
                    ? "border-blue-500/40"
                    : "border-white/[0.04] hover:border-white/[0.1]"
                }`}
              >
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-[15px] font-semibold">{plan.name}</span>
                  {isCurrent && (
                    <span className="text-[11px] text-blue-400 bg-blue-600/10 border border-blue-500/20 rounded-full px-2 py-0.5">
                      Current
                    </span>
                  )}
                </div>
                <div className="mb-4">
                  <span className="text-2xl font-bold">${plan.priceUsd}</span>
                  <span className="text-zinc-500 text-[13px]">/month</span>
                </div>
                <ul className="space-y-2 mb-5">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-[13px] text-zinc-400"
                    >
                      <Check className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {plan.id !== "free" && !isCurrent && (
                  <button
                    onClick={() => selectPlan(plan.id)}
                    disabled={busy || activating || (!paddle && !subscription.hasPaddleSubscription)}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-medium text-[13px] transition-colors"
                  >
                    {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                    {subscription.hasPaddleSubscription
                      ? "Switch to " + plan.name
                      : "Upgrade to " + plan.name}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <p className="text-[12px] text-zinc-600 mt-6">
          Payments are processed securely by Paddle. Prices in USD; local taxes
          may apply at checkout.
        </p>
      </div>
    </div>
  )
}
