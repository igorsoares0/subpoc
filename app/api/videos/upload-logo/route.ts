import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { putObject, projectKey, resolveMediaUrl } from "@/lib/r2"

// Logo é pequena (≤5MB), então proxiar pelo Next.js é ok — o servidor valida
// e grava direto no R2 com credencial própria (sem presigned PUT aqui).
// SVG fica de fora de propósito: pode carregar script embutido.

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("logo") as File
    const videoId = formData.get("videoId") as string

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!videoId) {
      return NextResponse.json({ error: "No video ID provided" }, { status: 400 })
    }

    // Verify video belongs to user
    const video = await prisma.videoProject.findFirst({
      where: {
        id: videoId,
        userId: session.user.id
      }
    })

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 })
    }

    // Validate file
    const ext = ALLOWED_IMAGE_TYPES[file.type]
    if (!ext) {
      return NextResponse.json(
        { error: "Logo must be a PNG, JPEG or WebP image" },
        { status: 400 }
      )
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      return NextResponse.json({ error: "File size must be less than 5MB" }, { status: 400 })
    }

    // Upload para o R2 sob o prefixo do projeto (cleanup junto com o delete)
    const key = projectKey(videoId, `logo.${ext}`)
    const buffer = Buffer.from(await file.arrayBuffer())
    await putObject(key, buffer, file.type)

    // No banco fica a KEY; a URL assinada é gerada na leitura
    const logoOverlay = {
      logoUrl: key,
      position: "top-right" as const,
      size: 10,
      opacity: 0.8
    }

    const updatedVideo = await prisma.videoProject.update({
      where: { id: videoId },
      data: {
        logoOverlay: logoOverlay as any
      }
    })

    const storedOverlay = updatedVideo.logoOverlay as { logoUrl?: string }

    return NextResponse.json({
      message: "Logo uploaded successfully",
      logoOverlay: {
        ...storedOverlay,
        logoUrl: await resolveMediaUrl(storedOverlay?.logoUrl),
      }
    })

  } catch (error) {
    console.error("Error uploading logo:", error)
    return NextResponse.json(
      { error: "Failed to upload logo" },
      { status: 500 }
    )
  }
}
