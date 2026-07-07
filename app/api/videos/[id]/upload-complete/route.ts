import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { headObject, deleteObject, presignGetUrl, projectKey } from "@/lib/r2"
import { getSubscriptionWithUsage, minutesForDuration } from "@/lib/billing"

// Chamada pelo cliente após o PUT direto ao R2 concluir.
// Verifica com HEAD que o objeto existe e respeita o limite de tamanho
// (defesa contra cliente que declara um size e sobe outro), grava a duração
// real lida do metadata do arquivo e dispara a geração do filmstrip.

const MAX_SIZE_BYTES = 500 * 1024 * 1024

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

    const video = await prisma.videoProject.findUnique({
      where: { id, userId: session.user.id },
    })

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 })
    }

    if (video.status !== "uploading") {
      return NextResponse.json(
        { error: "Video is not awaiting upload" },
        { status: 400 }
      )
    }

    const object = await headObject(video.videoUrl)
    if (!object) {
      return NextResponse.json(
        { error: "Upload not found in storage" },
        { status: 400 }
      )
    }

    if (object.size > MAX_SIZE_BYTES) {
      // Cliente burlou o size declarado — remove o objeto para não pagar
      // storage por ele e marca o projeto como failed.
      await deleteObject(video.videoUrl).catch(() => {})
      await prisma.videoProject.update({
        where: { id },
        data: { status: "failed" },
      })
      return NextResponse.json(
        { error: "File too large. Maximum size is 500MB." },
        { status: 400 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const duration =
      typeof body?.duration === "number" &&
      Number.isFinite(body.duration) &&
      body.duration > 0
        ? body.duration
        : 0

    // Quota: este é o único ponto onde a duração real chega, então o débito de
    // minutos acontece aqui (e não no render — re-render não cobra de novo).
    // A rota só roda uma vez por projeto (status precisa ser "uploading"),
    // o que impede débito duplicado.
    const { sub, plan } = await getSubscriptionWithUsage(session.user.id)

    if (duration > plan.maxVideoMinutes * 60) {
      await deleteObject(video.videoUrl).catch(() => {})
      await prisma.videoProject.update({
        where: { id },
        data: { status: "failed" },
      })
      return NextResponse.json(
        {
          error: `Your ${plan.name} plan allows videos up to ${plan.maxVideoMinutes} minutes.`,
          code: "video_too_long",
        },
        { status: 400 }
      )
    }

    const minutes = minutesForDuration(duration)
    if (sub.minutesUsed + minutes > sub.minutesLimit) {
      await deleteObject(video.videoUrl).catch(() => {})
      await prisma.videoProject.update({
        where: { id },
        data: { status: "failed" },
      })
      return NextResponse.json(
        {
          error: `Monthly limit reached (${sub.minutesUsed}/${sub.minutesLimit} minutes used). Upgrade your plan to keep going.`,
          code: "quota_exceeded",
        },
        { status: 402 }
      )
    }

    await prisma.subscription.update({
      where: { userId: session.user.id },
      data: { minutesUsed: { increment: minutes } },
    })

    const updated = await prisma.videoProject.update({
      where: { id },
      data: {
        status: "ready",
        duration, // segundos
      },
    })

    // Dispara filmstrip em background — o worker baixa via presigned GET e
    // sobe o resultado direto no R2 (filmstripKey).
    const workerUrl = process.env.WORKER_URL || "http://localhost:8000"
    const workerSecret = process.env.WORKER_SECRET
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      "http://localhost:3000"

    const videoDownloadUrl = await presignGetUrl(video.videoUrl)

    console.log(`[Upload] Triggering filmstrip generation for video ${id}`)

    fetch(`${workerUrl}/generate-filmstrip`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${workerSecret}`,
      },
      body: JSON.stringify({
        videoId: id,
        videoUrl: videoDownloadUrl,
        duration,
        filmstripKey: projectKey(id, "filmstrip.jpg"),
        thumbnailKey: projectKey(id, "thumb.jpg"),
        webhookUrl: `${appUrl}/api/webhooks/filmstrip-complete`,
      }),
    }).catch((error) => {
      console.error(`[Upload] Failed to trigger filmstrip generation:`, error)
    })

    return NextResponse.json({ success: true, project: updated })
  } catch (error) {
    console.error("Upload complete error:", error)
    return NextResponse.json(
      { error: "Failed to finalize upload" },
      { status: 500 }
    )
  }
}
