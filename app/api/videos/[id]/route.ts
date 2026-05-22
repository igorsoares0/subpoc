import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const ALLOWED_FORMATS = new Set([
  "youtube",
  "instagram_story",
  "instagram_feed",
  "classic",
  "tiktok",
  "original",
])

function sanitizePatchBody(body: unknown): Prisma.VideoProjectUpdateInput {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body")
  }
  const input = body as Record<string, unknown>
  const data: Prisma.VideoProjectUpdateInput = {}

  if ("title" in input) {
    if (typeof input.title !== "string" || input.title.length === 0 || input.title.length > 200) {
      throw new Error("Invalid title")
    }
    data.title = input.title
  }

  if ("subtitles" in input) {
    if (input.subtitles === null) {
      data.subtitles = Prisma.DbNull
    } else if (Array.isArray(input.subtitles)) {
      data.subtitles = input.subtitles as Prisma.InputJsonValue
    } else {
      throw new Error("Invalid subtitles")
    }
  }

  if ("subtitleStyle" in input) {
    if (input.subtitleStyle === null) {
      data.subtitleStyle = Prisma.DbNull
    } else if (typeof input.subtitleStyle === "object" && !Array.isArray(input.subtitleStyle)) {
      data.subtitleStyle = input.subtitleStyle as Prisma.InputJsonValue
    } else {
      throw new Error("Invalid subtitleStyle")
    }
  }

  if ("format" in input) {
    if (input.format !== null && (typeof input.format !== "string" || !ALLOWED_FORMATS.has(input.format))) {
      throw new Error("Invalid format")
    }
    data.format = input.format as string | null
  }

  if ("trim" in input) {
    if (input.trim === null) {
      data.trim = Prisma.DbNull
    } else {
      const t = input.trim as Record<string, unknown>
      if (
        typeof t !== "object" ||
        Array.isArray(t) ||
        typeof t.start !== "number" ||
        typeof t.end !== "number" ||
        !isFinite(t.start) ||
        !isFinite(t.end) ||
        t.start < 0 ||
        t.end <= t.start
      ) {
        throw new Error("Invalid trim")
      }
      data.trim = { start: t.start, end: t.end }
    }
  }

  return data
}

// GET - Get single video project
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Await params (Next.js 16 requirement)
    const { id } = await params

    const video = await prisma.videoProject.findUnique({
      where: {
        id: id,
        userId: session.user.id
      }
    })

    if (!video) {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ video })
  } catch (error) {
    console.error("Error fetching video:", error)
    return NextResponse.json(
      { error: "Failed to fetch video" },
      { status: 500 }
    )
  }
}

// PATCH - Update video project
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await req.json()

    let data: Prisma.VideoProjectUpdateInput
    try {
      data = sanitizePatchBody(body)
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Invalid body" },
        { status: 400 }
      )
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No updatable fields provided" },
        { status: 400 }
      )
    }

    // Await params (Next.js 16 requirement)
    const { id } = await params

    // Scope update by userId so cross-account writes fail at the DB layer,
    // not just at the ownership check.
    const result = await prisma.videoProject.updateMany({
      where: { id, userId: session.user.id },
      data,
    })

    if (result.count === 0) {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      )
    }

    const video = await prisma.videoProject.findUnique({ where: { id } })
    return NextResponse.json({ video })
  } catch (error) {
    console.error("Error updating video:", error)
    return NextResponse.json(
      { error: "Failed to update video" },
      { status: 500 }
    )
  }
}

// DELETE - Delete video project
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Await params (Next.js 16 requirement)
    const { id } = await params

    // Verify ownership
    const existingVideo = await prisma.videoProject.findUnique({
      where: {
        id: id,
        userId: session.user.id
      }
    })

    if (!existingVideo) {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      )
    }

    // Delete video
    await prisma.videoProject.delete({
      where: {
        id: id
      }
    })

    // TODO: Also delete the video file from disk

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting video:", error)
    return NextResponse.json(
      { error: "Failed to delete video" },
      { status: 500 }
    )
  }
}
