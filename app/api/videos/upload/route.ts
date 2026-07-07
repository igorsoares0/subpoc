import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { presignPutUrl, projectKey } from "@/lib/r2"
import { getSubscriptionWithUsage } from "@/lib/billing"
import { cleanupAbandonedUploads } from "@/lib/cleanup"
import { rateLimit } from "@/lib/rate-limit"

// Upload direto browser → R2 via presigned PUT.
// Esta rota só valida, cria o projeto e assina a URL — o arquivo nunca passa
// pelo Next.js (sem limite de body, sem banda do servidor).
//
// O Content-Type entra na assinatura: se o cliente mandar outro tipo, o R2
// rejeita o PUT. O tamanho declarado é validado aqui e re-verificado com HEAD
// em /upload-complete (que apaga o objeto se estourar o limite).
//
// Anti-abuso: presigned URLs dão escrita direta no bucket, e a cota de
// minutos só é cobrada em /upload-complete — quem nunca chama o complete
// subiria storage de graça. Por isso: rate limit por usuário, cota checada
// já aqui (best-effort; a real é no complete) e cap de uploads pendentes,
// que limita o storage máximo em aberto por usuário a
// MAX_PENDING_UPLOADS × MAX_SIZE_BYTES.

const MAX_SIZE_BYTES = 500 * 1024 * 1024 // 500MB
const UPLOAD_URL_EXPIRY_SECONDS = 60 * 60 // 1h para concluir o PUT
const MAX_PENDING_UPLOADS = 3
const UPLOADS_PER_HOUR = 10

const EXTENSION_BY_TYPE: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-msvideo": "avi",
}

export async function POST(req: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rl = await rateLimit(
      `upload:user:${session.user.id}`,
      UPLOADS_PER_HOUR,
      3600
    )
    if (!rl.ok) {
      return NextResponse.json(
        {
          error: `Too many uploads. Try again in ${Math.ceil(rl.retryAfter / 60)} minutes.`,
          code: "rate_limited",
        },
        { status: 429 }
      )
    }

    // Cota estourada? Corta antes de assinar a URL. A cobrança real continua
    // no upload-complete (único ponto com a duração), mas não faz sentido
    // deixar subir 500MB pra recusar depois.
    const { sub, plan } = await getSubscriptionWithUsage(session.user.id)
    if (sub.minutesUsed >= sub.minutesLimit) {
      return NextResponse.json(
        {
          error: `Monthly limit reached (${sub.minutesUsed}/${sub.minutesLimit} minutes used). Upgrade your plan to keep going.`,
          code: "quota_exceeded",
        },
        { status: 402 }
      )
    }

    // Caps de quantidade — limpa órfãos antigos primeiro pra um upload
    // abandonado ontem não bloquear o usuário hoje.
    await cleanupAbandonedUploads(session.user.id)

    // Limite de vídeos guardados por plano (failed não conta; delete libera vaga).
    const stored = await prisma.videoProject.count({
      where: { userId: session.user.id, status: { not: "failed" } },
    })
    if (stored >= plan.maxProjects) {
      return NextResponse.json(
        {
          error: `Your ${plan.name} plan allows up to ${plan.maxProjects} videos. Delete old videos or upgrade to keep going.`,
          code: "project_limit_reached",
        },
        { status: 402 }
      )
    }

    const pending = await prisma.videoProject.count({
      where: { userId: session.user.id, status: "uploading" },
    })
    if (pending >= MAX_PENDING_UPLOADS) {
      return NextResponse.json(
        {
          error: `You have ${pending} uploads in progress. Wait for them to finish before starting another.`,
          code: "too_many_pending",
        },
        { status: 429 }
      )
    }

    const body = await req.json().catch(() => null)
    const filename = typeof body?.filename === "string" ? body.filename : ""
    const contentType =
      typeof body?.contentType === "string" ? body.contentType : ""
    const size = typeof body?.size === "number" ? body.size : NaN

    const ext = EXTENSION_BY_TYPE[contentType]
    if (!ext) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a video file." },
        { status: 400 }
      )
    }

    if (!Number.isFinite(size) || size <= 0 || size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 500MB." },
        { status: 400 }
      )
    }

    const title =
      filename.replace(/\.[^/.]+$/, "").slice(0, 200) || "Untitled Video"

    const videoProject = await prisma.videoProject.create({
      data: {
        userId: session.user.id,
        title,
        videoUrl: "", // preenchida logo abaixo com a key definitiva
        status: "uploading",
        subtitleStyle: {
          fontFamily: "Montserrat",
          fontSize: 24,
          color: "#FFFF00",
          backgroundColor: "#FF00FF",
          backgroundOpacity: 0.8,
          position: "bottom",
          alignment: "center",
          outline: true,
          outlineColor: "#000000",
          outlineWidth: 2,
        },
      },
    })

    const key = projectKey(videoProject.id, `original.${ext}`)

    await prisma.videoProject.update({
      where: { id: videoProject.id },
      data: { videoUrl: key },
    })

    const uploadUrl = await presignPutUrl(
      key,
      contentType,
      UPLOAD_URL_EXPIRY_SECONDS
    )

    return NextResponse.json({
      success: true,
      projectId: videoProject.id,
      uploadUrl,
      expiresAt: new Date(
        Date.now() + UPLOAD_URL_EXPIRY_SECONDS * 1000
      ).toISOString(),
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: "Failed to start upload" },
      { status: 500 }
    )
  }
}
