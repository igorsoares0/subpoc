'use client'

import { useEffect, useState } from 'react'

/**
 * Grabs a single still from the project video (offscreen element, CORS
 * anonymous like useFilmstrip) so template tiles can be "previewed on your own
 * video". Returns null until ready, or if the frame can't be read (tainted
 * canvas / network) — callers fall back to a neutral dark frame.
 */
export function useVideoFrame(videoUrl: string | null | undefined, enabled: boolean): string | null {
  const [frame, setFrame] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !videoUrl || frame) return
    let cancelled = false
    const video = document.createElement('video')
    // crossOrigin must be set BEFORE src so the request is CORS-enabled.
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.preload = 'auto'
    video.playsInline = true

    const onLoaded = () => {
      const d = Number.isFinite(video.duration) ? video.duration : 0
      video.currentTime = d > 0 ? Math.min(d * 0.3, Math.max(d - 0.1, 0)) : 0
    }
    const onSeeked = () => {
      if (cancelled) return
      try {
        const w = 360
        const h = Math.round((video.videoHeight / video.videoWidth) * w) || 640
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d')?.drawImage(video, 0, 0, w, h)
        setFrame(canvas.toDataURL('image/jpeg', 0.75))
      } catch {
        // Tainted canvas (CORS) — keep the fallback.
      }
      video.removeAttribute('src')
      video.load()
    }

    video.addEventListener('loadedmetadata', onLoaded)
    video.addEventListener('seeked', onSeeked)
    video.src = videoUrl

    return () => {
      cancelled = true
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('seeked', onSeeked)
      video.removeAttribute('src')
      video.load()
    }
  }, [videoUrl, enabled, frame])

  return frame
}
