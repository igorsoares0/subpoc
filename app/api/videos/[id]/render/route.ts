import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import path from "path"
import fs from "fs"
import ffmpeg from "fluent-ffmpeg"

interface Subtitle {
  id: number
  start: number
  end: number
  text: string
}

interface SubtitleStyle {
  fontFamily: string
  fontSize: number
  color: string
  backgroundColor: string
  backgroundOpacity: number
  position: string
  alignment: string
  outline: boolean
  outlineColor: string
  outlineWidth: number
}

// Helper function to format time for SRT (HH:MM:SS,mmm)
function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const milliseconds = Math.floor((seconds % 1) * 1000)

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`
}

// Helper to generate SRT subtitle file
function generateSRTFile(subtitles: Subtitle[]): string {
  let srtContent = ""

  subtitles.forEach((subtitle, index) => {
    srtContent += `${index + 1}\n`
    srtContent += `${formatSRTTime(subtitle.start)} --> ${formatSRTTime(subtitle.end)}\n`
    srtContent += `${subtitle.text}\n\n`
  })

  return srtContent
}

// Helper to convert hex color to FFmpeg color format (ASS style: &HAABBGGRR)
function hexToFFmpegColor(hex: string, opacity: number = 1): string {
  // Remove # if present
  hex = hex.replace('#', '')

  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  // ASS Alpha is transparency: 00 = opaque, FF = transparent
  // So we invert the opacity: (1 - opacity)
  const a = Math.round((1 - opacity) * 255)

  // FFmpeg uses format: &HAABBGGRR (note: BGR not RGB)
  const ffmpegColor = `&H${a.toString(16).padStart(2, '0').toUpperCase()}${b.toString(16).padStart(2, '0').toUpperCase()}${g.toString(16).padStart(2, '0').toUpperCase()}${r.toString(16).padStart(2, '0').toUpperCase()}`

  return ffmpegColor
}

// Helper to generate ASS subtitle file (Advanced SubStation Alpha)
function generateASSFile(subtitles: Subtitle[], style: SubtitleStyle): string {
  const primaryColor = hexToFFmpegColor(style.color, 1)
  const outlineColor = hexToFFmpegColor(style.outlineColor, 1)
  const backgroundColor = hexToFFmpegColor(style.backgroundColor, style.backgroundOpacity)

  // Map font family to FFmpeg-compatible names
  const fontMap: Record<string, string> = {
    'Montserrat': 'Montserrat',
    'Arial': 'Arial',
    'Helvetica': 'Helvetica',
    'Inter': 'Inter',
    'Roboto': 'Roboto',
    'Poppins': 'Poppins'
  }

  const fontName = fontMap[style.fontFamily] || 'Arial'

  // Alignment: 1=left bottom, 2=center bottom, 3=right bottom, etc.
  const alignmentMap: Record<string, number> = {
    'left': 1,
    'center': 2,
    'right': 3
  }
  const alignment = alignmentMap[style.alignment] || 2

  let ass = `[Script Info]
Title: Subtitles
ScriptType: v4.00+
Collisions: Normal

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${style.fontSize},${primaryColor},${primaryColor},${outlineColor},${backgroundColor},${style.outline ? -1 : 0},0,0,0,100,100,0,0,1,${style.outlineWidth},0,${alignment},10,10,20,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`

  // Helper to format time for ASS (H:MM:SS.cc)
  function formatASSTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const centiseconds = Math.floor((seconds % 1) * 100)

    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`
  }

  subtitles.forEach((subtitle) => {
    const startTime = formatASSTime(subtitle.start)
    const endTime = formatASSTime(subtitle.end)
    const text = subtitle.text.replace(/\n/g, '\\N') // ASS uses \N for line breaks

    ass += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${text}\n`
  })

  return ass
}

// POST - Send video to worker for rendering
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

    // Construct full video URL
    const videoUrl = video.videoUrl.startsWith('http')
      ? video.videoUrl
      : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${video.videoUrl}`

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

    if (!video.outputUrl) {
      return NextResponse.json(
        { error: "Video not yet rendered" },
        { status: 400 }
      )
    }

    // Se a outputUrl é do worker, fazer proxy
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
