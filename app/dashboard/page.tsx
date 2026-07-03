import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { resolveMediaUrl } from "@/lib/r2"
import DashboardClient from "./dashboard-client"

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  // Fetch user's video projects
  const videos = await prisma.videoProject.findMany({
    where: {
      userId: session.user.id
    },
    orderBy: {
      createdAt: "desc"
    }
  })

  // O banco guarda a KEY do R2 — assinar antes de mandar pro cliente
  const videosWithSignedThumbs = await Promise.all(
    videos.map(async (video) => ({
      ...video,
      thumbnailUrl: await resolveMediaUrl(video.thumbnailUrl),
    }))
  )

  return <DashboardClient user={session.user} initialVideos={videosWithSignedThumbs} />
}
