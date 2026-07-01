import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "./lib/prisma"
import authConfig from "./auth.config"
import { rateLimit, getClientIp } from "./lib/rate-limit"

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const normalizedEmail = (credentials.email as string).trim().toLowerCase()

        // Throttle credential attempts by IP and by targeted email. NextAuth
        // collapses a null return into a generic CredentialsSignin error, so a
        // rate-limited user just sees "invalid credentials".
        const ip = getClientIp(request)
        const ipRl = await rateLimit(`login:ip:${ip}`, 10, 900)
        const emailRl = await rateLimit(`login:email:${normalizedEmail}`, 5, 900)
        if (!ipRl.ok || !emailRl.ok) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: {
            email: normalizedEmail,
          },
        })

        if (!user || !user.password) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        // Block sign-in until the email address is verified.
        if (!user.emailVerified) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        }
      },
    }),
  ],
})
