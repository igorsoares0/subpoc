import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { getSubscriptionWithUsage } from "@/lib/billing"
import BillingClient from "./billing-client"

export default async function BillingPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const { sub, plan } = await getSubscriptionWithUsage(session.user.id)

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
      }}
      currentPlanName={plan.name}
    />
  )
}
