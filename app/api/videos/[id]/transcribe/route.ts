import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import OpenAI from "openai"
import path from "path"
import fs from "fs"
import ffmpeg from "fluent-ffmpeg"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// POST - Transcribe video using Whisper API
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

    // Extract audio from video
    const videoPath = path.join(process.cwd(), "public", video.videoUrl)
    const audioPath = path.join(process.cwd(), "public", "uploads", "audio", `${id}.mp3`)

    // Ensure audio directory exists
    const audioDir = path.dirname(audioPath)
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true })
    }

    // Extract audio using FFmpeg
    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .output(audioPath)
        .audioCodec("libmp3lame")
        .audioBitrate("128k")
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .run()
    })

    // Send to Whisper API
    const audioFile = fs.createReadStream(audioPath)

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "pt", // Portuguese
      response_format: "verbose_json", // Get timestamps
      timestamp_granularities: ["word", "segment"]
    })

    // Clean up audio file
    fs.unlinkSync(audioPath)

    // Format transcription into subtitles
    const subtitles = (transcription as any).segments?.map((segment: any, index: number) => ({
      id: index + 1,
      start: segment.start,
      end: segment.end,
      text: segment.text.trim()
    })) || []

    // Update video with transcribed subtitles
    const updatedVideo = await prisma.videoProject.update({
      where: { id: id },
      data: {
        subtitles: subtitles,
        status: "ready"
      }
    })

    return NextResponse.json({
      success: true,
      video: updatedVideo,
      subtitlesCount: subtitles.length
    })
  } catch (error) {
    console.error("Error transcribing video:", error)

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
      { error: "Failed to transcribe video" },
      { status: 500 }
    )
  }
}
