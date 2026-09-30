"use client"

import { useState } from "react"
import Link from "next/link"
import { Mail, Loader2, ArrowRight, ArrowLeft, MailCheck } from "lucide-react"
import { AuthShell, AuthHeading, AuthLink, AuthState } from "@/components/auth/AuthShell"
import { Button, buttonClass } from "@/components/ui/Button"
import { Field, Input } from "@/components/ui/Field"

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

  if (submitted) {
    return (
      <AuthShell>
        <AuthState
          icon={MailCheck}
          title="Check your"
          em="email"
          action={
            <Link href="/login" className={buttonClass("ghost", "md")}>
              <ArrowLeft className="size-[15px]" />
              Back to sign in
            </Link>
          }
        >
          If an account exists for that email, we&apos;ve sent a reset link. The link expires in 1
          hour.
        </AuthState>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <AuthHeading
        title="Reset your"
        em="password"
        subtitle="Enter your email and we'll send you a link to reset your password."
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-[22px]">
        <Field label="Email">
          <Input
            icon={Mail}
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
          />
        </Field>

        <Button type="submit" size="lg" disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              Send reset link
              <ArrowRight className="size-[15px]" />
            </>
          )}
        </Button>
      </form>

      <p className="text-[13px] text-ink-3 text-center">
        Remembered it? <AuthLink href="/login">Back to sign in</AuthLink>
      </p>
    </AuthShell>
  )
}
