import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { existsSync } from "fs"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"

export async function POST(request: NextRequest) {
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
        userId: user.id
      }
    })

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 })
    }

    // Validate file
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      return NextResponse.json({ error: "File size must be less than 5MB" }, { status: 400 })
    }

    // Create uploads/logos directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "logos")
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // Generate unique filename
    const fileExtension = file.name.split(".").pop()
    const uniqueName = `logo_${videoId}_${Date.now()}.${fileExtension}`
    const filePath = path.join(uploadsDir, uniqueName)

    // Save file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // URL path (relative to public)
    const logoUrl = `/uploads/logos/${uniqueName}`

    // Create default logo overlay config
    const logoOverlay = {
      logoUrl,
      position: "top-right" as const,
      size: 10,
      opacity: 0.8
    }

    // Update video with logo overlay
    const updatedVideo = await prisma.videoProject.update({
      where: { id: videoId },
      data: {
        logoOverlay: logoOverlay as any
      }
    })

    return NextResponse.json({
      message: "Logo uploaded successfully",
      logoOverlay: updatedVideo.logoOverlay
    })

  } catch (error) {
    console.error("Error uploading logo:", error)
    return NextResponse.json(
      { error: "Failed to upload logo" },
      { status: 500 }
    )
  }
}
