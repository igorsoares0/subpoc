import { NextResponse } from "next/server"
import { EventName, type SubscriptionNotification } from "@paddle/paddle-node-sdk"
import { prisma } from "@/lib/prisma"
import { getPaddle } from "@/lib/paddle"
import { PLANS, planFromPriceId } from "@/lib/plans"

// Webhook do Paddle (Notification destination -> <origin>/api/webhooks/paddle).
// Assinatura verificada via Paddle-Signature (HMAC) com o secret do destino.
// O estado local espelha o Paddle: plano, limites e período vêm daqui.

export async function POST(req: Request) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET
  if (!secret) {
    console.error("[Paddle] PADDLE_WEBHOOK_SECRET is not set")
    return NextResponse.json({ error: "Not configured" }, { status: 500 })
  }

  const signature = req.headers.get("paddle-signature")
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 })
  }

  const rawBody = await req.text()

  let event
  try {
    event = await getPaddle().webhooks.unmarshal(rawBody, secret, signature)
  } catch (error) {
    console.error("[Paddle] Invalid webhook signature:", error)
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  console.log(`[Paddle] Event: ${event.eventType}`)

  try {
    switch (event.eventType) {
      case EventName.SubscriptionCreated:
      case EventName.SubscriptionActivated:
      case EventName.SubscriptionUpdated:
        await syncSubscription(event.data as SubscriptionNotification)
        break

      case EventName.SubscriptionCanceled:
        await downgradeToFree(event.data as SubscriptionNotification)
        break

      default:
        break
    }
  } catch (error) {
    // 500 faz o Paddle reentregar com backoff — certo para erro transitório.
    console.error(`[Paddle] Error handling ${event.eventType}:`, error)
    return NextResponse.json({ error: "Handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// userId vem do customData setado no Checkout.open(); fallback pelo
// paddleSubscriptionId para eventos posteriores.
async function findLocalSubscription(data: SubscriptionNotification) {
  const userId = (data.customData as { userId?: string } | null)?.userId
  if (userId) {
    const byUser = await prisma.subscription.findUnique({ where: { userId } })
    if (byUser) return byUser
  }
  return prisma.subscription.findUnique({
    where: { paddleSubscriptionId: data.id },
  })
}

async function syncSubscription(data: SubscriptionNotification) {
  const existing = await findLocalSubscription(data)
  if (!existing) {
    console.error(`[Paddle] No local subscription found for ${data.id}`)
    return
  }

  // subscription.updated também chega com status canceled (cancel imediato).
  if (data.status === "canceled") {
    await downgradeToFree(data)
    return
  }

  const priceId = data.items?.[0]?.price?.id ?? null
  const plan = planFromPriceId(priceId)
  if (!plan) {
    console.error(`[Paddle] Unknown priceId ${priceId} on subscription ${data.id}`)
  }

  const periodEnd = data.currentBillingPeriod?.endsAt
    ? new Date(data.currentBillingPeriod.endsAt)
    : existing.currentPeriodEnd

  // Período avançou = renovação (ou primeira cobrança): zera o uso do mês.
  const periodAdvanced =
    periodEnd !== null &&
    (existing.currentPeriodEnd === null || periodEnd > existing.currentPeriodEnd)

  await prisma.subscription.update({
    where: { id: existing.id },
    data: {
      paddleCustomerId: data.customerId,
      paddleSubscriptionId: data.id,
      paddlePriceId: priceId,
      status: data.status === "trialing" ? "active" : data.status,
      cancelAtPeriodEnd: data.scheduledChange?.action === "cancel",
      currentPeriodEnd: periodEnd,
      ...(plan ? { plan: plan.id, minutesLimit: plan.minutesLimit } : {}),
      ...(periodAdvanced ? { minutesUsed: 0 } : {}),
    },
  })

  console.log(
    `[Paddle] Synced subscription ${data.id} -> plan=${plan?.id ?? "?"} status=${data.status}`
  )
}

async function downgradeToFree(data: SubscriptionNotification) {
  const existing = await findLocalSubscription(data)
  if (!existing) {
    console.error(`[Paddle] No local subscription found for ${data.id}`)
    return
  }

  // Mantém paddleCustomerId para futuras assinaturas. currentPeriodEnd fica —
  // quando vencer, o reset lazy de lib/billing.ts abre o período free novo.
  await prisma.subscription.update({
    where: { id: existing.id },
    data: {
      plan: "free",
      status: "free",
      minutesLimit: PLANS.free.minutesLimit,
      paddleSubscriptionId: null,
      paddlePriceId: null,
      cancelAtPeriodEnd: false,
    },
  })

  console.log(`[Paddle] Subscription ${data.id} canceled -> downgraded to free`)
}
