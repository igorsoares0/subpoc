"use client"

import { useState } from "react"
import Link from "next/link"
import { Mail, Loader2, ArrowRight, CheckCircle2 } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      // Always show the same confirmation (no enumeration).
      setSubmitted(true)
    } catch {
      setSubmitted(true)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 relative">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-blue-600/[0.04] rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-[400px] relative">
        <div className="mb-8 text-center">
          <Link href="/">
            <h1 className="text-[16px] font-bold tracking-wide bg-gradient-to-r from-[#2563eb] to-[#60a5fa] bg-clip-text text-transparent inline-block mb-3">
              SUPERTITLE
            </h1>
          </Link>
          <p className="text-[14px] text-zinc-500">Reset your password</p>
        </div>

        <div className="bg-surface rounded-2xl p-8 border border-white/[0.08]">
          {submitted ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="w-10 h-10 text-blue-400 mx-auto" />
              <p className="text-[14px] text-zinc-300">
                If an account exists for that email, we&apos;ve sent a reset link.
              </p>
              <p className="text-[13px] text-zinc-500">
                Check your inbox and follow the instructions. The link expires in 1 hour.
              </p>
              <Link
                href="/login"
                className="inline-block text-blue-400 hover:text-blue-300 text-[13px] transition-colors"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <p className="text-[13px] text-zinc-400 mb-5">
                Enter your email and we&apos;ll send you a link to reset your password.
              </p>
              <form onSubmit={handleSubmit} className="space-y-5">
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

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-medium text-[13px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      Send reset link
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link href="/login" className="text-[13px] text-zinc-600 hover:text-zinc-400 transition-colors">
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
