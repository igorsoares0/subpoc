import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createPasswordResetToken } from "@/lib/tokens"
import { sendPasswordResetEmail } from "@/lib/email"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

// Always returns the same generic response regardless of whether the email
// exists, to avoid leaking which addresses have accounts (user enumeration).
const GENERIC_RESPONSE = {
  message: "If an account exists for that email, we've sent a reset link.",
}

export async function POST(req: Request) {
  try {
    // Per-IP throttle. A 429 here reveals nothing about account existence since
    // it fires on attempts regardless of whether the email is registered.
    const ip = getClientIp(req)
    const ipRl = await rateLimit(`forgot:ip:${ip}`, 5, 3600)
    if (!ipRl.ok) {
      return NextResponse.json(GENERIC_RESPONSE, {
        status: 429,
        headers: { "Retry-After": String(ipRl.retryAfter) },
      })
    }

    const { email } = await req.json()

    if (!email || typeof email !== "string") {
      return NextResponse.json(GENERIC_RESPONSE)
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Per-email throttle to stop targeting a single inbox with reset spam.
    const emailRl = await rateLimit(`forgot:email:${normalizedEmail}`, 3, 3600)
    if (!emailRl.ok) {
      return NextResponse.json(GENERIC_RESPONSE, {
        status: 429,
        headers: { "Retry-After": String(emailRl.retryAfter) },
      })
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    // Only send if the user actually exists, but never reveal that fact.
    if (user) {
      try {
        const rawToken = await createPasswordResetToken(normalizedEmail)
        await sendPasswordResetEmail(normalizedEmail, rawToken)
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError)
      }
    }

    return NextResponse.json(GENERIC_RESPONSE)
  } catch (error) {
    console.error("Forgot password error:", error)
    // Still return generic to avoid leaking anything via error differences.
    return NextResponse.json(GENERIC_RESPONSE)
  }
}
