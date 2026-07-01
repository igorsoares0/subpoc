import Redis from "ioredis"

// Redis-backed fixed-window rate limiter with an in-memory fallback.
//
// Runs only in Node runtime (API routes + the Credentials `authorize`), never in
// middleware — Next middleware is Edge runtime and can't open a Redis TCP socket.
//
// When REDIS_URL is unset (e.g. local dev on Windows) we fall back to an
// in-memory Map. That is single-instance and resets on redeploy, so it's only
// meant for dev/MVP — set REDIS_URL in Coolify for real deployments.

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null

const memory = new Map<string, { count: number; resetAt: number }>()

export interface RateLimitResult {
  ok: boolean
  retryAfter: number // seconds until the window resets
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  const now = Date.now()

  if (redis) {
    try {
      const k = `rl:${key}`
      const count = await redis.incr(k)
      if (count === 1) await redis.expire(k, windowSec)
      const ttl = await redis.ttl(k)
      return { ok: count <= limit, retryAfter: ttl > 0 ? ttl : windowSec }
    } catch (err) {
      // Never let a Redis outage lock everyone out of login — fail open.
      console.error("[rate-limit] Redis error, allowing request:", err)
      return { ok: true, retryAfter: windowSec }
    }
  }

  const entry = memory.get(key)
  if (!entry || entry.resetAt < now) {
    memory.set(key, { count: 1, resetAt: now + windowSec * 1000 })
    return { ok: true, retryAfter: windowSec }
  }
  entry.count++
  return {
    ok: entry.count <= limit,
    retryAfter: Math.ceil((entry.resetAt - now) / 1000),
  }
}

// Behind Traefik/Coolify the real client IP arrives in X-Forwarded-For. If you
// later put Cloudflare in front, switch to the CF-Connecting-IP header instead.
export function getClientIp(req?: Request): string {
  if (!req) return "unknown"
  const xff = req.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  return req.headers.get("x-real-ip") ?? "unknown"
}
