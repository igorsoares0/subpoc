import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { saveVideoLocally, getVideoDuration } from "@/lib/upload"

export async function POST(req: Request) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const formData = await req.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    // Validate file type
    const validTypes = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"]
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a video file." },
        { status: 400 }
      )
    }

    // Validate file size (max 500MB)
    const maxSize = 500 * 1024 * 1024 // 500MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 500MB." },
        { status: 400 }
      )
    }

    // Save video locally
    const videoUrl = await saveVideoLocally(file)

    // Get video duration (mock for now)
    const duration = await getVideoDuration(videoUrl)

    // Create video project in database
    const videoProject = await prisma.videoProject.create({
      data: {
        userId: session.user.id,
        title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
        videoUrl,
        duration: duration / 60, // Convert to minutes
        status: "ready", // Skip transcription for now
        // Add default subtitle style
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
          outlineWidth: 2
        }
      }
    })

    // Trigger filmstrip generation in background immediately after upload
    // This way when user opens the editor, filmstrip is already ready or processing
    const workerUrl = process.env.WORKER_URL || "http://localhost:8000"
    const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"

    console.log(`[Upload] Triggering filmstrip generation for video ${videoProject.id}`)

    // Don't await - let it run in background
    fetch(`${workerUrl}/generate-filmstrip`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        videoId: videoProject.id,
        videoUrl: videoProject.videoUrl,
        duration: duration, // Send in seconds
        webhookUrl: `${appUrl}/api/webhooks/filmstrip-complete`
      })
    }).catch(error => {
      // Log error but don't fail the upload
      console.error(`[Upload] Failed to trigger filmstrip generation:`, error)
    })

    return NextResponse.json({
      success: true,
      project: videoProject
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: "Failed to upload video" },
      { status: 500 }
    )
  }
}
