'use client'

import { useEffect, useRef, useState } from 'react'
import { useFilmstrip } from './useFilmstrip'

interface TimelineFilmstripProps {
  videoId: string
  videoUrl: string
  duration: number
  currentTime: number
  onSeek: (time: number) => void
  /** Strip height in px. */
  height?: number
}

export function TimelineFilmstrip({
  videoId,
  videoUrl,
  duration,
  currentTime,
  onSeek,
  height = 44
}: TimelineFilmstripProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  const filmstripState = useFilmstrip(videoId, videoUrl, duration)

  const FRAME_HEIGHT = height

  /**
   * Detecta mudanças no tamanho do container
   */
  useEffect(() => {
    if (!containerRef.current) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })

    resizeObserver.observe(containerRef.current)

    return () => resizeObserver.disconnect()
  }, [])

  /**
   * Renderiza frames no canvas quando estado muda
   */
  useEffect(() => {
    if (!canvasRef.current || containerWidth === 0) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d', {
      alpha: false,        // Opaco = rendering mais rápido
      desynchronized: true // Permite async rendering
    })

    if (!ctx) return

    // Configurar dimensões do canvas
    canvas.width = containerWidth
    canvas.height = FRAME_HEIGHT

    // Limpar canvas
    ctx.fillStyle = '#1D1D1A'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Modo 1: Renderizar frames extraídos via Canvas API
    if (filmstripState.status === 'canvas-ready' && filmstripState.canvasFrames.length > 0) {
      console.log('[Timeline] Rendering Canvas frames')

      const frameCount = filmstripState.canvasFrames.length
      const frameWidth = containerWidth / frameCount

      filmstripState.canvasFrames.forEach((dataUrl, i) => {
        const img = new Image()
        img.src = dataUrl

        img.onload = () => {
          const x = i * frameWidth
          ctx.drawImage(img, x, 0, frameWidth, FRAME_HEIGHT)
        }

        img.onerror = () => {
          console.error(`[Timeline] Failed to load canvas frame ${i}`)
        }
      })
    }

    // Modo 2: Renderizar sprite sheet de alta qualidade do backend
    else if (filmstripState.status === 'filmstrip-ready' && filmstripState.filmstripUrl) {
      console.log('[Timeline] Rendering filmstrip sprite sheet')

      const img = new Image()
      img.src = filmstripState.filmstripUrl

      img.onload = () => {
        // O sprite sheet é horizontal com frameCount frames lado a lado
        // Precisamos escalar horizontalmente para preencher o container

        const metadata = filmstripState.metadata
        if (!metadata) return

        const {totalWidth, frameHeight} = metadata

        // Desenhar o sprite sheet completo escalado para preencher o container
        ctx.drawImage(
          img,
          0, 0, totalWidth, frameHeight,     // Source: sprite sheet completo
          0, 0, containerWidth, FRAME_HEIGHT // Destination: container escalado
        )
      }

      img.onerror = () => {
        console.error('[Timeline] Failed to load filmstrip sprite sheet')
      }
    }

    // Modo Loading: Mostrar skeleton
    else if (filmstripState.status === 'loading') {
      // Skeleton com gradiente animado
      const gradient = ctx.createLinearGradient(0, 0, containerWidth, 0)
      gradient.addColorStop(0, '#2A2A26')
      gradient.addColorStop(0.5, '#4a4a44')
      gradient.addColorStop(1, '#2A2A26')

      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, containerWidth, FRAME_HEIGHT)
    }

    // Modo Error: Mostrar mensagem de erro
    else if (filmstripState.status === 'error') {
      ctx.fillStyle = '#1D1D1A'
      ctx.fillRect(0, 0, containerWidth, FRAME_HEIGHT)

      ctx.fillStyle = '#FF5A4E'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(
        `Error loading filmstrip: ${filmstripState.error || 'Unknown error'}`,
        containerWidth / 2,
        FRAME_HEIGHT / 2
      )
    }

  }, [filmstripState, containerWidth, FRAME_HEIGHT])

  /**
   * Manipula clique na timeline para fazer seek
   */
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const clickRatio = x / rect.width

    const seekTime = clickRatio * duration
    onSeek(seekTime)
  }

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: `${FRAME_HEIGHT}px` }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-pointer"
        onClick={handleClick}
      />

      {/* Indicador sutil e discreto quando filmstrip HD ainda está processando */}
      {filmstripState.status === 'canvas-ready' && (
        <div className="absolute top-1 right-1 bg-black/60 text-[#C9C6BB] font-mono text-[9px] font-medium px-1.5 py-0.5 rounded-xs flex items-center gap-1 pointer-events-none">
          <div className="w-1 h-1 bg-accent rounded-full animate-pulse" />
          HD
        </div>
      )}

      {/* Skeleton shimmer animation quando loading */}
      {filmstripState.status === 'loading' && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
      )}
    </div>
  )
}
