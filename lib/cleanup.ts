import { prisma } from "./prisma"
import { deletePrefix, isR2Key } from "./r2"

// Projetos que ficaram em "uploading" (cliente nunca chamou upload-complete —
// aba fechada, upload interrompido, ou abuso) viram lixo: linha no banco e
// possivelmente um objeto de até 500MB no R2. A presigned PUT expira em 1h,
// então depois de 24h não existe upload legítimo em andamento.
//
// Sem cron: roda oportunisticamente na criação de upload (antes do cap de
// pendentes, pra não bloquear usuário honesto com órfãos antigos) e na
// listagem do dashboard.

const ABANDONED_AFTER_MS = 24 * 60 * 60 * 1000

export async function cleanupAbandonedUploads(userId: string): Promise<number> {
  const cutoff = new Date(Date.now() - ABANDONED_AFTER_MS)

  const stale = await prisma.videoProject.findMany({
    where: { userId, status: "uploading", createdAt: { lt: cutoff } },
    select: { id: true, videoUrl: true },
  })

  for (const project of stale) {
    // R2 primeiro: se a linha do banco sumisse antes e o deletePrefix
    // falhasse, ninguém mais encontraria o prefixo pra re-tentar.
    if (isR2Key(project.videoUrl) && project.videoUrl) {
      try {
        const deleted = await deletePrefix(`projects/${project.id}/`)
        if (deleted > 0) {
          console.log(
            `[Cleanup] Removed ${deleted} R2 objects for abandoned upload ${project.id}`
          )
        }
      } catch (error) {
        console.error(
          `[Cleanup] Failed to clean R2 for abandoned upload ${project.id}:`,
          error
        )
        continue // mantém a linha pra tentar de novo na próxima passada
      }
    }
    await prisma.videoProject.delete({ where: { id: project.id } }).catch(() => {})
  }

  return stale.length
}
