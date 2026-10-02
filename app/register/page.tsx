"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2, ArrowLeft, MailCheck } from "lucide-react"
import { GoogleButton } from "@/components/auth/GoogleButton"
import { AuthShell, AuthHeading, AuthLink, AuthState, OrDivider } from "@/components/auth/AuthShell"
import { Button, buttonClass } from "@/components/ui/Button"
import { Field, Input } from "@/components/ui/Field"
import { Banner } from "@/components/ui/Banner"
import { PLANS } from "@/lib/plans"

export default function RegisterPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Something went wrong")
      } else {
        setSubmitted(true)
      }
    } catch {
      setError("Something went wrong")
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
          highlight="email"
          action={
            <Link href="/login" className={buttonClass("secondary", "xl", "hover:text-paper")}>
              <ArrowLeft className="size-[15px]" />
              Back to sign in
            </Link>
          }
        >
          We sent a verification link to <b className="font-bold text-paper">{email}</b>. Click it, then
          sign in.
        </AuthState>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <AuthHeading
        title="Create your"
        highlight="account"
        subtitle={`${PLANS.free.minutesLimit} free minutes every month. No card needed.`}
      />

      {error && (
        <Banner variant="danger" compact>
          {error}
        </Banner>
      )}

      <GoogleButton label="Sign up with Google" />

      <OrDivider />

      <form onSubmit={handleSubmit} className="flex flex-col gap-[22px]">
        <Field label="Name">
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="Your name"
          />
        </Field>

        <Field label="Email">
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
          />
        </Field>

        <Field label="Password">
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

        <Button type="submit" size="2xl" disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Creating account…
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>

      <p className="text-[14px] text-ink-3 text-center">
        Already have an account? <AuthLink href="/login">Sign in</AuthLink>
      </p>
    </AuthShell>
  )
}
