import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

interface Subtitle {
  id: number
  start: number
  end: number
  text: string
}

// Helper function to format time for VTT (HH:MM:SS.mmm)
function formatVTTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const milliseconds = Math.floor((seconds % 1) * 1000)

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
}

// GET - Export subtitles as VTT file
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

    if (!video.subtitles || (video.subtitles as Subtitle[]).length === 0) {
      return NextResponse.json(
        { error: "No subtitles to export" },
        { status: 400 }
      )
    }

    const subtitles = video.subtitles as Subtitle[]

    // Generate VTT content
    let vttContent = "WEBVTT\n\n"
    subtitles.forEach((subtitle) => {
      vttContent += `${formatVTTTime(subtitle.start)} --> ${formatVTTTime(subtitle.end)}\n`
      vttContent += `${subtitle.text}\n\n`
    })

    // Return as downloadable file
    return new NextResponse(vttContent, {
      headers: {
        "Content-Type": "text/vtt; charset=utf-8",
        "Content-Disposition": `attachment; filename="${video.title}.vtt"`
      }
    })
  } catch (error) {
    console.error("Error exporting VTT:", error)
    return NextResponse.json(
      { error: "Failed to export VTT" },
      { status: 500 }
    )
  }
}
