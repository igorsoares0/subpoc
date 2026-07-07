import type { Subscription } from "@prisma/client"
import { prisma } from "./prisma"
import { getPlan, type Plan } from "./plans"

// Avança o fim do período de mês em mês até ficar no futuro (cobre usuário
// que ficou meses sem entrar sem precisar de cron).
function nextPeriodEnd(from: Date, now: Date): Date {
  const end = new Date(from)
  while (end <= now) {
    end.setMonth(end.getMonth() + 1)
  }
  return end
}

// Retorna a subscription do usuário com o período de uso garantido.
// Renovações de plano pago são resetadas pelo webhook do Paddle
// (current_billing_period); este reset lazy cobre o plano free e serve de
// fallback caso um webhook se perca.
export async function getSubscriptionWithUsage(
  userId: string
): Promise<{ sub: Subscription; plan: Plan }> {
  let sub = await prisma.subscription.findUnique({ where: { userId } })

  // Usuários criados antes da subscription existir no fluxo de registro.
  if (!sub) {
    sub = await prisma.subscription.create({ data: { userId } })
  }

  const now = new Date()
  if (!sub.currentPeriodEnd || sub.currentPeriodEnd <= now) {
    sub = await prisma.subscription.update({
      where: { userId },
      data: {
        minutesUsed: 0,
        currentPeriodEnd: nextPeriodEnd(sub.currentPeriodEnd ?? now, now),
      },
    })
  }

  return { sub, plan: getPlan(sub.plan) }
}

// Minutos debitados por um vídeo: arredonda pra cima, mínimo 1.
export function minutesForDuration(durationSeconds: number): number {
  return Math.max(1, Math.ceil(durationSeconds / 60))
}
