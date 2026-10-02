"use client"

import { Suspense, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2, Link2Off } from "lucide-react"
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
        icon={Link2Off}
        tone="danger"
        title="Invalid"
        highlight="link"
        action={
          <Link href="/forgot-password" className={buttonClass("secondary", "xl", "hover:text-paper")}>
            <ArrowLeft className="size-[15px]" />
            Request a new link
          </Link>
        }
      >
        This reset link is invalid or has expired.
      </AuthState>
    )
  }

  if (success) {
    return (
      <AuthState icon={CheckCircle2} title="Password" highlight="updated">
        Redirecting to sign in…
      </AuthState>
    )
  }

  return (
    <>
      <AuthHeading title="Choose a new" highlight="password" />

      {error && (
        <Banner variant="danger" compact>
          {error}
        </Banner>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-[22px]">
        <Field label="New password">
          <Input
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
            id="confirm"
            invalid={error === "Passwords don't match"}
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Repeat your password"
          />
        </Field>

        <Button type="submit" size="2xl" disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Updating…
            </>
          ) : (
            <>
              Update password
              <ArrowRight className="size-4" />
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
      <Suspense fallback={<Loader2 className="size-5 animate-spin text-ink-3 mx-auto" />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  )
}
