import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Configuração de polling para filmstrip
 */
const POLLING_CONFIG = {
  INITIAL_INTERVAL: 2000,      // Começa verificando a cada 2s
  MAX_INTERVAL: 5000,          // Aumenta até no máximo 5s
  BACKOFF_MULTIPLIER: 1.2,     // Aumenta 20% a cada tentativa
  MAX_DURATION: 300000,        // Timeout máximo: 5 minutos
  MAX_RETRIES: 90              // Máximo de tentativas (5min / 2s avg = ~150 tentativas)
} as const

/**
 * Estado do filmstrip durante o ciclo de vida de geração
 */
type FilmstripStatus = 'loading' | 'canvas-ready' | 'filmstrip-ready' | 'error'

/**
 * Metadata do filmstrip gerado pelo backend
 */
interface FilmstripMetadata {
  frameCount: number
  frameWidth: number
  frameHeight: number
  totalWidth: number
  fileSize: number
}

/**
 * Estado completo do filmstrip
 */
interface FilmstripState {
  status: FilmstripStatus
  canvasFrames: string[]      // Data URLs dos frames extraídos via Canvas
  filmstripUrl: string | null  // URL do sprite sheet do backend
  metadata: FilmstripMetadata | null
  error: string | null
}

/**
 * Extrai frames do vídeo usando Canvas API
 *
 * Esta função fornece feedback visual imediato ao usuário enquanto
 * o filmstrip de alta qualidade é gerado no backend.
 *
 * @param videoUrl URL do vídeo
 * @param frameCount Número de frames a extrair
 * @param frameWidth Largura de cada frame
 * @param frameHeight Altura de cada frame
 * @returns Array de data URLs dos frames
 */
async function extractFramesWithCanvas(
  videoUrl: string,
  frameCount: number = 25,
  frameWidth: number = 160,
  frameHeight: number = 90
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      reject(new Error('Could not get canvas context'))
      return
    }

    const frames: string[] = []
    let settled = false
    let timedOut = false

    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(safetyTimeout)

      // Liberar o elemento de vídeo (aborta downloads/seeks pendentes)
      video.removeAttribute('src')
      video.load()

      // Preview é best-effort: se o tempo acabou mas já temos frames,
      // entregar os parciais em vez de estourar erro
      if (error && frames.length === 0) {
        reject(error)
      } else {
        console.log(`[Canvas] ✓ Extracted ${frames.length}/${frameCount} frames${timedOut ? ' (partial, timed out)' : ''}`)
        resolve(frames)
      }
    }

    // crossOrigin precisa vir ANTES do src: o atributo só vale para requests
    // iniciados depois dele. O vídeo agora vem do R2 (outra origem), então
    // sem CORS-mode o load falha e o canvas ficaria tainted.
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.preload = 'metadata'
    video.src = videoUrl

    video.onloadeddata = async () => {
      try {
        const duration = video.duration
        canvas.width = frameWidth
        canvas.height = frameHeight

        console.log(`[Canvas] Extracting ${frameCount} frames from ${duration}s video`)

        for (let i = 0; i < frameCount && !timedOut; i++) {
          // Calcular timestamp para este frame
          const timestamp = (i / (frameCount - 1)) * duration

          // Seek para o timestamp
          video.currentTime = timestamp

          // Aguardar o seek completar, com timeout individual: em vídeo
          // remoto um único seek travado não pode consumir o budget inteiro
          const seeked = await new Promise<boolean>((seekResolve) => {
            const seekTimer = setTimeout(() => {
              video.removeEventListener('seeked', handleSeeked)
              seekResolve(false)
            }, 5000)

            const handleSeeked = () => {
              clearTimeout(seekTimer)
              video.removeEventListener('seeked', handleSeeked)
              seekResolve(true)
            }
            video.addEventListener('seeked', handleSeeked)
          })

          if (!seeked || settled) break

          // Desenhar frame no canvas
          ctx.drawImage(video, 0, 0, frameWidth, frameHeight)

          // Converter para data URL (JPEG com qualidade 0.7 para reduzir tamanho)
          frames.push(canvas.toDataURL('image/jpeg', 0.7))
        }

        finish()

      } catch (error) {
        console.error('[Canvas] Error during extraction:', error)
        finish(error instanceof Error ? error : new Error('Frame extraction failed'))
      }
    }

    video.onerror = () => {
      finish(new Error('Failed to load video for frame extraction'))
    }

    // Timeout de segurança global (30s): entrega frames parciais se houver
    const safetyTimeout = setTimeout(() => {
      timedOut = true
      finish(new Error('Frame extraction timed out'))
    }, 30000)
  })
}

/**
 * Acima desta duração o preview via Canvas nem é tentado: cada seek em vídeo
 * remoto (R2) vira range requests, e 20-30 seeks num vídeo longo estouram
 * qualquer timeout. O skeleton fica até o filmstrip do backend chegar.
 */
const CANVAS_PREVIEW_MAX_DURATION_S = 180

/**
 * Calcula o número de frames baseado na duração do vídeo
 * Deve corresponder à lógica do backend para consistência
 */
function calculateFrameCount(durationSeconds: number): number {
  if (durationSeconds <= 30) return 15
  if (durationSeconds <= 180) return 20
  if (durationSeconds <= 600) return 25
  return 30
}

/**
 * Hook customizado para gerenciar o filmstrip da timeline
 *
 * Implementa uma abordagem híbrida:
 * 1. Extrai frames via Canvas API (1-3s) para feedback imediato
 * 2. Triggera geração no backend em paralelo
 * 3. Faz polling até filmstrip estar pronto
 * 4. Swap suave de Canvas frames para filmstrip de alta qualidade
 *
 * @param videoId ID do vídeo
 * @param videoUrl URL do vídeo
 * @param duration Duração do vídeo em segundos
 * @returns Estado do filmstrip e ações
 */
export function useFilmstrip(
  videoId: string,
  videoUrl: string,
  duration: number
) {
  const [filmstripState, setFilmstripState] = useState<FilmstripState>({
    status: 'loading',
    canvasFrames: [],
    filmstripUrl: null,
    metadata: null,
    error: null
  })

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const pollingStartTimeRef = useRef<number>(0)
  const pollingAttemptsRef = useRef<number>(0)
  const currentIntervalRef = useRef<number>(POLLING_CONFIG.INITIAL_INTERVAL)
  const isMountedRef = useRef(true)

  /**
   * Para o polling e limpa todos os refs
   */
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }

    // Resetar refs de tracking
    pollingAttemptsRef.current = 0
    currentIntervalRef.current = POLLING_CONFIG.INITIAL_INTERVAL
  }, [])

  /**
   * Verifica se o filmstrip está pronto no backend
   * Implementa timeout global e backoff progressivo
   */
  const checkFilmstripReady = useCallback(async () => {
    if (!isMountedRef.current) {
      console.log('[Filmstrip] Component unmounted, skipping check')
      stopPolling()
      return
    }

    // Verificar timeout global
    const elapsed = Date.now() - pollingStartTimeRef.current
    if (elapsed > POLLING_CONFIG.MAX_DURATION) {
      console.error(`[Filmstrip] Polling timed out after ${elapsed}ms`)
      stopPolling()

      if (isMountedRef.current) {
        setFilmstripState(prev => ({
          ...prev,
          // Manter canvas frames se disponível, apenas logar erro
          error: 'Filmstrip generation timed out'
        }))
      }
      return
    }

    // Verificar número máximo de tentativas
    pollingAttemptsRef.current++
    if (pollingAttemptsRef.current > POLLING_CONFIG.MAX_RETRIES) {
      console.error(`[Filmstrip] Max retries (${POLLING_CONFIG.MAX_RETRIES}) exceeded`)
      stopPolling()
      return
    }

    const attempt = pollingAttemptsRef.current
    console.log(`[Filmstrip] Polling attempt ${attempt} (elapsed: ${(elapsed / 1000).toFixed(1)}s, interval: ${currentIntervalRef.current}ms)`)

    try {
      const response = await fetch(`/api/videos/${videoId}/filmstrip`)

      if (response.ok) {
        const data = await response.json()

        console.log(`[Filmstrip] ✓ Backend filmstrip ready after ${attempt} attempts (${(elapsed / 1000).toFixed(1)}s)`)

        if (isMountedRef.current) {
          setFilmstripState(prev => ({
            ...prev,
            status: 'filmstrip-ready',
            filmstripUrl: data.filmstripUrl,
            metadata: data.metadata,
            error: null
          }))
        }

        // Parar polling
        stopPolling()

      } else if (response.status === 404) {
        // Filmstrip ainda não está pronto, continuar polling com backoff
        console.log(`[Filmstrip] Not ready yet (attempt ${attempt})`)

        // Implementar backoff progressivo
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)

          // Aumentar intervalo progressivamente até MAX_INTERVAL
          currentIntervalRef.current = Math.min(
            currentIntervalRef.current * POLLING_CONFIG.BACKOFF_MULTIPLIER,
            POLLING_CONFIG.MAX_INTERVAL
          )

          console.log(`[Filmstrip] Next check in ${currentIntervalRef.current}ms`)

          pollingIntervalRef.current = setInterval(
            checkFilmstripReady,
            currentIntervalRef.current
          )
        }

      } else {
        console.error(`[Filmstrip] Unexpected status: ${response.status}`)
        // Não parar polling em erros 5xx - pode ser temporário
        // Apenas logar e continuar
      }

    } catch (error) {
      console.error('[Filmstrip] Error checking filmstrip status:', error)
      // Não parar polling em erro de rede - pode ser temporário
      // Apenas logar e continuar tentando
    }
  }, [videoId, stopPolling])

  /**
   * Inicia o polling para verificar se o filmstrip está pronto
   * Implementa backoff progressivo e timeout global
   */
  const startPolling = useCallback(() => {
    // Parar polling existente se houver
    stopPolling()

    // Inicializar refs de tracking
    pollingStartTimeRef.current = Date.now()
    pollingAttemptsRef.current = 0
    currentIntervalRef.current = POLLING_CONFIG.INITIAL_INTERVAL

    console.log('[Filmstrip] Starting polling for backend filmstrip')
    console.log(`[Filmstrip] Max duration: ${POLLING_CONFIG.MAX_DURATION}ms, Initial interval: ${POLLING_CONFIG.INITIAL_INTERVAL}ms`)

    // Verificar imediatamente
    checkFilmstripReady()

    // Iniciar polling com intervalo inicial
    pollingIntervalRef.current = setInterval(
      checkFilmstripReady,
      currentIntervalRef.current
    )
  }, [checkFilmstripReady, stopPolling])

  /**
   * Cleanup quando componente desmonta
   */
  useEffect(() => {
    isMountedRef.current = true

    return () => {
      console.log('[Filmstrip] Component unmounting, stopping polling')
      isMountedRef.current = false
      stopPolling()
    }
  }, [stopPolling])

  /**
   * Triggera a geração do filmstrip no backend
   */
  const triggerBackendGeneration = async () => {
    try {
      console.log('[Filmstrip] Triggering backend generation')

      const response = await fetch(`/api/videos/${videoId}/filmstrip/generate`, {
        method: 'POST'
      })

      const data = await response.json()

      if (data.status === 'already_exists') {
        // Filmstrip já existe, usar diretamente
        console.log('[Filmstrip] Filmstrip already exists!')

        if (isMountedRef.current) {
          setFilmstripState({
            status: 'filmstrip-ready',
            canvasFrames: [],
            filmstripUrl: data.filmstripUrl,
            metadata: data.metadata,
            error: null
          })
        }
      } else if (data.status === 'processing') {
        // Geração iniciada, começar polling
        console.log('[Filmstrip] Backend generation started')
        startPolling()
      } else {
        throw new Error('Unexpected response from backend')
      }
    } catch (error) {
      console.error('[Filmstrip] Error triggering backend generation:', error)
      // Não é um erro fatal - usuário ainda tem os canvas frames
    }
  }

  /**
   * Efeito principal: orquestra a geração dual-track
   */
  useEffect(() => {
    let cancelled = false

    async function initialize() {
      try {
        // Primeiro, verificar se filmstrip já existe (cache)
        const cacheResponse = await fetch(`/api/videos/${videoId}/filmstrip`)

        if (cacheResponse.ok) {
          // Filmstrip existe, carregar diretamente
          const data = await cacheResponse.json()

          if (!cancelled && isMountedRef.current) {
            setFilmstripState({
              status: 'filmstrip-ready',
              canvasFrames: [],
              filmstripUrl: data.filmstripUrl,
              metadata: data.metadata,
              error: null
            })
          }

          console.log('[Filmstrip] ✓ Loaded from cache')

          // Fire-and-forget: garante a thumbnail do dashboard em projetos
          // antigos (o route responde already_exists barato quando o projeto
          // já tem filmstrip + thumbnail; senão regenera e faz o backfill)
          fetch(`/api/videos/${videoId}/filmstrip/generate`, { method: 'POST' })
            .catch(() => {})

          return
        }

        // Filmstrip não existe, iniciar geração dual-track
        console.log('[Filmstrip] No cache, starting dual-track generation')

        // 1. Backend PRIMEIRO: é a fonte definitiva do filmstrip. O preview
        //    via Canvas é best-effort e não pode atrasar nem derrubar isso
        //    (antes ele rodava primeiro e, ao estourar timeout em vídeo longo,
        //    o backend nem chegava a ser acionado).
        await triggerBackendGeneration()

        // 2. Preview via Canvas (feedback imediato), só em vídeos curtos
        if (duration <= CANVAS_PREVIEW_MAX_DURATION_S) {
          try {
            const frameCount = calculateFrameCount(duration)
            console.log('[Filmstrip] Extracting frames with Canvas API...')
            const canvasFrames = await extractFramesWithCanvas(videoUrl, frameCount)

            if (!cancelled && isMountedRef.current && canvasFrames.length > 0) {
              setFilmstripState(prev =>
                // O filmstrip do backend pode ter ficado pronto enquanto
                // extraíamos — não regredir o estado
                prev.status === 'filmstrip-ready'
                  ? prev
                  : { ...prev, status: 'canvas-ready', canvasFrames, error: null }
              )
            }
          } catch (canvasError) {
            // Preview é opcional: o polling do backend segue rodando e o
            // skeleton fica na tela até o filmstrip real chegar
            console.warn('[Filmstrip] Canvas preview failed (non-fatal):', canvasError)
          }
        } else {
          console.log(`[Filmstrip] Video too long (${duration}s), skipping canvas preview`)
        }

      } catch (error) {
        console.error('[Filmstrip] Initialization error:', error)

        if (!cancelled && isMountedRef.current) {
          setFilmstripState({
            status: 'error',
            canvasFrames: [],
            filmstripUrl: null,
            metadata: null,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
    }

    initialize()

    return () => {
      cancelled = true
    }
  }, [videoId, videoUrl, duration])

  return filmstripState
}
