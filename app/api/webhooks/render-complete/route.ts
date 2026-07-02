import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyWorkerRequest, unauthorizedWebhookResponse } from "@/lib/worker-auth"

export async function POST(req: Request) {
  try {
    if (!verifyWorkerRequest(req)) {
      return unauthorizedWebhookResponse()
    }

    const { videoId, outputKey, outputUrl, status, error } = await req.json()

    console.log(`[Webhook] Render callback for video ${videoId}`)

    if (error) {
      console.error(`[Webhook] Rendering failed for ${videoId}:`, error)

      await prisma.videoProject.update({
        where: { id: videoId },
        data: { status: "failed" }
      })

      return NextResponse.json({ success: false, error })
    }

    // Preferir a KEY do R2 (worker novo); outputUrl é compat com worker antigo
    const output = outputKey || outputUrl
    if (!output) {
      return NextResponse.json(
        { success: false, error: "Missing outputKey" },
        { status: 400 }
      )
    }

    await prisma.videoProject.update({
      where: { id: videoId },
      data: {
        outputUrl: output,
        status: "completed"
      }
    })

    console.log(`[Webhook] Rendering completed for ${videoId}: ${output}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Webhook] Error processing render callback:", error)
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 }
    )
  }
}
