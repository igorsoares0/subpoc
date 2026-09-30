"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { VideoTimeline } from "@/components/timeline/VideoTimeline"
import { toast } from "@/lib/toast"
import {
  SubtitleTrack,
  HookOverlay,
  annotateSubtitleKeywords,
  clearSubtitleKeywords,
  normalizePosition,
  DEFAULT_SUBTITLE_STYLE,
  type Subtitle,
  type SubtitleStyle,
  type SubtitleWord,
  type HookOverlayData,
} from "@/lib/subtitle-track"
import { AlertTriangle, Download, Loader2, Move, RefreshCw, RotateCcw, X } from "lucide-react"
import { EditorHeader } from "@/components/editor/EditorHeader"
import { EditorRail } from "@/components/editor/EditorRail"
import { FloatingToolbar } from "@/components/editor/FloatingToolbar"
import { TranscriptPanel } from "@/components/editor/panels/TranscriptPanel"
import { StylePanel } from "@/components/editor/panels/StylePanel"
import { TextPanel } from "@/components/editor/panels/TextPanel"
import { OverlaysPanel } from "@/components/editor/panels/OverlaysPanel"
import { useVideoFrame } from "@/components/editor/useVideoFrame"
import { Button, IconButton } from "@/components/ui/Button"
import {
  formatShort,
  getFormatAspectRatio,
  getFormatLabel,
  type EditorPanel,
  type LogoOverlay,
} from "@/components/editor/types"

// Snapshot of everything undo/redo tracks (item 4).
interface EditorDoc {
  subtitles: Subtitle[] | null
  subtitleStyle: SubtitleStyle | null
  hookOverlay: HookOverlayData | null
  logoOverlay: LogoOverlay | null
  format: string | null
  trim: { start: number; end: number } | null
}

export interface VideoProject {
  id: string
  title: string
  videoUrl: string
  duration: number
  status: string
  subtitles: Subtitle[] | null
  subtitleStyle: SubtitleStyle | null
  hookOverlay: HookOverlayData | null
  logoOverlay: LogoOverlay | null
  format: string | null
  trim: { start: number; end: number } | null
  outputUrl: string | null
}

interface EditorClientProps {
  video: VideoProject
  user?: { name: string | null; email: string | null }
}

// Default hook/headline overlay used when the user first adds one (item 5).
const DEFAULT_HOOK: HookOverlayData = {
  text: "YOUR TITLE HERE",
  position: { x: 50, y: 12 },
  fontFamily: "Montserrat",
  fontSize: 40,
  fontWeight: 800,
  color: "#FFFFFF",
  backgroundColor: "#000000",
  backgroundOpacity: 0,
  outline: true,
  outlineColor: "#000000",
  outlineWidth: 4,
  uppercase: true,
}

export default function EditorClient({ video: initialVideo, user }: EditorClientProps) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [activePanel, setActivePanel] = useState<EditorPanel>("subtitles")
  const [video, setVideo] = useState(initialVideo)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(initialVideo.duration) // stored in seconds
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 })
  // Display size (CSS px) of the full preview frame — i.e. the aspect-ratio
  // wrapper. With a fixed format this equals the export canvas (video content
  // + letterbox bars); for "Original" it equals the video element box.
  const [frameDimensions, setFrameDimensions] = useState({ width: 0, height: 0 })
  const [nativeVideoWidth, setNativeVideoWidth] = useState(1920)
  // Source aspect ratio — sizes the preview frame for the "Original" format.
  const [nativeAspect, setNativeAspect] = useState<number | null>(null)
  // Stage (video area) content box, used to fit the preview frame.
  const stageRef = useRef<HTMLDivElement>(null)
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const [editingSubtitle, setEditingSubtitle] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)
  const [showRenderPreview, setShowRenderPreview] = useState(false)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const logoUpdateTimerRef = useRef<NodeJS.Timeout | null>(null)
  const hookUpdateTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [isDraggingSubtitle, setIsDraggingSubtitle] = useState(false)
  const subtitleUpdateTimerRef = useRef<NodeJS.Timeout | null>(null)
  // Canva-style resize via handles: corner = font size, side = box width
  const [resize, setResize] = useState<{
    handle: 'font' | 'width'
    centerX: number
    centerY: number
    startDist: number
    startFontSize: number
  } | null>(null)
  const formatUpdateTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [trim, setTrim] = useState<{ start: number; end: number } | null>(initialVideo.trim)
  const trimUpdateTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [isDraggingTrimHandle, setIsDraggingTrimHandle] = useState<'start' | 'end' | null>(null)
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<number | null>(null)
  // Which long-running job is in flight, so the polling loop knows what failed
  // and the retry banner can offer the right action.
  const activeJobRef = useRef<"transcribe" | "render" | null>(null)
  const [failedJob, setFailedJob] = useState<"transcribe" | "render" | null>(null)
  // Undo/redo history (item 4). Snapshots of the editable document, coalesced
  // by a debounce so a slider drag becomes a single undo step.
  const presentDocRef = useRef<EditorDoc | null>(null)
  const undoStackRef = useRef<EditorDoc[]>([])
  const redoStackRef = useRef<EditorDoc[]>([])
  const isApplyingHistoryRef = useRef(false)
  const historyTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // Resizable left sidebar (persisted). Clamped so it can't crowd out the preview.
  const [sidebarWidth, setSidebarWidth] = useState(340)
  useEffect(() => {
    const saved = localStorage.getItem('editor:sidebarWidth')
    if (saved) {
      const n = parseInt(saved, 10)
      if (!Number.isNaN(n)) setSidebarWidth(Math.min(520, Math.max(280, n)))
    }
  }, [])
  const handleSidebarResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = sidebarWidth
    let latest = startWidth
    const onMove = (ev: MouseEvent) => {
      latest = Math.min(520, Math.max(280, startWidth + (ev.clientX - startX)))
      setSidebarWidth(latest)
    }
    const onUp = () => {
      localStorage.setItem('editor:sidebarWidth', String(latest))
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
  }

  // Current subtitle based on video time (adjusted for trim)
  const displayTime = trim ? currentTime + trim.start : currentTime
  const currentSubtitle = video?.subtitles?.find(
    sub => displayTime >= sub.start && displayTime < sub.end
  )

  // Determine which subtitle should be highlighted (only one at a time)
  // Priority: manual selection > current time-based subtitle
  const highlightedSubtitleId = selectedSubtitleId || currentSubtitle?.id

  // Find the subtitle to display on video (based on highlighted ID)
  const displayedSubtitle = video?.subtitles?.find(sub => sub.id === highlightedSubtitleId)

  // Clear selected subtitle when current subtitle changes (only during playback)
  useEffect(() => {
    if (isPlaying && currentSubtitle && selectedSubtitleId && currentSubtitle.id !== selectedSubtitleId) {
      setSelectedSubtitleId(null)
    }
  }, [currentSubtitle?.id, isPlaying, selectedSubtitleId])

  // Polling for video updates
  const startPolling = () => {
    // Clear any existing interval
    if (pollingInterval) {
      clearInterval(pollingInterval)
    }

    console.log('[Polling] Started polling for video updates...')

    // Poll every 2 seconds
    const interval = setInterval(async () => {
      try {
        // cache:'no-store' + cache-buster: without this the browser keeps
        // serving the first ("transcribing") response, so the loop never sees
        // "ready" and the spinner runs forever until a manual refresh.
        const response = await fetch(`/api/videos/${video.id}?t=${Date.now()}`, {
          cache: 'no-store',
        })
        if (response.ok) {
          const data = await response.json()
          setVideo(data.video)

          // Stop polling when transcription/rendering reaches a terminal state.
          if (data.video.status === 'ready' || data.video.status === 'completed' || data.video.status === 'failed') {
            // Always clear the in-flight flags first so the spinner can never
            // get stuck (independent of what the status was when polling began).
            setIsTranscribing(false)
            setIsRendering(false)

            if (data.video.status === 'ready') {
              console.log('[Polling] Transcription complete! Subtitles loaded.')
              toast.success('Transcription complete')
            } else if (data.video.status === 'completed') {
              console.log('[Polling] Rendering complete! Video ready for download.')
              setShowRenderPreview(true)
              toast.success('Video rendered — ready to download')
            } else if (data.video.status === 'failed') {
              console.error('[Polling] Processing failed.')
              setFailedJob(activeJobRef.current)
            }

            activeJobRef.current = null
            clearInterval(interval)
            setPollingInterval(null)
            console.log('[Polling] Stopped polling.')
          }
        }
      } catch (error) {
        console.error('[Polling] Error:', error)
      }
    }, 2000)

    setPollingInterval(interval)
  }

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
  }, [pollingInterval])

  // Update current time and duration
  useEffect(() => {
    const videoElement = videoRef.current
    if (!videoElement) return

    const handleTimeUpdate = () => {
      const currentVideoTime = videoElement.currentTime

      if (trim) {
        // Enforce trim bounds
        if (currentVideoTime < trim.start) {
          videoElement.currentTime = trim.start
          return
        }
        if (currentVideoTime >= trim.end) {
          videoElement.currentTime = trim.start // Loop back to start
          videoElement.pause()
          setIsPlaying(false)
          return
        }

        // Set currentTime relative to trim start (0-based)
        setCurrentTime(currentVideoTime - trim.start)
      } else {
        setCurrentTime(currentVideoTime)
      }
    }

    const handlePlay = () => {
      // Start at trim.start if trim is active
      if (trim && videoElement.currentTime < trim.start) {
        videoElement.currentTime = trim.start
      }
      setIsPlaying(true)
      // Clear selected subtitle when video starts playing
      setSelectedSubtitleId(null)
    }

    const handlePause = () => setIsPlaying(false)

    const handleLoadedMetadata = () => {
      // Update duration when video metadata is loaded
      if (videoElement.duration && !isNaN(videoElement.duration)) {
        console.log(`[Editor] Video metadata loaded, duration: ${videoElement.duration}s`)
        // Set duration based on trim if active
        if (trim) {
          setDuration(trim.end - trim.start)
        } else {
          setDuration(videoElement.duration)
        }
      }
    }

    const handleVolumeChange = () => {
      // Sync muted state with video element
      setIsMuted(videoElement.muted)
    }

    videoElement.addEventListener("timeupdate", handleTimeUpdate)
    videoElement.addEventListener("play", handlePlay)
    videoElement.addEventListener("pause", handlePause)
    videoElement.addEventListener("loadedmetadata", handleLoadedMetadata)
    videoElement.addEventListener("volumechange", handleVolumeChange)

    // Trigger loadedmetadata if already loaded
    if (videoElement.readyState >= 1) {
      handleLoadedMetadata()
    }

    return () => {
      videoElement.removeEventListener("timeupdate", handleTimeUpdate)
      videoElement.removeEventListener("play", handlePlay)
      videoElement.removeEventListener("pause", handlePause)
      videoElement.removeEventListener("loadedmetadata", handleLoadedMetadata)
      videoElement.removeEventListener("volumechange", handleVolumeChange)
    }
  }, [trim])

  // Smooth playback clock. The native "timeupdate" event above only fires
  // ~4x/second, which makes the subtitle overlay (and the per-word entrance
  // animation) visibly stutter during playback. While playing, sample the video
  // clock once per animation frame instead, so the overlay tracks at the
  // display's refresh rate. timeupdate still handles scrubbing while paused.
  // (The final render is unaffected — the worker samples every frame.)
  useEffect(() => {
    if (!isPlaying) return
    const videoElement = videoRef.current
    if (!videoElement) return

    let raf = 0
    const tick = () => {
      const currentVideoTime = videoElement.currentTime
      if (trim) {
        if (currentVideoTime >= trim.end) {
          videoElement.currentTime = trim.start
          videoElement.pause()
          setIsPlaying(false)
          return // pause() tears this effect down; don't queue another frame
        }
        setCurrentTime(Math.max(currentVideoTime - trim.start, 0))
      } else {
        setCurrentTime(currentVideoTime)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(raf)
  }, [isPlaying, trim])

  // Calculate actual video dimensions (for responsive subtitles)
  useEffect(() => {
    const videoElement = videoRef.current
    if (!videoElement) return

    const updateVideoDimensions = () => {
      // Get container dimensions
      const containerRect = videoElement.getBoundingClientRect()

      // Get actual video dimensions (native resolution)
      const videoWidth = videoElement.videoWidth
      const videoHeight = videoElement.videoHeight
      const containerWidth = containerRect.width
      const containerHeight = containerRect.height

      if (videoWidth === 0 || videoHeight === 0) return

      // Calculate actual rendered dimensions with object-contain
      const videoAspect = videoWidth / videoHeight
      const containerAspect = containerWidth / containerHeight

      let actualWidth, actualHeight
      if (videoAspect > containerAspect) {
        // Video is wider - limited by width
        actualWidth = containerWidth
        actualHeight = containerWidth / videoAspect
      } else {
        // Video is taller - limited by height
        actualHeight = containerHeight
        actualWidth = containerHeight * videoAspect
      }

      console.log(`[Video Dimensions] Calculated: ${actualWidth.toFixed(0)}x${actualHeight.toFixed(0)} (native: ${videoWidth}x${videoHeight})`)
      setVideoDimensions({ width: actualWidth, height: actualHeight })
      setFrameDimensions({ width: containerWidth, height: containerHeight })
      setNativeVideoWidth(videoWidth)
      setNativeAspect(videoAspect)
    }

    videoElement.addEventListener('loadedmetadata', updateVideoDimensions)
    window.addEventListener('resize', updateVideoDimensions)

    // Recompute when the video element itself resizes — this fires when the
    // format dropdown changes the wrapper's aspect ratio, keeping the subtitle
    // overlay in sync without waiting for a window resize.
    const resizeObserver = new ResizeObserver(() => updateVideoDimensions())
    resizeObserver.observe(videoElement)

    // Trigger if already loaded
    if (videoElement.readyState >= 1) {
      updateVideoDimensions()
    }

    return () => {
      videoElement.removeEventListener('loadedmetadata', updateVideoDimensions)
      window.removeEventListener('resize', updateVideoDimensions)
      resizeObserver.disconnect()
    }
  }, [])

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) =>
      setStageSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Still from the user's own video for the Style panel's template tiles.
  const templateFrame = useVideoFrame(video.videoUrl, activePanel === "style")

  // Initialize video at trim.start when trim changes
  useEffect(() => {
    if (videoRef.current && trim) {
      videoRef.current.currentTime = trim.start
      setCurrentTime(0) // Display 0:00 at trim start
      setDuration(trim.end - trim.start)
      console.log(`[Trim] Initialized at trim start: ${trim.start}s`)
    } else if (videoRef.current && !trim && videoRef.current.duration) {
      // Reset to full duration when trim is cleared
      setDuration(videoRef.current.duration)
      console.log(`[Trim] Reset to full duration: ${videoRef.current.duration}s`)
    }
  }, [trim])

  // Cleanup logo update timer on unmount
  useEffect(() => {
    return () => {
      if (logoUpdateTimerRef.current) {
        clearTimeout(logoUpdateTimerRef.current)
      }
      if (hookUpdateTimerRef.current) {
        clearTimeout(hookUpdateTimerRef.current)
      }
    }
  }, [])

  // Handle subtitle dragging
  useEffect(() => {
    if (isDraggingSubtitle) {
      const handleMove = (e: MouseEvent) => handleSubtitleMouseMove(e)
      const handleUp = () => handleSubtitleMouseUp()

      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseup', handleUp)

      return () => {
        window.removeEventListener('mousemove', handleMove)
        window.removeEventListener('mouseup', handleUp)
      }
    }
  }, [isDraggingSubtitle, videoDimensions])

  // Handle subtitle resizing (font via corner handles, width via side handles)
  useEffect(() => {
    if (resize) {
      const handleMove = (e: MouseEvent) => handleResizeMove(e)
      const handleUp = () => setResize(null)

      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseup', handleUp)

      return () => {
        window.removeEventListener('mousemove', handleMove)
        window.removeEventListener('mouseup', handleUp)
      }
    }
  }, [resize, videoDimensions, video])

  // Handle trim handle dragging
  useEffect(() => {
    if (isDraggingTrimHandle) {
      window.addEventListener('mousemove', handleTrimHandleDrag)
      window.addEventListener('mouseup', handleTrimHandleDragEnd)

      return () => {
        window.removeEventListener('mousemove', handleTrimHandleDrag)
        window.removeEventListener('mouseup', handleTrimHandleDragEnd)
      }
    }
  }, [isDraggingTrimHandle, trim])

  // Keyboard shortcuts: I = trim start, O = trim end (power-user)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const v = videoRef.current

      // Seek within trim bounds (or full video when no trim).
      const seekBy = (delta: number) => {
        if (!v) return
        const lower = trim ? trim.start : 0
        const upper = trim ? trim.end : (v.duration || duration)
        v.currentTime = Math.max(lower, Math.min(v.currentTime + delta, upper))
      }

      if (e.key === ' ' || e.code === 'Space') {
        // preventDefault also stops Space from re-activating a focused button.
        e.preventDefault()
        if (v) {
          if (v.paused) v.play()
          else v.pause()
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        seekBy(5)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        seekBy(-5)
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault()
        setTrimStart()
      } else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault()
        setTrimEnd()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // currentTime intentionally omitted: the handler reads v.currentTime live,
    // so depending on it would re-bind the listener on every playback frame.
  }, [trim, duration])

  // Cleanup subtitle update timer on unmount
  useEffect(() => {
    return () => {
      if (subtitleUpdateTimerRef.current) {
        clearTimeout(subtitleUpdateTimerRef.current)
      }
    }
  }, [])

  // Cleanup trim update timer on unmount
  useEffect(() => {
    return () => {
      if (trimUpdateTimerRef.current) {
        clearTimeout(trimUpdateTimerRef.current)
      }
    }
  }, [])

  // Cleanup format update timer on unmount
  useEffect(() => {
    return () => {
      if (formatUpdateTimerRef.current) {
        clearTimeout(formatUpdateTimerRef.current)
      }
    }
  }, [])

  const transcribeVideo = async () => {
    setFailedJob(null)
    setIsTranscribing(true)
    activeJobRef.current = "transcribe"
    try {
      const response = await fetch(`/api/videos/${video.id}/transcribe`, {
        method: "POST"
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to transcribe video")
      }

      // Start polling for updates
      startPolling()
    } catch (error) {
      console.error("Error transcribing video:", error)
      toast.error(
        error instanceof Error ? error.message : "Failed to transcribe video",
        { label: "Try again", onClick: transcribeVideo }
      )
      setIsTranscribing(false)
      activeJobRef.current = null
    }
  }

  const exportSRT = () => {
    window.open(`/api/videos/${video.id}/export/srt`, '_blank')
  }

  const exportVTT = () => {
    window.open(`/api/videos/${video.id}/export/vtt`, '_blank')
  }

  const renderVideo = async () => {
    setFailedJob(null)
    setIsRendering(true)
    activeJobRef.current = "render"
    try {
      const response = await fetch(`/api/videos/${video.id}/render`, {
        method: "POST"
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to render video")
      }

      // Start polling for updates
      startPolling()
    } catch (error) {
      console.error("Error rendering video:", error)
      toast.error(
        error instanceof Error ? error.message : "Failed to render video",
        { label: "Try again", onClick: renderVideo }
      )
      setIsRendering(false)
      activeJobRef.current = null
    }
  }

  const downloadRenderedVideo = () => {
    window.open(`/api/videos/${video.id}/render`, '_blank')
  }

  const updateSubtitleText = async (id: number, newText: string) => {
    const updatedSubtitles = video.subtitles?.map(sub => {
      if (sub.id !== id) return sub

      // Rebuild words[] so word-group templates reflect the edit.
      // The video overlay + ffmpeg renderer both read sub.words for word-group
      // mode, so updating only sub.text leaves the rendered output stale.
      const tokens = newText.split(/\s+/).filter(Boolean)
      let newWords: SubtitleWord[] | undefined = sub.words

      if (sub.words && sub.words.length > 0) {
        if (tokens.length === 0) {
          newWords = []
        } else if (tokens.length === sub.words.length) {
          // Same word count: keep original timings, just swap the text
          // (typo fixes shouldn't shift highlight timing).
          newWords = sub.words.map((w, i) => ({ ...w, word: tokens[i] }))
        } else {
          // Word count changed: redistribute [sub.start, sub.end] across the
          // new tokens, proportionally to character length so longer words
          // get slightly more time.
          const totalChars = tokens.reduce((acc, t) => acc + t.length, 0) || tokens.length
          const totalDuration = Math.max(sub.end - sub.start, 0)
          let cursor = sub.start
          newWords = tokens.map((t, i) => {
            const share = totalChars > 0 ? (t.length || 1) / totalChars : 1 / tokens.length
            const wStart = cursor
            const wEnd = i === tokens.length - 1 ? sub.end : cursor + totalDuration * share
            cursor = wEnd
            return { word: t, start: wStart, end: wEnd }
          })
        }
      }

      return { ...sub, text: newText, words: newWords }
    })

    setVideo({ ...video, subtitles: updatedSubtitles || null })

    // Save to backend
    await saveSubtitles(updatedSubtitles)
  }

  // ── Cue CRUD ──────────────────────────────────────────────────────────────
  // All mutations go through commitSubtitles so local state + backend stay in
  // sync with a single debounced-free PATCH (these are discrete user actions).
  const getNextSubtitleId = (subs: Subtitle[]) =>
    subs.reduce((max, s) => Math.max(max, s.id), 0) + 1

  const commitSubtitles = (updated: Subtitle[]) => {
    setVideo({ ...video, subtitles: updated })
    void saveSubtitles(updated)
  }

  // Insert a new 2s cue at the current playhead, then jump straight into editing.
  const addSubtitleAtPlayhead = () => {
    const subs = video.subtitles ? [...video.subtitles] : []
    const videoDuration = videoRef.current?.duration || duration
    const start = Math.max(0, Math.min(displayTime, Math.max(0, videoDuration - 0.5)))
    const end = Math.min(start + 2, videoDuration || start + 2)
    const newSub: Subtitle = {
      id: getNextSubtitleId(subs),
      start,
      end,
      text: "New subtitle",
    }
    const updated = [...subs, newSub].sort((a, b) => a.start - b.start)
    commitSubtitles(updated)
    setSelectedSubtitleId(newSub.id)
    setEditingSubtitle(newSub.id)
  }

  // Split a cue in two at the playhead. Word-level timings (if present) are
  // partitioned so word-group templates stay accurate; otherwise the text is
  // divided proportionally to the time fraction.
  const splitSubtitleAtPlayhead = (sub: Subtitle) => {
    const t = displayTime
    if (t <= sub.start + 0.05 || t >= sub.end - 0.05) {
      toast.error("Move the playhead inside this subtitle to split it")
      return
    }
    const subs = video.subtitles ?? []
    const nextId = getNextSubtitleId(subs)

    let leftText = sub.text
    let rightText = ""
    let leftWords: SubtitleWord[] | undefined
    let rightWords: SubtitleWord[] | undefined

    if (sub.words && sub.words.length > 0) {
      leftWords = sub.words.filter((w) => w.start < t)
      rightWords = sub.words.filter((w) => w.start >= t)
      // Guard against an empty side when all words fall on one side of t.
      if (leftWords.length === 0) {
        leftWords = sub.words.slice(0, 1)
        rightWords = sub.words.slice(1)
      } else if (rightWords.length === 0) {
        leftWords = sub.words.slice(0, -1)
        rightWords = sub.words.slice(-1)
      }
      leftText = leftWords.map((w) => w.word).join(" ")
      rightText = rightWords.map((w) => w.word).join(" ")
    } else {
      const tokens = sub.text.split(/\s+/).filter(Boolean)
      const frac = (t - sub.start) / (sub.end - sub.start)
      const splitIdx = Math.min(
        Math.max(1, Math.round(frac * tokens.length)),
        Math.max(1, tokens.length - 1),
      )
      leftText = tokens.slice(0, splitIdx).join(" ")
      rightText = tokens.slice(splitIdx).join(" ")
    }

    const left: Subtitle = { ...sub, end: t, text: leftText, words: leftWords }
    const right: Subtitle = { id: nextId, start: t, end: sub.end, text: rightText, words: rightWords }

    const updated = subs
      .flatMap((s) => (s.id === sub.id ? [left, right] : [s]))
      .sort((a, b) => a.start - b.start)
    commitSubtitles(updated)
  }

  // Merge a cue with the one that follows it in time.
  const mergeWithNext = (sub: Subtitle) => {
    const subs = [...(video.subtitles ?? [])].sort((a, b) => a.start - b.start)
    const idx = subs.findIndex((s) => s.id === sub.id)
    if (idx < 0 || idx >= subs.length - 1) return
    const next = subs[idx + 1]
    const mergedWords =
      sub.words || next.words
        ? [...(sub.words ?? []), ...(next.words ?? [])]
        : undefined
    const merged: Subtitle = {
      ...sub,
      end: next.end,
      text: `${sub.text} ${next.text}`.trim(),
      words: mergedWords,
    }
    const updated = subs
      .filter((s) => s.id !== sub.id && s.id !== next.id)
      .concat(merged)
      .sort((a, b) => a.start - b.start)
    commitSubtitles(updated)
  }

  const deleteSubtitle = (id: number) => {
    const updated = (video.subtitles ?? []).filter((s) => s.id !== id)
    commitSubtitles(updated)
    if (selectedSubtitleId === id) setSelectedSubtitleId(null)
    if (editingSubtitle === id) setEditingSubtitle(null)
  }

  // Edit a cue's start/end (seconds). Clamps to keep a minimum 0.1s duration.
  const updateSubtitleTiming = (id: number, field: "start" | "end", value: number) => {
    if (Number.isNaN(value)) return
    const updated = (video.subtitles ?? []).map((s) => {
      if (s.id !== id) return s
      if (field === "start") {
        return { ...s, start: Math.max(0, Math.min(value, s.end - 0.1)) }
      }
      return { ...s, end: Math.max(s.start + 0.1, value) }
    })
    commitSubtitles(updated)
  }

  // ── Undo / Redo ─────────────────────────────────────────────────────────────
  const getEditorDoc = (): EditorDoc => ({
    subtitles: video.subtitles ?? null,
    subtitleStyle: video.subtitleStyle ?? null,
    hookOverlay: video.hookOverlay ?? null,
    logoOverlay: video.logoOverlay ?? null,
    format: video.format ?? null,
    trim,
  })

  const docsEqual = (a: EditorDoc, b: EditorDoc) =>
    JSON.stringify(a) === JSON.stringify(b)

  // Apply a snapshot to local state + backend. Sets a flag so the history
  // watcher doesn't record this programmatic change as a new step.
  const applyEditorDoc = (doc: EditorDoc) => {
    isApplyingHistoryRef.current = true
    setVideo((v) => ({
      ...v,
      subtitles: doc.subtitles,
      subtitleStyle: doc.subtitleStyle,
      hookOverlay: doc.hookOverlay,
      logoOverlay: doc.logoOverlay,
      format: doc.format,
    }))
    setTrim(doc.trim)
    void fetch(`/api/videos/${video.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subtitles: doc.subtitles,
        subtitleStyle: doc.subtitleStyle,
        hookOverlay: doc.hookOverlay,
        logoOverlay: doc.logoOverlay,
        format: doc.format,
        trim: doc.trim,
      }),
    }).catch((e) => console.error("Error persisting undo/redo:", e))
  }

  const undo = () => {
    if (undoStackRef.current.length === 0 || !presentDocRef.current) return
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current)
    const prev = undoStackRef.current.pop()!
    redoStackRef.current.push(presentDocRef.current)
    presentDocRef.current = prev
    applyEditorDoc(prev)
    setCanUndo(undoStackRef.current.length > 0)
    setCanRedo(true)
  }

  const redo = () => {
    if (redoStackRef.current.length === 0 || !presentDocRef.current) return
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current)
    const next = redoStackRef.current.pop()!
    undoStackRef.current.push(presentDocRef.current)
    presentDocRef.current = next
    applyEditorDoc(next)
    setCanRedo(redoStackRef.current.length > 0)
    setCanUndo(true)
  }

  // Keep latest undo/redo accessible to the (stable) keyboard effect.
  const undoRef = useRef(undo)
  const redoRef = useRef(redo)
  undoRef.current = undo
  redoRef.current = redo

  // Record a history step when the document settles. The debounce coalesces
  // rapid changes (slider drags, typing) into a single undo step.
  useEffect(() => {
    if (presentDocRef.current === null) {
      presentDocRef.current = getEditorDoc()
      return
    }
    // Programmatic change from undo/redo — re-sync baseline, don't record.
    if (isApplyingHistoryRef.current) {
      isApplyingHistoryRef.current = false
      presentDocRef.current = getEditorDoc()
      return
    }
    // Skip mid-job states (transcription/render replace the whole document).
    if (isTranscribing || isRendering) {
      presentDocRef.current = getEditorDoc()
      return
    }
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current)
    historyTimerRef.current = setTimeout(() => {
      const current = getEditorDoc()
      if (!presentDocRef.current || docsEqual(current, presentDocRef.current)) return
      undoStackRef.current.push(presentDocRef.current)
      redoStackRef.current = []
      presentDocRef.current = current
      setCanUndo(true)
      setCanRedo(false)
    }, 500)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    video.subtitles,
    video.subtitleStyle,
    video.hookOverlay,
    video.logoOverlay,
    video.format,
    trim,
    isTranscribing,
    isRendering,
  ])

  // Cleanup the history debounce timer on unmount.
  useEffect(() => {
    return () => {
      if (historyTimerRef.current) clearTimeout(historyTimerRef.current)
    }
  }, [])

  // Undo/redo keyboard shortcuts (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return
      if (!(e.metaKey || e.ctrlKey)) return
      const key = e.key.toLowerCase()
      if (key === "z") {
        e.preventDefault()
        if (e.shiftKey) redoRef.current()
        else undoRef.current()
      } else if (key === "y") {
        e.preventDefault()
        redoRef.current()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const updateStyle = async (newStyle: Partial<SubtitleStyle>, isTemplate = false) => {
    // When applying a template, start from defaults to clear residual fields
    // (e.g. highlightBg, displayMode) from a previous template.
    const base = isTemplate ? DEFAULT_SUBTITLE_STYLE : (video?.subtitleStyle ?? DEFAULT_SUBTITLE_STYLE)
    const updatedStyle = { ...base, ...newStyle } as SubtitleStyle
    setVideo({ ...video, subtitleStyle: updatedStyle })

    // Save to backend
    setIsSaving(true)
    try {
      await fetch(`/api/videos/${video.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtitleStyle: updatedStyle })
      })
    } catch (error) {
      console.error("Error saving style:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const saveSubtitles = async (subtitles: Subtitle[] | null | undefined) => {
    setIsSaving(true)
    try {
      await fetch(`/api/videos/${video.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtitles })
      })
    } catch (error) {
      console.error("Error saving subtitles:", error)
    } finally {
      setIsSaving(false)
    }
  }

  // Item 5: hook/headline overlay — debounced save like the logo overlay.
  const updateHook = (partial: Partial<HookOverlayData>) => {
    const base = video.hookOverlay ?? DEFAULT_HOOK
    const updated = { ...base, ...partial }
    setVideo({ ...video, hookOverlay: updated })

    if (hookUpdateTimerRef.current) clearTimeout(hookUpdateTimerRef.current)
    hookUpdateTimerRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/videos/${video.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hookOverlay: updated }),
        })
      } catch (error) {
        console.error('Error updating hook:', error)
      }
    }, 500)
  }

  const removeHook = async () => {
    if (hookUpdateTimerRef.current) clearTimeout(hookUpdateTimerRef.current)
    setVideo({ ...video, hookOverlay: null })
    try {
      await fetch(`/api/videos/${video.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hookOverlay: null }),
      })
    } catch (error) {
      console.error('Error removing hook:', error)
    }
  }

  // Item 2: auto-flag keyword words for persistent emphasis coloring.
  const autoHighlightKeywords = async () => {
    if (!video.subtitles) return
    const updated = annotateSubtitleKeywords(video.subtitles)
    setVideo({ ...video, subtitles: updated })
    await saveSubtitles(updated)
  }

  const clearKeywordHighlights = async () => {
    if (!video.subtitles) return
    const updated = clearSubtitleKeywords(video.subtitles)
    setVideo({ ...video, subtitles: updated })
    await saveSubtitles(updated)
  }

  const seekToSubtitle = (start: number, subtitleId: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = start
      setSelectedSubtitleId(subtitleId)
    }
    // Leave edit mode when navigating to a different cue so the inline editor
    // (text + timing inputs) doesn't stay open on the wrong card.
    if (editingSubtitle !== null && editingSubtitle !== subtitleId) {
      setEditingSubtitle(null)
    }
  }

  // Logo card (Overlays panel): validate, then upload right away.
  const uploadLogo = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast.error('Image file size must be less than 5MB')
      return
    }

    setIsUploadingLogo(true)
    try {
      const formData = new FormData()
      formData.append('logo', file)
      formData.append('videoId', video.id)

      const response = await fetch('/api/videos/upload-logo', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) throw new Error('Failed to upload logo')

      const data = await response.json()

      // Update video with logo overlay
      setVideo((v) => ({
        ...v,
        logoOverlay: data.logoOverlay
      }))

      router.refresh()
      toast.success('Logo added')
    } catch (error) {
      console.error('Error uploading logo:', error)
      toast.error('Failed to upload logo')
    } finally {
      setIsUploadingLogo(false)
    }
  }

  const removeLogo = async () => {
    try {
      const response = await fetch(`/api/videos/${video.id}/logo`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to remove logo')

      setVideo({
        ...video,
        logoOverlay: null
      })
      router.refresh()
    } catch (error) {
      console.error('Error removing logo:', error)
      toast.error('Failed to remove logo')
    }
  }

  const updateLogoSettings = (settings: Partial<LogoOverlay>) => {
    if (!video.logoOverlay) return

    const updatedLogo = {
      ...video.logoOverlay,
      ...settings
    }

    // Update local state immediately for instant visual feedback
    setVideo({
      ...video,
      logoOverlay: updatedLogo
    })

    // Debounce API call - only save after 500ms of inactivity
    if (logoUpdateTimerRef.current) {
      clearTimeout(logoUpdateTimerRef.current)
    }

    logoUpdateTimerRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/videos/${video.id}/logo`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logoOverlay: updatedLogo })
        })

        if (!response.ok) throw new Error('Failed to update logo settings')
      } catch (error) {
        console.error('Error updating logo settings:', error)
        // Optionally revert state on error
      }
    }, 500)
  }

  // Subtitle drag-and-drop handlers
  const handleSubtitleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingSubtitle(true)

    // Pause video during drag for better UX
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause()
    }
  }

  // Geometry of the export frame within the preview, given the wrapper box.
  // With a fixed format, subtitles/overlays are positioned relative to the full
  // export canvas (including letterbox bars) — exactly like the worker render.
  // For "Original" the export canvas is the source video, so we anchor to the
  // letterboxed content area and center it within the wrapper.
  const computeFrameGeometry = (containerW: number, containerH: number) => {
    const hasFormat = getFormatAspectRatio(video.format) !== null
    if (hasFormat) {
      return { width: containerW, height: containerH, offsetX: 0, offsetY: 0 }
    }
    return {
      width: videoDimensions.width,
      height: videoDimensions.height,
      offsetX: (containerW - videoDimensions.width) / 2,
      offsetY: (containerH - videoDimensions.height) / 2,
    }
  }

  const handleSubtitleMouseMove = (e: MouseEvent) => {
    if (!isDraggingSubtitle || !videoDimensions.width || !videoRef.current) return

    const videoContainer = videoRef.current.getBoundingClientRect()
    const frame = computeFrameGeometry(videoContainer.width, videoContainer.height)
    if (!frame.width || !frame.height) return

    // Calculate position relative to the export frame
    const relativeX = e.clientX - videoContainer.left - frame.offsetX
    const relativeY = e.clientY - videoContainer.top - frame.offsetY

    // Clamp to frame bounds
    const clampedX = Math.max(0, Math.min(relativeX, frame.width))
    const clampedY = Math.max(0, Math.min(relativeY, frame.height))

    // Convert to percentage
    const xPercent = (clampedX / frame.width) * 100
    const yPercent = (clampedY / frame.height) * 100

    updateSubtitlePosition({ x: xPercent, y: yPercent })
  }

  const handleSubtitleMouseUp = () => {
    setIsDraggingSubtitle(false)
  }

  const updateSubtitlePosition = (newPosition: { x: number; y: number }) => {
    const updatedStyle = {
      ...video.subtitleStyle,
      position: newPosition
    } as SubtitleStyle

    // Update local state immediately for instant feedback
    setVideo({ ...video, subtitleStyle: updatedStyle })

    // Debounce API call - save after 500ms of inactivity
    if (subtitleUpdateTimerRef.current) {
      clearTimeout(subtitleUpdateTimerRef.current)
    }

    subtitleUpdateTimerRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/videos/${video.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subtitleStyle: updatedStyle })
        })
      } catch (error) {
        console.error('Error updating subtitle position:', error)
      }
    }, 500)
  }

  // Local update + debounced save (used during continuous resize drags)
  const commitStyle = (partial: Partial<SubtitleStyle>) => {
    const updatedStyle = {
      ...(video?.subtitleStyle ?? DEFAULT_SUBTITLE_STYLE),
      ...partial,
    } as SubtitleStyle

    setVideo({ ...video, subtitleStyle: updatedStyle })

    if (subtitleUpdateTimerRef.current) {
      clearTimeout(subtitleUpdateTimerRef.current)
    }
    subtitleUpdateTimerRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/videos/${video.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subtitleStyle: updatedStyle }),
        })
      } catch (error) {
        console.error('Error updating subtitle style:', error)
      }
    }, 500)
  }

  const handleResizeStart = (handle: 'font' | 'width', e: React.MouseEvent) => {
    const wrapper = (e.currentTarget as HTMLElement).parentElement
    if (!wrapper) return
    const rect = wrapper.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const startDist = Math.hypot(e.clientX - centerX, e.clientY - centerY)

    setResize({
      handle,
      centerX,
      centerY,
      startDist: startDist || 1,
      startFontSize: (video?.subtitleStyle as SubtitleStyle | undefined)?.fontSize ?? DEFAULT_SUBTITLE_STYLE.fontSize,
    })

    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause()
    }
  }

  const handleResizeMove = (e: MouseEvent) => {
    if (!resize) return

    if (resize.handle === 'font') {
      const dist = Math.hypot(e.clientX - resize.centerX, e.clientY - resize.centerY)
      const ratio = dist / resize.startDist
      const newSize = Math.round(Math.max(8, Math.min(resize.startFontSize * ratio, 120)))
      commitStyle({ fontSize: newSize })
    } else {
      if (!videoDimensions.width || !videoRef.current) return
      const containerRect = videoRef.current.getBoundingClientRect()
      const frame = computeFrameGeometry(containerRect.width, containerRect.height)
      if (!frame.width) return
      const widthPx = 2 * Math.abs(e.clientX - resize.centerX)
      const pct = Math.max(20, Math.min((widthPx / frame.width) * 100, 100))
      commitStyle({ boxWidth: Math.round(pct) })
    }
  }

  const updateFormat = (newFormat: string | null) => {
    // Atualizar estado local imediatamente
    setVideo({ ...video, format: newFormat })

    // Debounce API call - salvar após 300ms
    if (formatUpdateTimerRef.current) {
      clearTimeout(formatUpdateTimerRef.current)
    }

    formatUpdateTimerRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/videos/${video.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ format: newFormat })
        })
      } catch (error) {
        console.error('Error updating format:', error)
      }
    }, 300)
  }

  const updateTrim = (newTrim: { start: number; end: number } | null) => {
    // Atualizar estado local imediatamente
    setTrim(newTrim)
    setVideo({ ...video, trim: newTrim })

    // Debounce API call - salvar após 300ms
    if (trimUpdateTimerRef.current) {
      clearTimeout(trimUpdateTimerRef.current)
    }

    trimUpdateTimerRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/videos/${video.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trim: newTrim })
        })
        console.log('[Trim] Updated trim:', newTrim)
      } catch (error) {
        console.error('Error updating trim:', error)
      }
    }, 300)
  }

  const setTrimStart = () => {
    if (!videoRef.current) return
    const videoDuration = videoRef.current.duration
    // Get actual video time (not relative)
    const actualTime = trim ? currentTime + trim.start : currentTime
    const newStart = actualTime
    const newEnd = trim?.end || videoDuration

    // Ensure valid range (minimum 1 second)
    if (newStart < newEnd - 1) {
      updateTrim({ start: newStart, end: newEnd })
      console.log(`[Trim] Set trim start at ${newStart}s`)
    } else {
      console.warn('[Trim] Invalid trim start - too close to end')
    }
  }

  const setTrimEnd = () => {
    if (!videoRef.current) return
    // Get actual video time (not relative)
    const actualTime = trim ? currentTime + trim.start : currentTime
    const newStart = trim?.start || 0
    const newEnd = actualTime

    // Ensure valid range (minimum 1 second)
    if (newEnd > newStart + 1) {
      updateTrim({ start: newStart, end: newEnd })
      console.log(`[Trim] Set trim end at ${newEnd}s`)
    } else {
      console.warn('[Trim] Invalid trim end - too close to start')
    }
  }

  const clearTrim = () => {
    updateTrim(null)
    if (videoRef.current) {
      videoRef.current.currentTime = 0
      setCurrentTime(0)
    }
    console.log('[Trim] Cleared trim')
  }

  const toggleTrim = () => {
    if (trim) {
      clearTrim()
      return
    }
    const videoDuration = videoRef.current?.duration
    if (!videoDuration || !isFinite(videoDuration)) return
    updateTrim({ start: 0, end: videoDuration })
  }

  const handleTrimHandleDragStart = (handle: 'start' | 'end') => {
    setIsDraggingTrimHandle(handle)
    // Pause video during drag
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause()
    }
    console.log(`[Trim] Started dragging ${handle} handle`)
  }

  const handleTrimHandleDrag = (e: MouseEvent) => {
    if (!isDraggingTrimHandle || !trim || !videoRef.current) return

    const timeline = document.querySelector('.timeline-filmstrip-container') as HTMLElement
    if (!timeline) return

    const rect = timeline.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickRatio = Math.max(0, Math.min(1, clickX / rect.width))
    const videoDuration = videoRef.current.duration
    const newTime = clickRatio * videoDuration

    if (isDraggingTrimHandle === 'start') {
      // Constrain: start must be < end (minimum 1s gap)
      const newStart = Math.max(0, Math.min(newTime, trim.end - 1))
      updateTrim({ start: newStart, end: trim.end })
    } else {
      // Constrain: end must be > start (minimum 1s gap)
      const newEnd = Math.min(videoDuration, Math.max(newTime, trim.start + 1))
      updateTrim({ start: trim.start, end: newEnd })
    }
  }

  const handleTrimHandleDragEnd = () => {
    console.log(`[Trim] Finished dragging handle`)
    setIsDraggingTrimHandle(null)
  }

  const style: SubtitleStyle = video?.subtitleStyle || {
    fontFamily: "Montserrat",
    fontSize: 24,
    boxWidth: 90,
    color: "#FFFF00",
    backgroundColor: "#FF00FF",
    backgroundOpacity: 0.8,
    position: { x: 50, y: 90 },  // Default: centered horizontally, near bottom
    alignment: "center",
    outline: true,
    outlineColor: "#000000",
    outlineWidth: 2
  }

  const subtitles = video.subtitles ?? []
  const hasSubtitles = subtitles.length > 0

  // Whether any word currently carries keyword emphasis — drives the
  // "Auto-highlight" button's on/off appearance so it reflects real state
  // instead of looking permanently selected.
  const keywordsActive = subtitles.some((sub) => sub.words?.some((w) => w.emphasis))

  const frame =
    frameDimensions.width > 0 && videoDimensions.width > 0
      ? computeFrameGeometry(frameDimensions.width, frameDimensions.height)
      : null

  // Fit the preview frame inside the stage (contain), using the export format's
  // aspect ratio or, for "Original", the source video's.
  const frameAspect = getFormatAspectRatio(video.format) ?? nativeAspect
  const frameBox =
    frameAspect && stageSize.width > 0 && stageSize.height > 0
      ? (() => {
          const w = Math.min(stageSize.width, stageSize.height * frameAspect)
          return { width: w, height: w / frameAspect }
        })()
      : { width: "100%", height: "100%" }

  // Floating text toolbar sits above the selected subtitle (below if no room).
  const toolbarAnchor = (() => {
    if (!frame || selectedSubtitleId === null || !displayedSubtitle) return null
    if (isPlaying || isDraggingSubtitle || resize) return null
    const pos = normalizePosition(style.position)
    const scale = frame.width / nativeVideoWidth
    const halfH = Math.max(style.fontSize * scale, 12) * 0.75 + 10
    const left = frame.offsetX + (pos.x / 100) * frame.width
    const cy = frame.offsetY + (pos.y / 100) * frame.height
    return cy - halfH - 8 > 48
      ? { left, top: cy - halfH - 8, placement: "above" as const }
      : { left, top: cy + halfH + 8, placement: "below" as const }
  })()

  // Timeline "Split": the selected block, else the one under the playhead.
  const splitAtPlayhead = () => {
    const target = subtitles.find((s) => s.id === selectedSubtitleId) ?? currentSubtitle
    if (!target) {
      toast.error("Move the playhead inside a subtitle to split it")
      return
    }
    splitSubtitleAtPlayhead(target)
  }

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play()
    else v.pause()
  }

  return (
    <div
      className="h-screen min-w-[1180px] bg-canvas text-paper grid overflow-hidden"
      style={{
        gridTemplateColumns: `64px ${sidebarWidth}px minmax(0, 1fr)`,
        gridTemplateRows: "56px minmax(0, 1fr)",
      }}
    >
      <EditorHeader
        title={video.title}
        isSaving={isSaving}
        format={video.format}
        onFormatChange={updateFormat}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        hasSubtitles={hasSubtitles}
        onExportSRT={exportSRT}
        onExportVTT={exportVTT}
        isRendering={isRendering}
        hasRender={!!video.outputUrl}
        onRender={renderVideo}
        onPreviewRender={() => setShowRenderPreview(true)}
        user={user}
      />

      <EditorRail active={activePanel} onChange={setActivePanel} />

      {/* Task panel (resizable) */}
      <aside className="relative border-r border-line/8 min-h-0 flex flex-col">
        {activePanel === "subtitles" && (
          <TranscriptPanel
            subtitles={subtitles}
            durationSeconds={duration}
            selectedId={selectedSubtitleId}
            activeId={currentSubtitle?.id ?? null}
            editingId={editingSubtitle}
            displayTime={displayTime}
            keywordsActive={keywordsActive}
            isTranscribing={isTranscribing}
            emphasisColor={style.emphasisColor || "#FFD700"}
            onTranscribe={transcribeVideo}
            onSelect={(sub) => seekToSubtitle(sub.start, sub.id)}
            onEdit={(sub) => {
              seekToSubtitle(sub.start, sub.id)
              setEditingSubtitle(sub.id)
            }}
            onStopEdit={() => setEditingSubtitle(null)}
            onTextChange={updateSubtitleText}
            onTimingChange={updateSubtitleTiming}
            onSplit={splitSubtitleAtPlayhead}
            onMerge={mergeWithNext}
            onDelete={deleteSubtitle}
            onAdd={addSubtitleAtPlayhead}
            onAutoHighlight={autoHighlightKeywords}
            onClearHighlights={clearKeywordHighlights}
          />
        )}
        {activePanel === "style" && (
          <StylePanel
            style={style}
            frameUrl={templateFrame}
            sampleText={subtitles[0]?.text ?? ""}
            onApply={(preset) => updateStyle(preset.style, true)}
            onOpenText={() => setActivePanel("text")}
          />
        )}
        {activePanel === "text" && (
          <TextPanel style={style} onChange={commitStyle} onOpenStyle={() => setActivePanel("style")} />
        )}
        {activePanel === "overlays" && (
          <OverlaysPanel
            style={style}
            onPosition={updateSubtitlePosition}
            onStyle={commitStyle}
            keywordColor={style.emphasisColor || "#FFD700"}
            onAutoHighlight={autoHighlightKeywords}
            onClearHighlights={clearKeywordHighlights}
            hook={video.hookOverlay}
            onHookChange={updateHook}
            onHookEnable={() => updateHook({})}
            onHookRemove={removeHook}
            logo={video.logoOverlay}
            isUploadingLogo={isUploadingLogo}
            onLogoFile={uploadLogo}
            onLogoRemove={removeLogo}
            onLogoChange={updateLogoSettings}
          />
        )}

        {/* Drag handle to resize the panel */}
        <div
          onMouseDown={handleSidebarResizeStart}
          className="group absolute top-0 bottom-0 -right-[5px] w-2.5 z-20 cursor-ew-resize flex items-center justify-center"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panel"
        >
          <div className="w-1 h-12 rounded-full bg-line/12 group-hover:bg-accent-ink/60 transition-colors duration-150" />
        </div>
      </aside>

      {/* Stage + timeline */}
      <main className="flex flex-col min-w-0 min-h-0">
        <div
          ref={stageRef}
          className="flex-1 min-h-0 relative bg-stage bg-dots flex items-center justify-center p-5 overflow-hidden"
        >
          {/* Failed-job banner with retry, pinned to the top of the stage */}
          {failedJob && (
            <div
              role="alert"
              className="absolute top-4 left-4 right-4 mx-auto max-w-[560px] z-40 flex items-center gap-3 pl-4 pr-2 py-2 rounded-lg bg-danger-surface border border-danger/40 shadow-[var(--shadow-menu)]"
            >
              <AlertTriangle className="size-4 text-danger-ink flex-none" />
              <span className="flex-1 text-[13px] text-paper">
                {failedJob === "transcribe" ? "Transcription failed." : "Rendering failed."}
              </span>
              <button
                type="button"
                onClick={failedJob === "transcribe" ? transcribeVideo : renderVideo}
                className="h-7 px-2.5 rounded-[7px] bg-danger text-on-accent text-[12px] font-semibold flex items-center gap-1.5 hover:opacity-90 flex-none"
              >
                <RotateCcw className="size-3.5" />
                Try again
              </button>
              <IconButton title="Dismiss" size={26} onClick={() => setFailedJob(null)}>
                <X className="size-3.5" />
              </IconButton>
            </div>
          )}

          {/* Preview frame — video content never changes with theme */}
          <div
            className="relative bg-black shadow-[var(--shadow-lg)] rounded-xs"
            style={{ width: frameBox.width, height: frameBox.height, maxWidth: "100%", maxHeight: "100%" }}
          >
            <video
              ref={videoRef}
              src={video?.videoUrl}
              className="w-full h-full"
              style={{ objectFit: "contain" }}
              onClick={togglePlay}
            >
              Your browser does not support the video tag.
            </video>

            {/* Subtitle Preview Overlay */}
            {frame && (
              <SubtitleTrack
                currentTime={displayTime}
                subtitles={subtitles}
                style={style}
                videoWidth={frame.width}
                videoHeight={frame.height}
                nativeVideoWidth={nativeVideoWidth}
                offsetX={frame.offsetX}
                offsetY={frame.offsetY}
                overrideSubtitle={displayedSubtitle ?? null}
                interactive
                isDragging={isDraggingSubtitle}
                onMouseDown={handleSubtitleMouseDown}
                onResizeStart={handleResizeStart}
              />
            )}

            {/* Hook Preview Overlay (item 5) */}
            {video.hookOverlay && frame && (
              <HookOverlay
                hook={video.hookOverlay}
                videoWidth={frame.width}
                videoHeight={frame.height}
                nativeVideoWidth={nativeVideoWidth}
                offsetX={frame.offsetX}
                offsetY={frame.offsetY}
              />
            )}

            {/* Logo Preview Overlay */}
            {video.logoOverlay && video.logoOverlay.logoUrl && frame && (
              (() => {
                // Anchor the logo to the export frame corners — with a fixed
                // format that includes the letterbox bars, matching the render.
                const offsetX = frame.offsetX
                const offsetY = frame.offsetY

                // Calculate logo size based on frame width
                const logoMaxSize = (frame.width * video.logoOverlay.size) / 100
                const padding = 16 // 1rem = 16px

                // Calculate position based on selected corner
                let left, right, top, bottom

                if (video.logoOverlay.position === 'top-left') {
                  left = offsetX + padding
                  top = offsetY + padding
                } else if (video.logoOverlay.position === 'top-right') {
                  right = offsetX + padding
                  top = offsetY + padding
                } else if (video.logoOverlay.position === 'bottom-left') {
                  left = offsetX + padding
                  bottom = offsetY + padding + 48 // Extra space for timeline controls
                } else { // bottom-right
                  right = offsetX + padding
                  bottom = offsetY + padding + 48
                }

                return (
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left: left !== undefined ? `${left}px` : undefined,
                      right: right !== undefined ? `${right}px` : undefined,
                      top: top !== undefined ? `${top}px` : undefined,
                      bottom: bottom !== undefined ? `${bottom}px` : undefined,
                      opacity: video.logoOverlay.opacity
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={video.logoOverlay.logoUrl}
                      alt="Logo"
                      style={{
                        maxWidth: `${logoMaxSize}px`,
                        maxHeight: `${logoMaxSize}px`,
                        objectFit: 'contain'
                      }}
                    />
                  </div>
                )
              })()
            )}

            {/* Quick text controls above the selected subtitle */}
            {toolbarAnchor && (
              <FloatingToolbar
                style={style}
                left={toolbarAnchor.left}
                top={toolbarAnchor.top}
                placement={toolbarAnchor.placement}
                onChange={commitStyle}
                onOpenText={() => setActivePanel("text")}
              />
            )}

            {/* Long-running job overlay — render/transcription take minutes,
                so make the in-flight state impossible to miss over the preview. */}
            {(isTranscribing || isRendering) && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3.5 px-[10%] text-center bg-canvas/[0.82]">
                <Loader2 className="size-[34px] text-accent-ink animate-spin" strokeWidth={1.75} />
                <p className="font-serif text-[26px] leading-[1.05] text-paper">
                  {isRendering ? (
                    <>
                      Rendering your <em className="italic">video</em>
                    </>
                  ) : (
                    <>
                      Transcribing <em className="italic">audio</em>
                    </>
                  )}
                </p>
                <p className="text-[12.5px] leading-normal text-ink-2 max-w-[320px]">
                  {isRendering
                    ? 'Burning in subtitles and overlays — this can take a few minutes. You can keep editing other projects.'
                    : 'Generating subtitles from speech — usually under a couple of minutes.'}
                </p>
                <div className="w-full max-w-[260px] h-1 rounded-full bg-line/14 overflow-hidden">
                  <div className="h-full w-1/3 rounded-full bg-accent animate-[indeterminate_1.4s_ease-in-out_infinite]" />
                </div>
              </div>
            )}
          </div>

          <div className="absolute bottom-3.5 left-4 flex items-center gap-1.5 text-[12px] text-ink-4 pointer-events-none">
            <Move className="size-[13px]" />
            Drag subtitle to reposition
          </div>
        </div>

        {/* Timeline */}
        <VideoTimeline
          videoId={video.id}
          videoUrl={video.videoUrl}
          duration={duration}
          currentTime={currentTime}
          isPlaying={isPlaying}
          isMuted={isMuted}
          trim={trim}
          videoDuration={videoRef.current?.duration || initialVideo.duration}
          subtitles={subtitles}
          selectedSubtitleId={selectedSubtitleId}
          activeSubtitleId={currentSubtitle?.id ?? null}
          onSelectSubtitle={(sub) => seekToSubtitle(sub.start, sub.id)}
          onPlayPause={togglePlay}
          onToggleMute={() => {
            if (videoRef.current) {
              videoRef.current.muted = !videoRef.current.muted
              setIsMuted(videoRef.current.muted)
            }
          }}
          onSeek={(time) => {
            if (videoRef.current) {
              videoRef.current.currentTime = time
            }
          }}
          onToggleTrim={toggleTrim}
          onClearTrim={clearTrim}
          onSplit={splitAtPlayhead}
          onTrimHandleDragStart={handleTrimHandleDragStart}
        />
      </main>

      {/* Render Preview Modal — shows the finished render with download/re-render */}
      {showRenderPreview && video.outputUrl && (
        <div
          className="fixed inset-0 bg-[var(--backdrop)] flex items-center justify-center z-50 p-4"
          onClick={() => setShowRenderPreview(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="render-title"
            className="min-w-[380px] max-w-[min(92vw,760px)] rounded-2xl bg-surface border border-line/10 shadow-[var(--shadow-modal)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pt-4 pr-4 pb-3 pl-5">
              <h2 id="render-title" className="font-serif text-[26px] leading-none text-paper">
                Rendered <em className="italic">video</em>
              </h2>
              <IconButton title="Close" onClick={() => setShowRenderPreview(false)}>
                <X className="size-4" />
              </IconButton>
            </div>

            <div className="px-5 flex justify-center">
              <video
                src={video.outputUrl}
                controls
                autoPlay
                className="max-h-[60vh] max-w-full rounded-sm bg-black"
              />
            </div>

            <p className="px-5 pt-3 pb-1 text-center font-mono tabular-nums text-[11.5px] text-ink-3 truncate">
              {video.title} · {getFormatLabel(video.format)} · {formatShort(duration)}
            </p>

            <div className="flex gap-2 px-4 pt-3 pb-4">
              <Button
                variant="ghost"
                className="flex-1 h-[38px] text-[12.5px]"
                onClick={() => {
                  setShowRenderPreview(false)
                  renderVideo()
                }}
                disabled={isRendering}
              >
                <RefreshCw className="size-3.5" />
                Re-render
              </Button>
              <Button className="flex-1 h-[38px] text-[13px]" onClick={downloadRenderedVideo}>
                <Download className="size-[15px]" />
                Download video
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
