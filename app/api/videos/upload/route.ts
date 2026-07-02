import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { presignPutUrl, projectKey } from "@/lib/r2"

// Upload direto browser → R2 via presigned PUT.
// Esta rota só valida, cria o projeto e assina a URL — o arquivo nunca passa
// pelo Next.js (sem limite de body, sem banda do servidor).
//
// O Content-Type entra na assinatura: se o cliente mandar outro tipo, o R2
// rejeita o PUT. O tamanho declarado é validado aqui e re-verificado com HEAD
// em /upload-complete (que apaga o objeto se estourar o limite).

const MAX_SIZE_BYTES = 500 * 1024 * 1024 // 500MB
const UPLOAD_URL_EXPIRY_SECONDS = 60 * 60 // 1h para concluir o PUT

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
