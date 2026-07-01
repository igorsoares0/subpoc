import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { createEmailVerificationToken } from "@/lib/tokens"
import { sendVerificationEmail, sendAccountExistsEmail } from "@/lib/email"
import { rateLimit, getClientIp } from "@/lib/rate-limit"

// Identical success payload whether or not the email already exists, so the
// endpoint can't be used to enumerate registered accounts. The frontend shows a
// hardcoded "check your email" screen on any 2xx, so the copy here is unused.
const GENERIC_SUCCESS = {
  message: "Please check your email to finish setting up your account.",
}

export async function POST(req: Request) {
  try {
    // Throttle signups per IP to prevent mass account creation / email bombing.
    const ip = getClientIp(req)
    const rl = await rateLimit(`register:${ip}`, 5, 3600)
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente mais tarde." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      )
    }

    const { email, password, name } = await req.json()

    // Validação básica
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { error: "Invalid input" },
        { status: 400 }
      )
    }

    const normalizedEmail = email.trim().toLowerCase()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail) || normalizedEmail.length > 254) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      )
    }

    if (password.length < 8 || password.length > 200) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      )
    }

    // Verificar se usuário já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    })

    if (existingUser) {
      // Don't reveal that the account exists. Notify the real owner by email and
      // return the same success response as a fresh signup.
      try {
        await sendAccountExistsEmail(normalizedEmail)
      } catch (emailError) {
        console.error("Failed to send account-exists email:", emailError)
      }
      return NextResponse.json(GENERIC_SUCCESS, { status: 201 })
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 12)

    // Criar usuário
    await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name: name || null,
        subscription: {
          create: {
            status: "free",
            plan: "free",
            minutesUsed: 0,
            minutesLimit: 10
          }
        }
      },
      select: {
        id: true
      }
    })

    // Send the verification email. If it fails we still keep the account (the
    // user can request a new link), but we log it for visibility.
    try {
      const rawToken = await createEmailVerificationToken(normalizedEmail)
      await sendVerificationEmail(normalizedEmail, rawToken)
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError)
    }

    return NextResponse.json(
      GENERIC_SUCCESS,
      { status: 201 }
    )
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    )
  }
}
