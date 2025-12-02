'use client'

import { useEffect, useRef, useState } from 'react'
import { useFilmstrip } from './useFilmstrip'

interface TimelineFilmstripProps {
  videoId: string
  videoUrl: string
  duration: number
  currentTime: number
  onSeek: (time: number) => void
}

export function TimelineFilmstrip({
  videoId,
  videoUrl,
  duration,
  currentTime,
  onSeek
}: TimelineFilmstripProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  const filmstripState = useFilmstrip(videoId, videoUrl, duration)

  const FRAME_HEIGHT = 55 // Altura fixa da timeline

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
    ctx.fillStyle = '#18181b' // zinc-900
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
      gradient.addColorStop(0, '#27272a')    // zinc-800
      gradient.addColorStop(0.5, '#3f3f46')  // zinc-700
      gradient.addColorStop(1, '#27272a')    // zinc-800

      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, containerWidth, FRAME_HEIGHT)
    }

    // Modo Error: Mostrar mensagem de erro
    else if (filmstripState.status === 'error') {
      ctx.fillStyle = '#18181b' // zinc-900
      ctx.fillRect(0, 0, containerWidth, FRAME_HEIGHT)

      ctx.fillStyle = '#ef4444' // red-500
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(
        `Error loading filmstrip: ${filmstripState.error || 'Unknown error'}`,
        containerWidth / 2,
        FRAME_HEIGHT / 2
      )
    }

  }, [filmstripState, containerWidth])

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
        className="w-full h-full rounded cursor-pointer hover:opacity-90 transition-opacity"
        onClick={handleClick}
      />

      {/* Indicador sutil e discreto quando filmstrip HD ainda está processando */}
      {filmstripState.status === 'canvas-ready' && (
        <div className="absolute top-1 right-1 bg-zinc-800/70 backdrop-blur-sm text-zinc-400 text-[9px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1">
          <div className="w-1 h-1 bg-purple-400 rounded-full animate-pulse" />
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
