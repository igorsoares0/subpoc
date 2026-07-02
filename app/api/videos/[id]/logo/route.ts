import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { deleteObject, isR2Key, resolveMediaUrl } from "@/lib/r2"
import { unlink } from "fs/promises"
import path from "path"
import { existsSync } from "fs"

// DELETE - Remove logo from video
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const { id: videoId } = await params

    // Get video and verify ownership
    const video = await prisma.videoProject.findFirst({
      where: {
        id: videoId,
        userId: user.id
      }
    })

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 })
    }

    // Delete logo file if exists
    if (video.logoOverlay && typeof video.logoOverlay === 'object' && 'logoUrl' in video.logoOverlay) {
      const logoUrl = (video.logoOverlay as any).logoUrl
      if (logoUrl && typeof logoUrl === 'string') {
        if (isR2Key(logoUrl)) {
          await deleteObject(logoUrl).catch((e) =>
            console.error("[Logo] Failed to delete R2 object:", e)
          )
        } else if (logoUrl.startsWith('/')) {
          // Legado: arquivo local em public/
          const logoPath = path.join(process.cwd(), "public", logoUrl)
          if (existsSync(logoPath)) {
            await unlink(logoPath)
          }
        }
      }
    }

    // Remove logo overlay from video
    const updatedVideo = await prisma.videoProject.update({
      where: { id: videoId },
      data: {
        logoOverlay: Prisma.DbNull
      }
    })

    return NextResponse.json({
      message: "Logo removed successfully",
      video: updatedVideo
    })

  } catch (error) {
    console.error("Error removing logo:", error)
    return NextResponse.json(
      { error: "Failed to remove logo" },
      { status: 500 }
    )
  }
}

// PATCH - Update logo settings
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const { id: videoId } = await params
    const body = await request.json()
    const { logoOverlay } = body

    if (!logoOverlay) {
      return NextResponse.json({ error: "Logo overlay data required" }, { status: 400 })
    }

    // Verify video belongs to user
    const video = await prisma.videoProject.findFirst({
      where: {
        id: videoId,
        userId: user.id
      }
    })

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 })
    }

    // O cliente recebe a logoUrl ASSINADA (presigned), então não podemos
    // aceitar o logoUrl do body — sobrescreveria a key R2 no banco com uma
    // URL temporária. Preserva a key armazenada e aceita só as settings.
    const currentOverlay = (video.logoOverlay ?? {}) as Record<string, unknown>
    const nextOverlay = {
      ...currentOverlay,
      position: logoOverlay.position ?? currentOverlay.position,
      size: logoOverlay.size ?? currentOverlay.size,
      opacity: logoOverlay.opacity ?? currentOverlay.opacity,
    }

    const updatedVideo = await prisma.videoProject.update({
      where: { id: videoId },
      data: {
        logoOverlay: nextOverlay as any
      }
    })

    const stored = updatedVideo.logoOverlay as { logoUrl?: string }

    return NextResponse.json({
      message: "Logo settings updated successfully",
      logoOverlay: {
        ...stored,
        logoUrl: await resolveMediaUrl(stored?.logoUrl)
      }
    })

  } catch (error) {
    console.error("Error updating logo settings:", error)
    return NextResponse.json(
      { error: "Failed to update logo settings" },
      { status: 500 }
    )
  }
}
