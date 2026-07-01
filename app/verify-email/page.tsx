"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Loader2, ArrowRight, CheckCircle2, MailCheck } from "lucide-react"

function VerifyEmailForm() {
  const token = useSearchParams().get("token") || ""
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  )
  const [error, setError] = useState("")

  const verify = async () => {
    setStatus("loading")
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Something went wrong")
        setStatus("error")
      } else {
        setStatus("success")
      }
    } catch {
      setError("Something went wrong")
      setStatus("error")
    }
  }

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <p className="text-[14px] text-zinc-300">This verification link is invalid.</p>
        <Link
          href="/login"
          className="inline-block text-blue-400 hover:text-blue-300 text-[13px]"
        >
          Go to sign in
        </Link>
      </div>
    )
  }

  if (status === "success") {
    return (
      <div className="text-center space-y-4">
        <CheckCircle2 className="w-10 h-10 text-blue-400 mx-auto" />
        <p className="text-[15px] text-white font-medium">Email verified</p>
        <p className="text-[13px] text-zinc-400">Your account is active. You can sign in now.</p>
        <Link
          href="/login?verified=1"
          className="inline-block text-blue-400 hover:text-blue-300 text-[13px] transition-colors"
        >
          Go to sign in
        </Link>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="text-center space-y-4">
        <p className="text-[14px] text-zinc-300">{error}</p>
        <Link
          href="/login"
          className="inline-block text-blue-400 hover:text-blue-300 text-[13px]"
        >
          Go to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="text-center space-y-5">
      <MailCheck className="w-10 h-10 text-blue-400 mx-auto" />
      <p className="text-[13px] text-zinc-400">
        Click below to confirm your email address and activate your account.
      </p>
      <button
        onClick={verify}
        disabled={status === "loading"}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-medium text-[13px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === "loading" ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Verifying...
          </>
        ) : (
          <>
            Verify email
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </div>
  )
}

export default function VerifyEmailPage() {
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
          <p className="text-[14px] text-zinc-500">Confirm your email</p>
        </div>

        <div className="bg-surface rounded-2xl p-8 border border-white/[0.08]">
          <Suspense
            fallback={
              <Loader2 className="w-5 h-5 animate-spin text-zinc-500 mx-auto" />
            }
          >
            <VerifyEmailForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
