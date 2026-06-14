import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import EditorClient, { type VideoProject } from "./editor-client"

interface EditorPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function EditorPage({ params }: EditorPageProps) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  // Await params (Next.js 16 requirement)
  const { id } = await params

  // Fetch video project
  const video = await prisma.videoProject.findUnique({
    where: {
      id: id,
      userId: session.user.id
    }
  })

  if (!video) {
    redirect("/dashboard")
  }

  // Prisma returns Json fields as JsonValue; the editor consumes the concrete
  // stored shapes, so cast through unknown at this boundary.
  return <EditorClient video={video as unknown as VideoProject} />
}
