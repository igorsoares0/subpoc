import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Verify ownership
    const video = await prisma.videoProject.findUnique({
      where: { id, userId: session.user.id }
    })

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 })
    }

    // Check if filmstrip already exists
    if (video.filmstripUrl) {
      return NextResponse.json({
        status: "already_exists",
        filmstripUrl: video.filmstripUrl,
        metadata: video.filmstripMetadata
      })
    }

    // Trigger worker to generate filmstrip
    const workerUrl = process.env.WORKER_URL || "http://localhost:8000"
    const webhookUrl = `${process.env.NEXTAUTH_URL}/api/webhooks/filmstrip-complete`
    const workerSecret = process.env.WORKER_SECRET

    console.log(`[Filmstrip] Triggering generation for video ${id}`)
    console.log(`[Filmstrip] Worker URL: ${workerUrl}`)
    console.log(`[Filmstrip] Webhook URL: ${webhookUrl}`)

    const response = await fetch(`${workerUrl}/generate-filmstrip`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${workerSecret}`
      },
      body: JSON.stringify({
        videoId: video.id,
        videoUrl: video.videoUrl,
        duration: video.duration, // duration já está em segundos no banco
        webhookUrl: webhookUrl
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Filmstrip] Worker request failed: ${errorText}`)
      throw new Error(`Worker request failed: ${response.status}`)
    }

    const result = await response.json()
    console.log(`[Filmstrip] Worker accepted request:`, result)

    return NextResponse.json({
      status: "processing",
      message: "Filmstrip generation started"
    }, { status: 202 })

  } catch (error) {
    console.error("[Filmstrip] Error triggering generation:", error)
    return NextResponse.json(
      { error: "Failed to generate filmstrip" },
      { status: 500 }
    )
  }
}
