import { useState, useEffect, useCallback, useRef } from 'react'

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

    video.src = videoUrl
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.preload = 'metadata'

    const frames: string[] = []
    let currentFrame = 0

    video.onloadeddata = async () => {
      try {
        const duration = video.duration
        canvas.width = frameWidth
        canvas.height = frameHeight

        console.log(`[Canvas] Extracting ${frameCount} frames from ${duration}s video`)

        for (let i = 0; i < frameCount; i++) {
          // Calcular timestamp para este frame
          const timestamp = (i / (frameCount - 1)) * duration

          // Seek para o timestamp
          video.currentTime = timestamp

          // Aguardar o seek completar
          await new Promise<void>((seekResolve) => {
            const handleSeeked = () => {
              video.removeEventListener('seeked', handleSeeked)
              seekResolve()
            }
            video.addEventListener('seeked', handleSeeked)
          })

          // Desenhar frame no canvas
          ctx.drawImage(video, 0, 0, frameWidth, frameHeight)

          // Converter para data URL (JPEG com qualidade 0.7 para reduzir tamanho)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
          frames.push(dataUrl)

          currentFrame++
        }

        console.log(`[Canvas] ✓ Extracted ${frames.length} frames`)
        resolve(frames)

      } catch (error) {
        console.error('[Canvas] Error during extraction:', error)
        reject(error)
      }
    }

    video.onerror = () => {
      reject(new Error('Failed to load video for frame extraction'))
    }

    // Timeout de segurança (30s)
    setTimeout(() => {
      reject(new Error('Frame extraction timed out'))
    }, 30000)
  })
}

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
  const isMountedRef = useRef(true)

  /**
   * Limpa o intervalo de polling quando componente desmonta
   */
  useEffect(() => {
    return () => {
      isMountedRef.current = false
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  /**
   * Inicia o polling para verificar se o filmstrip está pronto
   */
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    console.log('[Filmstrip] Starting polling for backend filmstrip')

    // Verificar imediatamente
    checkFilmstripReady()

    // Continuar verificando a cada 2 segundos
    pollingIntervalRef.current = setInterval(() => {
      checkFilmstripReady()
    }, 2000)
  }, [videoId])

  /**
   * Verifica se o filmstrip está pronto no backend
   */
  const checkFilmstripReady = async () => {
    try {
      const response = await fetch(`/api/videos/${videoId}/filmstrip`)

      if (response.ok) {
        const data = await response.json()

        console.log('[Filmstrip] ✓ Backend filmstrip ready!')

        if (isMountedRef.current) {
          setFilmstripState(prev => ({
            ...prev,
            status: 'filmstrip-ready',
            filmstripUrl: data.filmstripUrl,
            metadata: data.metadata
          }))
        }

        // Parar polling
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
      } else if (response.status === 404) {
        // Filmstrip ainda não está pronto, continuar polling
        console.log('[Filmstrip] Not ready yet, continuing to poll...')
      } else {
        throw new Error(`Unexpected status: ${response.status}`)
      }
    } catch (error) {
      console.error('[Filmstrip] Error checking filmstrip status:', error)
      // Continuar tentando - não é um erro fatal
    }
  }

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
          return
        }

        // Filmstrip não existe, iniciar geração dual-track
        console.log('[Filmstrip] No cache, starting dual-track generation')

        // 1. Calcular número de frames
        const frameCount = calculateFrameCount(duration)

        // 2. Iniciar extração Canvas (feedback imediato)
        console.log('[Filmstrip] Extracting frames with Canvas API...')
        const canvasFrames = await extractFramesWithCanvas(videoUrl, frameCount)

        if (!cancelled && isMountedRef.current) {
          setFilmstripState({
            status: 'canvas-ready',
            canvasFrames,
            filmstripUrl: null,
            metadata: null,
            error: null
          })
        }

        // 3. Triggerar geração backend (alta qualidade, assíncrona)
        await triggerBackendGeneration()

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
