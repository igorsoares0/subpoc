import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const video = await prisma.videoProject.findUnique({
      where: { id, userId: session.user.id },
      select: {
        filmstripUrl: true,
        filmstripMetadata: true
      }
    })

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 })
    }

    if (!video.filmstripUrl) {
      return NextResponse.json(
        { error: "Filmstrip not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      filmstripUrl: video.filmstripUrl,
      metadata: video.filmstripMetadata
    })

  } catch (error) {
    console.error("[Filmstrip] Error fetching filmstrip:", error)
    return NextResponse.json(
      { error: "Failed to fetch filmstrip" },
      { status: 500 }
    )
  }
}
