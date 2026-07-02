import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { resolveMediaUrl, presignGetUrl, projectKey, isR2Key } from "@/lib/r2"
import path from "path"
import fs from "fs"

interface Subtitle {
  id: number
  start: number
  end: number
  text: string
}

// POST - Send video to worker for rendering
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
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

    if (!video.subtitles || (video.subtitles as unknown as Subtitle[]).length === 0) {
      return NextResponse.json(
        { error: "No subtitles to render" },
        { status: 400 }
      )
    }

    // Update status to rendering
    await prisma.videoProject.update({
      where: { id: id },
      data: { status: "rendering" }
    })

    // Get worker configuration
    const workerUrl = process.env.WORKER_URL
    const workerSecret = process.env.WORKER_SECRET

    if (!workerUrl || !workerSecret) {
      console.error("Worker not configured. Please set WORKER_URL and WORKER_SECRET")
      throw new Error("Worker not configured")
    }

    // Key R2 → presigned GET pro worker baixar direto do bucket privado
    const videoUrl = await resolveMediaUrl(video.videoUrl)
    if (!videoUrl) {
      return NextResponse.json({ error: "Video file missing" }, { status: 400 })
    }

    // Logo também vive no R2 — assinar antes de mandar pro worker
    let logoOverlay = video.logoOverlay as { logoUrl?: string } | null
    if (logoOverlay?.logoUrl) {
      logoOverlay = {
        ...logoOverlay,
        logoUrl: (await resolveMediaUrl(logoOverlay.logoUrl)) ?? undefined,
      }
    }

    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/render-complete`

    console.log(`[Render] Sending video ${id} to worker`)
    console.log(`[Render] Video URL: ${videoUrl}`)
    console.log(`[Render] Webhook URL: ${webhookUrl}`)
    console.log(`[Render] Subtitles count: ${(video.subtitles as unknown as Subtitle[]).length}`)

    // Send job to worker
    const response = await fetch(`${workerUrl}/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${workerSecret}`
      },
      body: JSON.stringify({
        videoId: id,
        videoUrl: videoUrl,
        subtitles: video.subtitles,
        style: video.subtitleStyle || {},
        format: video.format || null,
        trim: video.trim || null,
        overlays: video.overlays || [],
        logoOverlay: logoOverlay || null,
        outputKey: projectKey(id, "rendered.mp4"),
        webhookUrl: webhookUrl
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error(`[Render] Worker error: ${error}`)
      throw new Error(`Worker returned error: ${response.status}`)
    }

    const result = await response.json()
    console.log(`[Render] Worker response:`, result)

    return NextResponse.json({
      success: true,
      status: "processing",
      message: "Rendering started in background"
    })
  } catch (error) {
    console.error("Error starting rendering:", error)

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
      { error: "Failed to start rendering" },
      { status: 500 }
    )
  }
}

// GET - Download rendered video
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
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

    if (!video.outputUrl) {
      return NextResponse.json(
        { error: "Video not yet rendered" },
        { status: 400 }
      )
    }

    // Caso atual: outputUrl é uma key R2 → redireciona pra presigned GET com
    // Content-Disposition attachment (download com nome amigável, direto do
    // R2, sem passar banda pelo Next.js)
    if (isR2Key(video.outputUrl)) {
      const downloadUrl = await presignGetUrl(video.outputUrl, {
        downloadFilename: `${video.title}_subtitled.mp4`,
      })
      return NextResponse.redirect(downloadUrl)
    }

    // Legado: outputUrl apontando pro worker, fazer proxy
    if (video.outputUrl.startsWith('http://localhost:8000') || video.outputUrl.startsWith(process.env.WORKER_URL || '')) {
      // Redirecionar para o worker
      return NextResponse.redirect(video.outputUrl)
    }

    // Caso contrário, buscar arquivo local (fallback para implementação antiga)
    const videoPath = path.join(process.cwd(), "public", video.outputUrl)

    if (!fs.existsSync(videoPath)) {
      return NextResponse.json(
        { error: "Rendered video file not found" },
        { status: 404 }
      )
    }

    const videoBuffer = fs.readFileSync(videoPath)

    return new NextResponse(videoBuffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${video.title}_subtitled.mp4"`
      }
    })
  } catch (error) {
    console.error("Error downloading rendered video:", error)
    return NextResponse.json(
      { error: "Failed to download video" },
      { status: 500 }
    )
  }
}
