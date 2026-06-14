import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { consumeEmailVerificationToken } from "@/lib/tokens"

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get("token")

  if (!token) {
    return NextResponse.redirect(`${APP_URL}/login?error=invalid_token`)
  }

  const email = await consumeEmailVerificationToken(token)

  if (!email) {
    return NextResponse.redirect(`${APP_URL}/login?error=invalid_token`)
  }

  // Mark the account verified (idempotent — updateMany won't fail if already set).
  await prisma.user.updateMany({
    where: { email, emailVerified: null },
    data: { emailVerified: new Date() },
  })

  return NextResponse.redirect(`${APP_URL}/login?verified=1`)
}
