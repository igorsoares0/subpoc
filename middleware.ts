import NextAuth from "next-auth"
import authConfig from "./auth.config"

// Edge-safe instance (no DB providers) used only to evaluate the `authorized`
// callback. Route handlers/pages still call `auth()` from auth.ts as before.
export default NextAuth(authConfig).auth

export const config = {
  // Run on everything except Next internals, the auth API, and static assets.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
