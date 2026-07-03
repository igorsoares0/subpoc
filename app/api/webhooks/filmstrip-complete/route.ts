import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyWorkerRequest, unauthorizedWebhookResponse } from "@/lib/worker-auth"

export async function POST(req: Request) {
  try {
    if (!verifyWorkerRequest(req)) {
      return unauthorizedWebhookResponse()
    }

    const body = await req.json()
    const { videoId, filmstripKey, filmstripUrl, thumbnailKey, metadata, status, error } = body

    console.log(`[Filmstrip Webhook] Received callback for video ${videoId}`)
    console.log(`[Filmstrip Webhook] Status: ${status}`)

    if (status === "completed") {
      // Preferir a KEY do R2 (worker novo); filmstripUrl é compat com o antigo
      await prisma.videoProject.update({
        where: { id: videoId },
        data: {
          filmstripUrl: filmstripKey || filmstripUrl,
          filmstripMetadata: metadata,
          // Key R2 da thumbnail do card (assinada na leitura, como o filmstrip)
          ...(thumbnailKey ? { thumbnailUrl: thumbnailKey } : {})
        }
      })

      console.log(`[Filmstrip Webhook] ✓ Updated video ${videoId} with filmstrip`)
      console.log(`[Filmstrip Webhook] URL: ${filmstripUrl}`)
      console.log(`[Filmstrip Webhook] Metadata:`, metadata)

      return NextResponse.json({ success: true })

    } else if (status === "failed") {
      console.error(`[Filmstrip Webhook] ✗ Generation failed for video ${videoId}:`, error)

      // Could optionally update a status field or log the error
      // For now, just log it - filmstrip remains null in database

      return NextResponse.json({
        success: false,
        error
      }, { status: 500 })
    }

    return NextResponse.json({
      success: false,
      error: "Invalid status"
    }, { status: 400 })

  } catch (error) {
    console.error("[Filmstrip Webhook] Error processing webhook:", error)
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    )
  }
}
