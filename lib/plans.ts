// Fonte única de verdade dos planos. Os limites também estão no custom_data
// dos produtos no Paddle (informativo), mas o app só confia no que está aqui.
// Os price IDs são NEXT_PUBLIC_ porque o checkout overlay abre no browser.

export type PlanId = "free" | "starter" | "pro"

export interface Plan {
  id: PlanId
  name: string
  priceUsd: number
  priceId: string | null
  minutesLimit: number
  maxVideoMinutes: number
  features: string[]
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceUsd: 0,
    priceId: null,
    minutesLimit: 10,
    maxVideoMinutes: 2,
    features: [
      "10 minutes of video / month",
      "Videos up to 2 minutes",
      "Auto subtitles + editor",
    ],
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceUsd: 12,
    priceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER ?? null,
    minutesLimit: 30,
    maxVideoMinutes: 5,
    features: [
      "30 minutes of video / month",
      "Videos up to 5 minutes",
      "Auto subtitles + editor",
      "SRT / VTT export",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceUsd: 29,
    priceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO ?? null,
    minutesLimit: 120,
    maxVideoMinutes: 15,
    features: [
      "120 minutes of video / month",
      "Videos up to 15 minutes",
      "Auto subtitles + editor",
      "SRT / VTT export",
      "Custom logo / watermark",
      "Priority queue",
    ],
  },
}

export function getPlan(id: string | null | undefined): Plan {
  if (id && id in PLANS) return PLANS[id as PlanId]
  return PLANS.free
}

export function planFromPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null
  return Object.values(PLANS).find((p) => p.priceId === priceId) ?? null
}
