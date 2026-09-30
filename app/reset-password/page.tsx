"use client"

import { Suspense, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Lock, Loader2, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react"
import { AuthShell, AuthHeading, AuthState } from "@/components/auth/AuthShell"
import { Button, buttonClass } from "@/components/ui/Button"
import { Field, Input } from "@/components/ui/Field"
import { Banner } from "@/components/ui/Banner"

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
      <AuthState
        icon={AlertCircle}
        tone="danger"
        title="Invalid"
        em="link"
        action={
          <Link href="/forgot-password" className={buttonClass("ghost", "md")}>
            Request a new link
          </Link>
        }
      >
        This reset link is invalid.
      </AuthState>
    )
  }

  if (success) {
    return (
      <AuthState icon={CheckCircle2} title="Password" em="updated">
        Redirecting to sign in…
      </AuthState>
    )
  }

  return (
    <>
      <AuthHeading title="Choose a new" em="password" />

      {error && <Banner variant="danger">{error}</Banner>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-[22px]">
        <Field label="New password">
          <Input
            icon={Lock}
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
        </Field>

        <Field label="Confirm password">
          <Input
            icon={Lock}
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Repeat your password"
          />
        </Field>

        <Button type="submit" size="lg" disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Updating…
            </>
          ) : (
            <>
              Update password
              <ArrowRight className="size-[15px]" />
            </>
          )}
        </Button>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <Suspense fallback={<Loader2 className="size-5 animate-spin text-ink-4 mx-auto" />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  )
}
