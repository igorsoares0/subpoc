import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { resolveMediaUrl } from "@/lib/r2"
import { getSubscriptionWithUsage } from "@/lib/billing"
import DashboardClient from "./dashboard-client"

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  // Fetch user's video projects + plan usage (sidebar plan card)
  const [videos, { sub, plan }] = await Promise.all([
    prisma.videoProject.findMany({
      where: {
        userId: session.user.id
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    getSubscriptionWithUsage(session.user.id),
  ])

  // O banco guarda a KEY do R2 — assinar antes de mandar pro cliente
  const videosWithSignedThumbs = await Promise.all(
    videos.map(async (video) => ({
      ...video,
      thumbnailUrl: await resolveMediaUrl(video.thumbnailUrl),
    }))
  )

  return (
    <DashboardClient
      user={session.user}
      initialVideos={videosWithSignedThumbs}
      plan={{
        id: plan.id,
        name: plan.name,
        minutesUsed: sub.minutesUsed,
        minutesLimit: sub.minutesLimit,
      }}
    />
  )
}
