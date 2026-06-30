"use client"

import { Suspense, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Lock, Loader2, ArrowRight, CheckCircle2 } from "lucide-react"

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") || ""

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password !== confirm) {
      setError("Passwords don't match")
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Something went wrong")
      } else {
        setSuccess(true)
        setTimeout(() => router.push("/login?reset=1"), 1500)
      }
    } catch {
      setError("Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <p className="text-[14px] text-zinc-300">This reset link is invalid.</p>
        <Link href="/forgot-password" className="inline-block text-blue-400 hover:text-blue-300 text-[13px]">
          Request a new link
        </Link>
      </div>
    )
  }

  if (success) {
    return (
      <div className="text-center space-y-4">
        <CheckCircle2 className="w-10 h-10 text-blue-400 mx-auto" />
        <p className="text-[14px] text-zinc-300">Password updated. Redirecting to sign in...</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-[13px]">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="password" className="block text-[12px] font-medium text-zinc-400 mb-2">
          New password
        </label>
        <div className="relative">
          <Lock className="w-4 h-4 text-zinc-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full pl-10 pr-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-[13px] text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 transition-colors"
            placeholder="At least 8 characters"
          />
        </div>
      </div>

      <div>
        <label htmlFor="confirm" className="block text-[12px] font-medium text-zinc-400 mb-2">
          Confirm password
        </label>
        <div className="relative">
          <Lock className="w-4 h-4 text-zinc-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            className="w-full pl-10 pr-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-[13px] text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 transition-colors"
            placeholder="Repeat your password"
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
            Updating...
          </>
        ) : (
          <>
            Update password
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
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
          <p className="text-[14px] text-zinc-500">Choose a new password</p>
        </div>

        <div className="bg-surface rounded-2xl p-8 border border-white/[0.08]">
          <Suspense fallback={<Loader2 className="w-5 h-5 animate-spin text-zinc-500 mx-auto" />}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
