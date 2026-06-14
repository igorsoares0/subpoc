"use client"

import { Suspense, useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Mail, Lock, Loader2, ArrowRight, CheckCircle2 } from "lucide-react"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Notices coming from other flows (verification, password reset, register).
  let notice = ""
  if (searchParams.get("verified")) notice = "Email verified! You can now sign in."
  else if (searchParams.get("reset")) notice = "Password updated! You can now sign in."
  else if (searchParams.get("registered")) notice = "Account created! Check your email to verify, then sign in."

  const queryError = searchParams.get("error")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        // Credentials provider returns a generic error for wrong password AND
        // for unverified accounts, so we surface both possibilities.
        setError("Invalid credentials, or your email isn't verified yet.")
      } else {
        router.push("/dashboard")
        router.refresh()
      }
    } catch {
      setError("Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {notice && (
        <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-300 px-4 py-3 rounded-xl text-[13px] mb-5">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {notice}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {(error || queryError === "invalid_token") && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-[13px]">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error || "That link is invalid or has expired."}
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-[12px] font-medium text-zinc-400 mb-2">
            Email
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-zinc-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-10 pr-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-[13px] text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 transition-colors"
              placeholder="you@example.com"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="password" className="block text-[12px] font-medium text-zinc-400">
              Password
            </label>
            <Link href="/forgot-password" className="text-[12px] text-blue-400 hover:text-blue-300 transition-colors">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-zinc-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full pl-10 pr-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-[13px] text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 transition-colors"
              placeholder="Enter your password"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-medium text-[13px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-[13px] text-zinc-600">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-blue-400 hover:text-blue-300 transition-colors">
            Sign up
          </Link>
        </p>
      </div>
    </>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#0c0c0e] flex items-center justify-center px-4 relative">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-blue-600/[0.04] rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-[400px] relative">
        <div className="mb-8 text-center">
          <Link href="/">
            <h1 className="text-[16px] font-bold tracking-wide bg-gradient-to-r from-[#2563eb] to-[#60a5fa] bg-clip-text text-transparent inline-block mb-3">
              SUPERTITLE
            </h1>
          </Link>
          <p className="text-[14px] text-zinc-500">Sign in to your account</p>
        </div>

        <div className="bg-[#16161a] rounded-2xl p-8 border border-white/[0.04]">
          <Suspense fallback={<Loader2 className="w-5 h-5 animate-spin text-zinc-500 mx-auto" />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
