import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { createEmailVerificationToken } from "@/lib/tokens"
import { sendVerificationEmail } from "@/lib/email"

export async function POST(req: Request) {
  try {
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
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      )
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 12)

    // Criar usuário
    const user = await prisma.user.create({
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
        id: true,
        email: true,
        name: true
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
      {
        message: "User created successfully. Please check your email to verify your account.",
        user
      },
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
