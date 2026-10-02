"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2, MailCheck, AlertCircle, Link2Off } from "lucide-react"
import { AuthShell, AuthState } from "@/components/auth/AuthShell"
import { Button, buttonClass } from "@/components/ui/Button"

function BackToSignIn({ href = "/login" }: { href?: string }) {
  return (
    <Link href={href} className={buttonClass("secondary", "xl", "hover:text-paper")}>
      <ArrowLeft className="size-[15px]" />
      Back to sign in
    </Link>
  )
}

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
      <AuthState icon={Link2Off} tone="danger" title="Invalid" highlight="link" action={<BackToSignIn />}>
        This verification link is invalid or has expired.
      </AuthState>
    )
  }

  if (status === "success") {
    return (
      <AuthState
        icon={CheckCircle2}
        title="Email"
        highlight="verified"
        action={
          <Link href="/login?verified=1" className={buttonClass("primary", "2xl", "w-full hover:text-on-accent")}>
            Go to sign in
            <ArrowRight className="size-4" />
          </Link>
        }
      >
        Your account is active. You can sign in now.
      </AuthState>
    )
  }

  if (status === "error") {
    return (
      <AuthState icon={AlertCircle} tone="danger" title="Couldn't" highlight="verify" action={<BackToSignIn />}>
        {error}
      </AuthState>
    )
  }

  return (
    <AuthState
      icon={MailCheck}
      title="Confirm your"
      highlight="email"
      action={
        <Button size="2xl" onClick={verify} disabled={status === "loading"} className="w-full">
          {status === "loading" ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Verifying…
            </>
          ) : (
            <>
              Verify email
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      }
    >
      Click below to confirm your email address and activate your account.
    </AuthState>
  )
}

export default function VerifyEmailPage() {
  return (
    <AuthShell>
      <Suspense fallback={<Loader2 className="size-5 animate-spin text-ink-3 mx-auto" />}>
        <VerifyEmailForm />
      </Suspense>
    </AuthShell>
  )
}
