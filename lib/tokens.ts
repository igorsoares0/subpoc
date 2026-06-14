import { randomBytes, createHash } from "crypto"
import { prisma } from "./prisma"

// Email verification tokens live for 24h, password resets for 1h.
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000

// We send the raw token in the email/URL but only ever store its SHA-256 hash.
// That way a DB leak can't be used to verify accounts or reset passwords.
function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex")
}

function generateRawToken(): string {
  return randomBytes(32).toString("hex")
}

export async function createEmailVerificationToken(email: string): Promise<string> {
  const rawToken = generateRawToken()
  const token = hashToken(rawToken)
  const expires = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS)

  // Invalidate any previous verification tokens for this email.
  await prisma.verificationToken.deleteMany({ where: { identifier: email } })
  await prisma.verificationToken.create({
    data: { identifier: email, token, expires },
  })

  return rawToken
}

/**
 * Consumes an email verification token. Returns the email if valid (and deletes
 * the token), or null if invalid/expired.
 */
export async function consumeEmailVerificationToken(
  rawToken: string
): Promise<string | null> {
  const token = hashToken(rawToken)
  const record = await prisma.verificationToken.findUnique({ where: { token } })

  if (!record) return null

  // Always remove the token once looked up (single use), even if expired.
  await prisma.verificationToken.delete({ where: { token } }).catch(() => {})

  if (record.expires < new Date()) return null

  return record.identifier
}

export async function createPasswordResetToken(email: string): Promise<string> {
  const rawToken = generateRawToken()
  const token = hashToken(rawToken)
  const expires = new Date(Date.now() + PASSWORD_RESET_TTL_MS)

  // Only one active reset token per email.
  await prisma.passwordResetToken.deleteMany({ where: { email } })
  await prisma.passwordResetToken.create({
    data: { email, token, expires },
  })

  return rawToken
}

/**
 * Consumes a password reset token. Returns the email if valid (and deletes the
 * token), or null if invalid/expired.
 */
export async function consumePasswordResetToken(
  rawToken: string
): Promise<string | null> {
  const token = hashToken(rawToken)
  const record = await prisma.passwordResetToken.findUnique({ where: { token } })

  if (!record) return null

  await prisma.passwordResetToken.delete({ where: { token } }).catch(() => {})

  if (record.expires < new Date()) return null

  return record.email
}
