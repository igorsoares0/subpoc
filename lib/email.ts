import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

// During local dev the Resend sandbox sender (onboarding@resend.dev) can only
// deliver to your own Resend account email. We log the link so any test account
// can still be verified/reset without a real inbox.
const isDev = process.env.NODE_ENV !== "production"

const FROM = process.env.EMAIL_FROM || "Supertitle <onboarding@resend.dev>"
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000"

function layout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#0c0c0e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c0c0e;padding:40px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:440px;background:#16161a;border-radius:16px;border:1px solid rgba(255,255,255,0.06);padding:32px;">
            <tr><td style="color:#60a5fa;font-size:16px;font-weight:bold;letter-spacing:0.04em;padding-bottom:16px;">SUPERTITLE</td></tr>
            <tr><td style="color:#ffffff;font-size:18px;font-weight:600;padding-bottom:12px;">${title}</td></tr>
            <tr><td style="color:#a1a1aa;font-size:14px;line-height:1.6;">${bodyHtml}</td></tr>
          </table>
          <p style="color:#52525b;font-size:12px;margin-top:24px;">© ${new Date().getFullYear()} Supertitle</p>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin:20px 0;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;">${label}</a>`
}

export async function sendVerificationEmail(email: string, rawToken: string) {
  // Points at a page (not the API GET) so email scanners that prefetch links
  // can't consume the single-use token — verification requires a real click.
  const url = `${APP_URL}/verify-email?token=${rawToken}`

  if (isDev) {
    console.log(`\n[email] Verification link for ${email}:\n${url}\n`)
  }

  const html = layout(
    "Confirm your email",
    `<p>Welcome! Confirm your email address to activate your account.</p>
     ${button(url, "Verify email")}
     <p style="font-size:12px;color:#71717a;">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>`
  )

  const { error } = await resend.emails.send(
    {
      from: FROM,
      to: [email],
      subject: "Confirm your email",
      html,
    },
    { idempotencyKey: `verify-email/${rawToken}` }
  )

  if (error) {
    console.error("[email] Failed to send verification email:", error.message)
    throw new Error("Failed to send verification email")
  }
}

export async function sendPasswordResetEmail(email: string, rawToken: string) {
  const url = `${APP_URL}/reset-password?token=${rawToken}`

  if (isDev) {
    console.log(`\n[email] Password reset link for ${email}:\n${url}\n`)
  }

  const html = layout(
    "Reset your password",
    `<p>We received a request to reset your password. Click below to choose a new one.</p>
     ${button(url, "Reset password")}
     <p style="font-size:12px;color:#71717a;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email — your password won't change.</p>`
  )

  const { error } = await resend.emails.send(
    {
      from: FROM,
      to: [email],
      subject: "Reset your password",
      html,
    },
    { idempotencyKey: `reset-password/${rawToken}` }
  )

  if (error) {
    console.error("[email] Failed to send password reset email:", error.message)
    throw new Error("Failed to send password reset email")
  }
}

// Sent when someone tries to register with an email that already has an account.
// Lets the registration endpoint return an identical response for existing vs new
// emails (no user enumeration) while still helping the real owner recover.
export async function sendAccountExistsEmail(email: string) {
  const loginUrl = `${APP_URL}/login`
  const resetUrl = `${APP_URL}/forgot-password`

  if (isDev) {
    console.log(`\n[email] Account-exists notice for ${email} (login: ${loginUrl})\n`)
  }

  const html = layout(
    "You already have an account",
    `<p>Someone just tried to sign up using this email, but an account already exists.</p>
     <p>If it was you, just sign in. Forgot your password? You can reset it.</p>
     ${button(loginUrl, "Sign in")}
     <p style="font-size:12px;color:#71717a;">Didn't do this? You can safely ignore this email — no account was created or changed. Reset your password here: ${resetUrl}</p>`
  )

  const { error } = await resend.emails.send(
    {
      from: FROM,
      to: [email],
      subject: "You already have an account",
      html,
    },
    { idempotencyKey: `account-exists/${email}` }
  )

  if (error) {
    console.error("[email] Failed to send account-exists email:", error.message)
    throw new Error("Failed to send account-exists email")
  }
}
