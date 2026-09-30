"use client"

import { Suspense, useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Mail, Lock, Loader2, ArrowRight } from "lucide-react"
import { GoogleButton } from "@/components/auth/GoogleButton"
import { AuthShell, AuthHeading, AuthLink, OrDivider } from "@/components/auth/AuthShell"
import { Button } from "@/components/ui/Button"
import { Field, Input } from "@/components/ui/Field"
import { Banner } from "@/components/ui/Banner"

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
      {notice && <Banner>{notice}</Banner>}

      {(error || queryError) && (
        <Banner variant="danger">
          {error ||
            (queryError === "invalid_token"
              ? "That link is invalid or has expired."
              : "Couldn't sign in with Google. Please try again.")}
        </Banner>
      )}

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

        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-[12.5px] font-medium text-ink-2">
            <label htmlFor="password">Password</label>
            <Link
              href="/forgot-password"
              className="font-normal text-paper underline underline-offset-[3px] hover:text-accent-ink"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            icon={Lock}
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="Enter your password"
          />
        </div>

        <Button type="submit" size="lg" disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="size-[15px]" />
            </>
          )}
        </Button>
      </form>

      <OrDivider />

      <GoogleButton />

      <p className="text-[13px] text-ink-3 text-center">
        Don&apos;t have an account? <AuthLink href="/register">Sign up</AuthLink>
      </p>
    </>
  )
}

export default function LoginPage() {
  return (
    <AuthShell>
      <AuthHeading title="Sign in" subtitle="Welcome back to your projects." />
      <Suspense fallback={<Loader2 className="size-5 animate-spin text-ink-4 mx-auto" />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  )
}
