import { createHash, timingSafeEqual } from "crypto"

/**
 * Autentica requests do worker Python (webhooks de transcrição/render/
 * filmstrip). O worker manda `Authorization: Bearer <WORKER_SECRET>` — o
 * mesmo secret já usado na direção Next.js → worker.
 *
 * Comparação via hash + timingSafeEqual para não vazar o tamanho/prefixo do
 * secret por timing.
 */
export function verifyWorkerRequest(req: Request): boolean {
  const secret = process.env.WORKER_SECRET
  if (!secret) return false

  const header = req.headers.get("authorization")
  if (!header?.startsWith("Bearer ")) return false

  const token = header.slice("Bearer ".length)
  const a = createHash("sha256").update(token).digest()
  const b = createHash("sha256").update(secret).digest()
  return timingSafeEqual(a, b)
}

export function unauthorizedWebhookResponse(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 })
}
