import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { consumeEmailVerificationToken } from "@/lib/tokens"

// POST (not GET) so that email security scanners / link prefetchers can't consume
// the single-use token by merely fetching the URL. The /verify-email page calls
// this after an explicit user click.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const token = body?.token

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 })
  }

  const email = await consumeEmailVerificationToken(token)

  if (!email) {
    return NextResponse.json(
      { error: "This verification link is invalid or has expired." },
      { status: 400 }
    )
  }

  // Mark the account verified (idempotent — updateMany won't fail if already set).
  await prisma.user.updateMany({
    where: { email, emailVerified: null },
    data: { emailVerified: new Date() },
  })

  return NextResponse.json({ message: "Email verified. You can now sign in." })
}
