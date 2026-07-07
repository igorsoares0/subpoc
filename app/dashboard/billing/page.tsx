import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getSubscriptionWithUsage } from "@/lib/billing"
import BillingClient from "./billing-client"

export default async function BillingPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const { sub, plan } = await getSubscriptionWithUsage(session.user.id)

  // Mesmo critério do cap na rota de upload: failed não conta.
  const videosStored = await prisma.videoProject.count({
    where: { userId: session.user.id, status: { not: "failed" } },
  })

  return (
    <BillingClient
      user={{ id: session.user.id, email: session.user.email ?? "" }}
      subscription={{
        plan: sub.plan,
        status: sub.status,
        minutesUsed: sub.minutesUsed,
        minutesLimit: sub.minutesLimit,
        currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        hasPaddleSubscription: !!sub.paddleSubscriptionId,
        videosStored,
        videosLimit: plan.maxProjects,
      }}
      currentPlanName={plan.name}
    />
  )
}
