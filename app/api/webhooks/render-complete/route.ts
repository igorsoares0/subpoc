import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  try {
    const { videoId, outputUrl, status, error } = await req.json()

    console.log(`[Webhook] Render callback for video ${videoId}`)

    if (error) {
      console.error(`[Webhook] Rendering failed for ${videoId}:`, error)

      await prisma.videoProject.update({
        where: { id: videoId },
        data: { status: "failed" }
      })

      return NextResponse.json({ success: false, error })
    }

    // Salvar URL do vídeo renderizado
    await prisma.videoProject.update({
      where: { id: videoId },
      data: {
        outputUrl,
        status: "completed"
      }
    })

    console.log(`[Webhook] Rendering completed for ${videoId}: ${outputUrl}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Webhook] Error processing render callback:", error)
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 }
    )
  }
}
