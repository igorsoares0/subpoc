import type { NextAuthConfig } from "next-auth"

// Edge-safe config: NO prisma/bcrypt imports here, so it can be used by
// middleware (Edge runtime). The Credentials provider (which needs the DB)
// lives in auth.ts instead.
const PROTECTED_PREFIXES = ["/dashboard", "/editor", "/render"]

export default {
  providers: [],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // Runs in middleware for every matched request.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isProtected = PROTECTED_PREFIXES.some((p) =>
        nextUrl.pathname.startsWith(p)
      )
      if (isProtected) return isLoggedIn
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
} satisfies NextAuthConfig
