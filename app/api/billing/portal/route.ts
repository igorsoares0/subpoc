import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getPaddle } from "@/lib/paddle"

// Cria uma sessão do customer portal do Paddle (gerenciar pagamento/cancelar).

export async function POST() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sub = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    })

    if (!sub?.paddleCustomerId) {
      return NextResponse.json(
        { error: "No billing account yet" },
        { status: 400 }
      )
    }

    const portal = await getPaddle().customerPortalSessions.create(
      sub.paddleCustomerId,
      sub.paddleSubscriptionId ? [sub.paddleSubscriptionId] : []
    )

    return NextResponse.json({ url: portal.urls.general.overview })
  } catch (error) {
    console.error("[Billing] Failed to create portal session:", error)
    return NextResponse.json(
      { error: "Failed to open billing portal" },
      { status: 500 }
    )
  }
}
