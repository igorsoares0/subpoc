import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import EditorClient from "./editor-client"

interface EditorPageProps {
  params: {
    id: string
  }
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

  return <EditorClient video={video} />
}
