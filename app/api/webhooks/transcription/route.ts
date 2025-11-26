import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  try {
    const { videoId, subtitles, status, error } = await req.json()

    console.log(`[Webhook] Transcription callback for video ${videoId}`)

    if (error) {
      console.error(`[Webhook] Transcription failed for ${videoId}:`, error)

      await prisma.videoProject.update({
        where: { id: videoId },
        data: { status: "failed" }
      })

      return NextResponse.json({ success: false, error })
    }

    // Salvar legendas no banco
    await prisma.videoProject.update({
      where: { id: videoId },
      data: {
        subtitles,
        status: "ready"
      }
    })

    console.log(`[Webhook] Transcription completed for ${videoId}: ${subtitles.length} subtitles`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Webhook] Error processing transcription callback:", error)
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 }
    )
  }
}
