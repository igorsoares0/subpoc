import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getPaddle } from "@/lib/paddle"
import { PLANS, type PlanId } from "@/lib/plans"

// Troca de plano para quem JÁ tem assinatura ativa (upgrade/downgrade com
// proração imediata). Assinar do zero é pelo checkout overlay; cancelar é
// pelo customer portal. O webhook subscription.updated sincroniza o banco.

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const planId = body?.plan as PlanId | undefined
    const plan = planId ? PLANS[planId] : undefined

    if (!plan?.priceId) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
    }

    const sub = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    })

    if (!sub?.paddleSubscriptionId) {
      return NextResponse.json(
        { error: "No active subscription to change" },
        { status: 400 }
      )
    }

    if (sub.paddlePriceId === plan.priceId) {
      return NextResponse.json(
        { error: "Already on this plan" },
        { status: 400 }
      )
    }

    await getPaddle().subscriptions.update(sub.paddleSubscriptionId, {
      items: [{ priceId: plan.priceId, quantity: 1 }],
      prorationBillingMode: "prorated_immediately",
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Billing] Failed to change plan:", error)
    return NextResponse.json(
      { error: "Failed to change plan" },
      { status: 500 }
    )
  }
}
