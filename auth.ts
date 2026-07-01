import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import { prisma } from "./lib/prisma"
import authConfig from "./auth.config"
import { rateLimit, getClientIp } from "./lib/rate-limit"

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Adapter persists OAuth users/accounts to Postgres. Session stays JWT so the
  // Credentials provider keeps working — adapter + JWT is the supported combo.
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  ...authConfig,
  logger: {
    // CredentialsSignin is the normal "invalid login" path (authorize returned
    // null) — Auth.js throws it internally and logs a scary stack trace. Swallow
    // just that one; keep every other error visible.
    error(error) {
      if (error.name === "CredentialsSignin") return
      console.error(error)
    },
  },
  providers: [
    Google({
      // Links a Google sign-in to an existing password account when the email
      // matches. Safe here because both credentials signup (email verification
      // required) and Google prove ownership of the address.
      allowDangerousEmailAccountLinking: true,
    }),
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
  events: {
    // Fires only when the adapter creates a user — i.e. a first-time Google
    // sign-in. Credentials users are created by /api/auth/register (which already
    // seeds their free subscription), so this never runs for them.
    async createUser({ user }) {
      try {
        await prisma.subscription.create({
          data: {
            userId: user.id,
            status: "free",
            plan: "free",
            minutesUsed: 0,
            minutesLimit: 10,
          },
        })
      } catch (err) {
        console.error("[auth] Failed to seed subscription for new user:", err)
      }

      // Google already verified the email; mirror that so the account is fully
      // set up (and consistent if a password is later added via reset).
      if (!user.emailVerified) {
        await prisma.user.updateMany({
          where: { id: user.id, emailVerified: null },
          data: { emailVerified: new Date() },
        })
      }
    },
  },
})
