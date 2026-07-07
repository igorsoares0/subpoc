import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { signProjectMedia } from "@/lib/r2"
import { cleanupAbandonedUploads } from "@/lib/cleanup"

// GET - List all video projects for current user
export async function GET(req: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Uploads abandonados (>24h em "uploading") somem da listagem e do R2.
    await cleanupAbandonedUploads(session.user.id).catch(() => 0)

    const videos = await prisma.videoProject.findMany({
      where: {
        userId: session.user.id
      },
      orderBy: {
        createdAt: "desc"
      }
    })

    // Keys R2 → presigned GET URLs (o banco guarda keys, nunca URLs)
    const signed = await Promise.all(videos.map((v) => signProjectMedia(v)))

    return NextResponse.json({ videos: signed })
  } catch (error) {
    console.error("Error fetching videos:", error)
    return NextResponse.json(
      { error: "Failed to fetch videos" },
      { status: 500 }
    )
  }
}
