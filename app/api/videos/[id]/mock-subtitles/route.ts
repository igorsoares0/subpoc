import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// POST - Add mock subtitles to a video
export async function POST(
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

    const { id } = await params

    // Verify ownership
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

    // Mock subtitles (Portuguese example)
    const mockSubtitles = [
      {
        id: 1,
        start: 0,
        end: 3.5,
        text: "Olá, bem-vindo ao vídeo"
      },
      {
        id: 2,
        start: 3.5,
        end: 7.2,
        text: "Hoje vamos falar sobre legendas"
      },
      {
        id: 3,
        start: 7.2,
        end: 11.0,
        text: "Vendo essas DIVISÕES entre os países árabes"
      },
      {
        id: 4,
        start: 11.0,
        end: 14.5,
        text: "É possível editar texto e estilo"
      },
      {
        id: 5,
        start: 14.5,
        end: 18.0,
        text: "Clique em qualquer legenda para editar"
      },
      {
        id: 6,
        start: 18.0,
        end: 22.0,
        text: "Use a aba Styles para mudar cores e fontes"
      },
      {
        id: 7,
        start: 22.0,
        end: 25.5,
        text: "As mudanças aparecem em tempo real"
      },
      {
        id: 8,
        start: 25.5,
        end: 29.0,
        text: "Você pode adicionar mais legendas facilmente"
      }
    ]

    // Update video with mock subtitles
    const updatedVideo = await prisma.videoProject.update({
      where: { id: id },
      data: {
        subtitles: mockSubtitles,
        status: "ready"
      }
    })

    return NextResponse.json({
      success: true,
      video: updatedVideo
    })
  } catch (error) {
    console.error("Error adding mock subtitles:", error)
    return NextResponse.json(
      { error: "Failed to add mock subtitles" },
      { status: 500 }
    )
  }
}
