import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// POST - Send video to worker for transcription
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await params

    // Verify ownership
    const video = await prisma.videoProject.findUnique({
      where: {
        id: id,
        userId: session.user.id
      }
    })

    if (!video) {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      )
    }

    // Update status to transcribing
    await prisma.videoProject.update({
      where: { id: id },
      data: { status: "transcribing" }
    })

    // Get worker configuration
    const workerUrl = process.env.WORKER_URL
    const workerSecret = process.env.WORKER_SECRET

    if (!workerUrl || !workerSecret) {
      console.error("Worker not configured. Please set WORKER_URL and WORKER_SECRET")
      throw new Error("Worker not configured")
    }

    // Construct full video URL
    const videoUrl = video.videoUrl.startsWith('http')
      ? video.videoUrl
      : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${video.videoUrl}`

    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/transcription`

    console.log(`[Transcribe] Sending video ${id} to worker`)
    console.log(`[Transcribe] Video URL: ${videoUrl}`)
    console.log(`[Transcribe] Webhook URL: ${webhookUrl}`)

    // Send job to worker
    const response = await fetch(`${workerUrl}/transcribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${workerSecret}`
      },
      body: JSON.stringify({
        videoId: id,
        videoUrl: videoUrl,
        webhookUrl: webhookUrl
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error(`[Transcribe] Worker error: ${error}`)
      throw new Error(`Worker returned error: ${response.status}`)
    }

    const result = await response.json()
    console.log(`[Transcribe] Worker response:`, result)

    return NextResponse.json({
      success: true,
      status: "processing",
      message: "Transcription started in background"
    })
  } catch (error) {
    console.error("Error starting transcription:", error)

    // Update status to failed
    try {
      const { id } = await params
      await prisma.videoProject.update({
        where: { id: id },
        data: { status: "failed" }
      })
    } catch (dbError) {
      console.error("Error updating video status:", dbError)
    }

    return NextResponse.json(
      { error: "Failed to start transcription" },
      { status: 500 }
    )
  }
}
