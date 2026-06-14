import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { consumePasswordResetToken } from "@/lib/tokens"

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json()

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 })
    }

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      )
    }

    if (password.length < 8 || password.length > 200) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      )
    }

    const email = await consumePasswordResetToken(token)

    if (!email) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired." },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    // Scope by email; if the user was deleted meanwhile, updateMany is a no-op.
    await prisma.user.updateMany({
      where: { email },
      data: { password: hashedPassword },
    })

    return NextResponse.json({
      message: "Password updated successfully. You can now sign in.",
    })
  } catch (error) {
    console.error("Reset password error:", error)
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    )
  }
}
