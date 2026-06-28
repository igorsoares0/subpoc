"use client"

import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { VideoTimeline } from "@/components/timeline/VideoTimeline"
import {
  SubtitleTrack,
  HookOverlay,
  resolveFontFamily,
  annotateSubtitleKeywords,
  clearSubtitleKeywords,
  DEFAULT_SUBTITLE_STYLE,
  SUBTITLE_PRESETS,
  matchesPreset,
  type Subtitle,
  type SubtitleStyle,
  type SubtitleWord,
  type HookOverlayData,
} from "@/lib/subtitle-track"
import {
  ArrowLeft,
  Play,
  Pause,
  Monitor,
  Image,
  Undo2,
  Redo2,
  Download,
  FileText,
  Film,
  Type,
  Palette,
  Mic,
  Check,
  X,
  Upload,
  Trash2,
  ChevronDown,
  Save,
  Loader2,
  Pencil,
  Move,
  RotateCcw,
  AlignCenter,
  Sparkles,
} from "lucide-react"

interface LogoOverlay {
  logoUrl: string | null
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  size: number  // percentage (5-20)
  opacity: number  // 0-1
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
}

// Default hook/headline overlay used when the user first adds one (item 5).
const DEFAULT_HOOK: HookOverlayData = {
  text: "SEU TÍTULO AQUI",
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

// Mapeamento de formatos para exibição e backend
const FORMAT_OPTIONS = [
  { label: "Original", value: null, aspectRatio: null },
  { label: "16:9", value: "youtube", aspectRatio: 16/9 },
  { label: "9:16", value: "instagram_story", aspectRatio: 9/16 },
  { label: "1:1", value: "instagram_feed", aspectRatio: 1 },
  { label: "4:3", value: "classic", aspectRatio: 4/3 },
]

// Helper para obter label a partir do valor backend
function getFormatLabel(backendValue: string | null): string {
  const format = FORMAT_OPTIONS.find(f => f.value === backendValue)
  return format?.label || "Original"
}

// Helper para obter aspect ratio a partir do valor backend
function getFormatAspectRatio(backendValue: string | null): number | null {
  const format = FORMAT_OPTIONS.find(f => f.value === backendValue)
  return format?.aspectRatio || null
}

export default function EditorClient({ video: initialVideo }: EditorClientProps) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [activeTab, setActiveTab] = useState<"subtitles" | "styles">("subtitles")
  const [video, setVideo] = useState(initialVideo)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(initialVideo.duration * 60) // Convert minutes to seconds
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 })
  const [nativeVideoWidth, setNativeVideoWidth] = useState(1920)
  const [editingSubtitle, setEditingSubtitle] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)
  const [showLogoModal, setShowLogoModal] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
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
  const [showFormatDropdown, setShowFormatDropdown] = useState(false)
  const formatUpdateTimerRef = useRef<NodeJS.Timeout | null>(null)
  const formatButtonRef = useRef<HTMLButtonElement>(null)
  const [trim, setTrim] = useState<{ start: number; end: number } | null>(initialVideo.trim)
  const trimUpdateTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [isDraggingTrimHandle, setIsDraggingTrimHandle] = useState<'start' | 'end' | null>(null)
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<number | null>(null)

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
        const response = await fetch(`/api/videos/${video.id}`)
        if (response.ok) {
          const data = await response.json()
          const oldStatus = video.status
          setVideo(data.video)

          // Stop polling when transcription/rendering is done
          if (data.video.status === 'ready' || data.video.status === 'completed' || data.video.status === 'failed') {
            if (data.video.status === 'ready' && oldStatus !== 'ready') {
              console.log('[Polling] Transcription complete! Subtitles loaded.')
              setIsTranscribing(false)
            }
            if (data.video.status === 'completed' && oldStatus !== 'completed') {
              console.log('[Polling] Rendering complete! Video ready for download.')
              setIsRendering(false)
            }
            if (data.video.status === 'failed') {
              console.error('[Polling] Processing failed.')
              setIsRendering(false)
              setIsTranscribing(false)
            }
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
      setNativeVideoWidth(videoWidth)
    }

    videoElement.addEventListener('loadedmetadata', updateVideoDimensions)
    window.addEventListener('resize', updateVideoDimensions)

    // Trigger if already loaded
    if (videoElement.readyState >= 1) {
      updateVideoDimensions()
    }

    return () => {
      videoElement.removeEventListener('loadedmetadata', updateVideoDimensions)
      window.removeEventListener('resize', updateVideoDimensions)
    }
  }, [])

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

      if (e.key === 'i' || e.key === 'I') {
        e.preventDefault()
        setTrimStart()
      } else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault()
        setTrimEnd()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [trim, currentTime])

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

  // Close format dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showFormatDropdown) {
        const target = e.target as HTMLElement
        // Check if click is outside both the button container AND the dropdown menu
        if (!target.closest('.format-dropdown-container') && !target.closest('.format-dropdown-menu')) {
          setShowFormatDropdown(false)
        }
      }
    }

    if (showFormatDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showFormatDropdown])

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showExportMenu) {
        const target = e.target as HTMLElement
        if (!target.closest('.export-menu-container')) {
          setShowExportMenu(false)
        }
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showExportMenu])

  const transcribeVideo = async () => {
    setIsTranscribing(true)
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
      alert(error instanceof Error ? error.message : "Failed to transcribe video")
      setIsTranscribing(false)
    }
  }

  const exportSRT = () => {
    window.open(`/api/videos/${video.id}/export/srt`, '_blank')
    setShowExportMenu(false)
  }

  const exportVTT = () => {
    window.open(`/api/videos/${video.id}/export/vtt`, '_blank')
    setShowExportMenu(false)
  }

  const renderVideo = async () => {
    setIsRendering(true)
    setShowExportMenu(false)
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
      alert(error instanceof Error ? error.message : "Failed to render video")
      setIsRendering(false)
    }
  }

  const downloadRenderedVideo = () => {
    window.open(`/api/videos/${video.id}/render`, '_blank')
    setShowExportMenu(false)
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 100)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${ms.toString().padStart(2, '0')}`
  }

  const seekToSubtitle = (start: number, subtitleId: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = start
      setSelectedSubtitleId(subtitleId)
    }
  }

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file')
        return
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert('Image file size must be less than 5MB')
        return
      }
      setLogoFile(file)
      // Create preview URL
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadLogo = async () => {
    if (!logoFile) return

    setIsUploadingLogo(true)
    try {
      const formData = new FormData()
      formData.append('logo', logoFile)
      formData.append('videoId', video.id)

      const response = await fetch('/api/videos/upload-logo', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) throw new Error('Failed to upload logo')

      const data = await response.json()

      // Update video with logo overlay
      setVideo({
        ...video,
        logoOverlay: data.logoOverlay
      })

      setShowLogoModal(false)
      setLogoFile(null)
      setLogoPreview(null)
      router.refresh()
    } catch (error) {
      console.error('Error uploading logo:', error)
      alert('Failed to upload logo')
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
      alert('Failed to remove logo')
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

  const handleSubtitleMouseMove = (e: MouseEvent) => {
    if (!isDraggingSubtitle || !videoDimensions.width || !videoRef.current) return

    const videoContainer = videoRef.current.getBoundingClientRect()

    // Calculate letterboxing offset
    const offsetX = (videoContainer.width - videoDimensions.width) / 2
    const offsetY = (videoContainer.height - videoDimensions.height) / 2

    // Calculate position relative to video
    const relativeX = e.clientX - videoContainer.left - offsetX
    const relativeY = e.clientY - videoContainer.top - offsetY

    // Clamp to video bounds
    const clampedX = Math.max(0, Math.min(relativeX, videoDimensions.width))
    const clampedY = Math.max(0, Math.min(relativeY, videoDimensions.height))

    // Convert to percentage
    const xPercent = (clampedX / videoDimensions.width) * 100
    const yPercent = (clampedY / videoDimensions.height) * 100

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
      if (!videoDimensions.width) return
      const widthPx = 2 * Math.abs(e.clientX - resize.centerX)
      const pct = Math.max(20, Math.min((widthPx / videoDimensions.width) * 100, 100))
      commitStyle({ boxWidth: Math.round(pct) })
    }
  }

  const updateFormat = (newFormat: string | null) => {
    // Atualizar estado local imediatamente
    setVideo({ ...video, format: newFormat })
    setShowFormatDropdown(false)

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

  const style = video?.subtitleStyle || {
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

  // Whether any word currently carries keyword emphasis — drives the
  // "Destacar auto" button's on/off appearance so it reflects real state
  // instead of looking permanently selected.
  const keywordsActive = !!video?.subtitles?.some(
    (sub) => sub.words?.some((w) => w.emphasis),
  )

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-white flex flex-col p-4 gap-3">
      {/* Header */}
      <header className="bg-[#16161a] rounded-xl px-4 h-[56px] flex items-center justify-between w-full border border-white/[0.04]">
        {/* Left - Back + Logo */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors text-zinc-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-px h-5 bg-white/[0.08]" />
          <h1 className="text-[14px] font-bold tracking-wide bg-gradient-to-r from-[#2563eb] to-[#60a5fa] bg-clip-text text-transparent">
            SUPERTITLE
          </h1>
        </div>

        {/* Center - Tools */}
        <div className="flex items-center gap-1 absolute left-1/2 transform -translate-x-1/2 bg-white/[0.04] rounded-lg p-1">
          <div className="relative format-dropdown-container">
            <button
              ref={formatButtonRef}
              onClick={() => setShowFormatDropdown(!showFormatDropdown)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                video.format
                  ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
                  : 'text-zinc-400 hover:bg-white/[0.06] hover:text-white'
              }`}
              title={`Format: ${getFormatLabel(video.format)}`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>{getFormatLabel(video.format)}</span>
              <ChevronDown className="w-3 h-3 opacity-50" />
            </button>

            {/* Format Dropdown */}
            {showFormatDropdown && (() => {
              const buttonRect = formatButtonRef.current?.getBoundingClientRect()
              if (!buttonRect || typeof window === 'undefined') return null

              return createPortal(
                <div
                  className="format-dropdown-menu fixed bg-[#1e1e24] border border-white/[0.08] rounded-xl shadow-2xl z-[9999] min-w-[160px] overflow-hidden py-1"
                  style={{
                    top: `${buttonRect.bottom + 8}px`,
                    left: `${buttonRect.left}px`,
                  }}
                >
                  {FORMAT_OPTIONS.map((format) => (
                    <button
                      key={format.label}
                      onClick={() => updateFormat(format.value)}
                      className={`w-full px-3 py-2 text-left text-sm transition-colors flex items-center justify-between ${
                        video.format === format.value
                          ? 'bg-blue-600/15 text-blue-400'
                          : 'text-zinc-300 hover:bg-white/[0.06]'
                      }`}
                    >
                      <span>{format.label}</span>
                      {video.format === format.value && (
                        <Check className="w-3.5 h-3.5 text-blue-400" />
                      )}
                    </button>
                  ))}
                </div>,
                document.body
              )
            })()}
          </div>

          <div className="w-px h-4 bg-white/[0.08]" />

          <button
            onClick={() => setShowLogoModal(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              video.logoOverlay
                ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
                : 'text-zinc-400 hover:bg-white/[0.06] hover:text-white'
            }`}
            title="Add Logo/Watermark"
          >
            <Image className="w-3.5 h-3.5" />
            <span>Logo</span>
          </button>

          <div className="w-px h-4 bg-white/[0.08]" />

          <button className="p-1.5 rounded-md text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300 transition-colors" title="Undo (Ctrl+Z)">
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button className="p-1.5 rounded-md text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300 transition-colors" title="Redo (Ctrl+Shift+Z)">
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right - Status + Export */}
        <div className="flex items-center gap-3 relative export-menu-container">
          {isSaving && (
            <span className="flex items-center gap-1.5 text-xs text-blue-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Saving
            </span>
          )}
          {isTranscribing && (
            <span className="flex items-center gap-1.5 text-xs text-amber-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Transcribing
            </span>
          )}
          {isRendering && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Rendering
            </span>
          )}

          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={!video?.subtitles || (video?.subtitles as any[]).length === 0}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed h-[32px] text-[13px]"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>

            {/* Export Dropdown Menu */}
            {showExportMenu && (
              <div className="absolute top-full right-0 mt-2 w-60 bg-[#1e1e24] border border-white/[0.08] rounded-xl shadow-2xl z-50 overflow-hidden py-1">
                  <button
                    onClick={exportSRT}
                    className="w-full text-left px-4 py-3 hover:bg-white/[0.06] transition-colors flex items-center gap-3"
                  >
                    <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium">Export SRT</div>
                      <div className="text-[11px] text-zinc-500">Universal subtitle format</div>
                    </div>
                  </button>

                  <button
                    onClick={exportVTT}
                    className="w-full text-left px-4 py-3 hover:bg-white/[0.06] transition-colors flex items-center gap-3"
                  >
                    <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium">Export VTT</div>
                      <div className="text-[11px] text-zinc-500">Web video text tracks</div>
                    </div>
                  </button>

                  <div className="border-t border-white/[0.06] my-1"></div>

                  {video?.outputUrl ? (
                    <button
                      onClick={downloadRenderedVideo}
                      className="w-full text-left px-4 py-3 hover:bg-white/[0.06] transition-colors flex items-center gap-3"
                    >
                      <Download className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-emerald-400">Download Video</div>
                        <div className="text-[11px] text-zinc-500">Rendered with subtitles</div>
                      </div>
                    </button>
                  ) : (
                    <button
                      onClick={renderVideo}
                      disabled={isRendering}
                      className="w-full text-left px-4 py-3 hover:bg-white/[0.06] transition-colors flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Film className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-medium">Render Video</div>
                        <div className="text-[11px] text-zinc-500">Burn subtitles into video</div>
                      </div>
                    </button>
                  )}
              </div>
            )}
        </div>
      </header>

      {/* Main Editor */}
      <div className="flex gap-3" style={{ height: 'calc(100vh - 56px - 48px)' }}>
        {/* Left Sidebar - Subtitle Editor */}
        <aside className="w-[340px] bg-[#16161a] rounded-xl flex flex-col flex-shrink-0 self-stretch border border-white/[0.04]">
          <div className="px-4 pt-4 pb-3">
            {/* Tabs */}
            <div className="flex gap-1 bg-white/[0.04] rounded-lg p-1">
              <button
                onClick={() => setActiveTab("subtitles")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[13px] font-medium transition-all ${
                  activeTab === "subtitles"
                    ? "bg-white/[0.1] text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                Subtitles
              </button>
              <button
                onClick={() => setActiveTab("styles")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[13px] font-medium transition-all ${
                  activeTab === "styles"
                    ? "bg-white/[0.1] text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                Styles
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar">
            {activeTab === "subtitles" ? (
              <div className="space-y-1.5">
                {!video?.subtitles || video?.subtitles.length === 0 ? (
                  <div className="text-center py-16 px-4">
                    <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
                      <Mic className="w-5 h-5 text-zinc-500" />
                    </div>
                    <p className="text-[13px] text-zinc-500 mb-1">
                      No subtitles yet
                    </p>
                    <p className="text-[11px] text-zinc-600 mb-6">
                      Transcribe your video to generate subtitles automatically
                    </p>
                    <button
                      onClick={transcribeVideo}
                      disabled={isTranscribing}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isTranscribing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Transcribing...
                        </>
                      ) : (
                        <>
                          <Mic className="w-4 h-4" />
                          Auto Transcribe
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  video?.subtitles?.map((sub) => (
                    <div
                      key={sub.id}
                      className={`group p-3 cursor-pointer transition-all rounded-lg border ${
                        highlightedSubtitleId === sub.id
                          ? "bg-blue-600/10 border-blue-500/20"
                          : "border-transparent hover:bg-white/[0.03]"
                      }`}
                      onClick={() => seekToSubtitle(sub.start, sub.id)}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] text-zinc-500 font-mono tracking-wide">
                          {formatTime(sub.start)} - {formatTime(sub.end)}
                        </span>
                        <button
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/[0.06] transition-all"
                          onClick={(e) => {
                            e.stopPropagation()
                            seekToSubtitle(sub.start, sub.id)
                            setEditingSubtitle(sub.id)
                          }}
                          title="Edit subtitle"
                        >
                          <Pencil className="w-3 h-3 text-zinc-500" />
                        </button>
                      </div>
                      {editingSubtitle === sub.id ? (
                        <textarea
                          value={sub.text}
                          onChange={(e) => updateSubtitleText(sub.id, e.target.value)}
                          className={`w-full bg-transparent text-[13px] leading-relaxed resize-none border-none focus:outline-none p-0 ${
                            highlightedSubtitleId === sub.id ? "text-white" : "text-zinc-300"
                          }`}
                          rows={2}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          onBlur={() => setEditingSubtitle(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setEditingSubtitle(null)
                            }
                          }}
                        />
                      ) : (
                        <p
                          className={`text-[13px] leading-relaxed cursor-text ${
                            highlightedSubtitleId === sub.id ? "text-white" : "text-zinc-400"
                          }`}
                          onDoubleClick={(e) => {
                            e.stopPropagation()
                            seekToSubtitle(sub.start, sub.id)
                            setEditingSubtitle(sub.id)
                          }}
                        >
                          {sub.text}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-5">
                {/* Templates */}
                <div>
                  <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-3">Templates</label>
                  <div className="grid grid-cols-2 gap-2">
                    {SUBTITLE_PRESETS.map((template) => {
                      const isActive = matchesPreset(style, template)

                      const previewBg = (() => {
                        if (template.style.backgroundOpacity <= 0) return "transparent"
                        const hex = template.style.backgroundColor.replace('#', '')
                        const r = parseInt(hex.substring(0, 2), 16)
                        const g = parseInt(hex.substring(2, 4), 16)
                        const b = parseInt(hex.substring(4, 6), 16)
                        return `rgba(${r}, ${g}, ${b}, ${template.style.backgroundOpacity})`
                      })()

                      // Match worker: outline only renders when backgroundOpacity <= 0 (BorderStyle=1)
                      const w = template.style.outlineWidth
                      const oc = template.style.outlineColor
                      const textShadow = template.style.outline && template.style.backgroundOpacity <= 0
                        ? `${w}px 0 0 ${oc}, -${w}px 0 0 ${oc}, 0 ${w}px 0 ${oc}, 0 -${w}px 0 ${oc}, ${w}px ${w}px 0 ${oc}, -${w}px -${w}px 0 ${oc}, ${w}px -${w}px 0 ${oc}, -${w}px ${w}px 0 ${oc}`
                        : "none"

                      const animMode = template.style.animationMode
                      const isAnimated = !!animMode && animMode !== 'none'

                      return (
                        <button
                          key={template.id}
                          onClick={() => updateStyle(template.style, true)}
                          className={`flex flex-col items-center gap-1.5 rounded-lg p-2 transition-all border ${
                            isActive
                              ? "border-blue-500/50 bg-blue-600/10"
                              : "border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.06]"
                          }`}
                        >
                          <div
                            className="relative w-full h-[48px] rounded flex items-center justify-center overflow-hidden"
                            style={{ backgroundColor: "#18181b" }}
                          >
                            {isAnimated && (
                              <div
                                className="absolute top-1 right-1 flex items-center justify-center rounded-full bg-black/60 p-0.5"
                                title={`Animação: ${animMode}`}
                              >
                                <Sparkles className="w-2.5 h-2.5 text-amber-300 animate-pulse" />
                              </div>
                            )}
                            {template.style.displayMode === 'word-group' ? (
                              <span style={{
                                fontFamily: resolveFontFamily(template.style.fontFamily),
                                fontSize: "16px",
                                fontWeight: template.style.fontWeight ?? 700,
                                textShadow,
                                backgroundColor: !template.style.highlightBg ? previewBg : undefined,
                                padding: !template.style.highlightBg && template.style.backgroundOpacity > 0 ? "2px 6px" : undefined,
                                borderRadius: "2px",
                              }}>
                                <span style={{ color: template.style.color, marginRight: '4px' }}>DO </span>
                                <span style={{
                                  color: template.style.highlightBg ? (template.style.highlightColor || '#FFFFFF') : (template.style.highlightColor || '#FFD700'),
                                  backgroundColor: template.style.highlightBg || undefined,
                                  padding: template.style.highlightBg ? '1px 4px' : undefined,
                                  borderRadius: template.style.highlightBg ? '3px' : undefined,
                                }}>IT</span>
                              </span>
                            ) : (
                              <span
                                style={{
                                  color: template.style.color,
                                  fontFamily: resolveFontFamily(template.style.fontFamily),
                                  fontSize: "18px",
                                  fontWeight: template.style.fontWeight ?? 700,
                                  textShadow,
                                  backgroundColor: previewBg,
                                  padding: template.style.backgroundOpacity > 0 ? "2px 6px" : undefined,
                                  borderRadius: "2px",
                                }}
                              >
                                Aa
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-gray-400">{template.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Subtitle Color */}
                <div>
                  <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2.5">Subtitle Color</label>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <input
                        type="color"
                        value={style.color}
                        onChange={(e) => updateStyle({ color: e.target.value })}
                        className="w-10 h-10 rounded-full cursor-pointer border-2 border-zinc-700"
                        style={{ backgroundColor: style.color }}
                      />
                    </div>
                  </div>
                </div>

                {/* Background Color */}
                <div>
                  <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2.5">Subtitle Background</label>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <input
                        type="color"
                        value={style.backgroundColor}
                        onChange={(e) => updateStyle({ backgroundColor: e.target.value })}
                        className="w-10 h-10 rounded-full cursor-pointer border-2 border-zinc-700"
                        style={{ backgroundColor: style.backgroundColor }}
                      />
                    </div>
                  </div>
                </div>

                {/* Background Opacity */}
                <div>
                  <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2.5">Background Opacity</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={style.backgroundOpacity}
                    onChange={(e) => updateStyle({ backgroundOpacity: parseFloat(e.target.value) })}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer slider-blue"
                    style={{
                      background: `linear-gradient(to right, rgb(37, 99, 235) 0%, rgb(37, 99, 235) ${style.backgroundOpacity * 100}%, rgb(39, 39, 42) ${style.backgroundOpacity * 100}%, rgb(39, 39, 42) 100%)`
                    }}
                  />
                </div>

                {/* Font Family */}
                <div>
                  <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2.5">Font</label>
                  <select
                    value={style.fontFamily}
                    onChange={(e) => updateStyle({ fontFamily: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors hover:bg-white/[0.06]"
                  >
                    <option value="Montserrat">Montserrat</option>
                    <option value="Arial">Arial</option>
                    <option value="Helvetica">Helvetica</option>
                    <option value="Inter">Inter</option>
                    <option value="Roboto">Roboto</option>
                    <option value="Poppins">Poppins</option>
                  </select>
                </div>

                {/* Font Size */}
                <div>
                  <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2.5">Font Size</label>
                  <input
                    type="range"
                    min="12"
                    max="120"
                    value={style.fontSize}
                    onChange={(e) => updateStyle({ fontSize: parseInt(e.target.value) })}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer slider-blue"
                    style={{
                      background: `linear-gradient(to right, rgb(37, 99, 235) 0%, rgb(37, 99, 235) ${((style.fontSize - 12) / (120 - 12)) * 100}%, rgb(39, 39, 42) ${((style.fontSize - 12) / (120 - 12)) * 100}%, rgb(39, 39, 42) 100%)`
                    }}
                  />
                </div>

                {/* Per-word entrance animation selector (item 3) */}
                {style.displayMode === 'word-group' && (
                  <div>
                    <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2.5">
                      Animação
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { value: 'none', label: 'Nenhuma' },
                        { value: 'pop', label: 'Pop' },
                        { value: 'scale', label: 'Escala' },
                        { value: 'slide-up', label: 'Slide-up' },
                        { value: 'fade', label: 'Fade' },
                      ] as const).map((opt) => {
                        const active = (style.animationMode ?? 'none') === opt.value
                        return (
                          <button
                            key={opt.value}
                            onClick={() => updateStyle({ animationMode: opt.value })}
                            className={`px-2 py-2 rounded-lg border text-[12px] font-medium transition-colors ${
                              active
                                ? 'bg-blue-600/20 border-blue-500/40 text-blue-300 hover:bg-blue-600/30'
                                : 'bg-white/[0.04] border-white/[0.06] text-zinc-300 hover:bg-white/[0.08]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-[11px] text-zinc-600 mt-2">
                      Cada palavra entra animada ao ser falada (estilo Submagic).
                    </p>
                  </div>
                )}

                {/* Auto-split (item 4): controls how words are chunked into
                    on-screen caption blocks. Re-chunks live (computed on the fly). */}
                {style.displayMode === 'word-group' && (
                  <div>
                    <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2.5">
                      Auto-split
                    </label>

                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between text-[12px] text-zinc-400 mb-1.5">
                          <span>Máx. palavras / bloco</span>
                          <span className="text-zinc-200 font-medium">{style.wordsPerGroup ?? 4}</span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={6}
                          step={1}
                          value={style.wordsPerGroup ?? 4}
                          onChange={(e) => updateStyle({ wordsPerGroup: Number(e.target.value) })}
                          className="w-full accent-blue-500"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[12px] text-zinc-400 mb-1.5">
                          <span>Máx. caracteres / bloco</span>
                          <span className="text-zinc-200 font-medium">{style.maxCharsPerGroup ?? 24}</span>
                        </div>
                        <input
                          type="range"
                          min={10}
                          max={40}
                          step={1}
                          value={style.maxCharsPerGroup ?? 24}
                          onChange={(e) => updateStyle({ maxCharsPerGroup: Number(e.target.value) })}
                          className="w-full accent-blue-500"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[12px] text-zinc-400 mb-1.5">
                          <span>Quebra por pausa</span>
                          <span className="text-zinc-200 font-medium">{(style.splitPauseGap ?? 0.35).toFixed(2)}s</span>
                        </div>
                        <input
                          type="range"
                          min={0.1}
                          max={1}
                          step={0.05}
                          value={style.splitPauseGap ?? 0.35}
                          onChange={(e) => updateStyle({ splitPauseGap: Number(e.target.value) })}
                          className="w-full accent-blue-500"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-zinc-600 mt-2">
                      Divide a fala em blocos legíveis por pausa e tamanho.
                    </p>
                  </div>
                )}

                {/* Keyword highlight (item 2) */}
                {style.displayMode === 'word-group' && (
                  <div>
                    <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2.5">
                      Palavras-chave
                    </label>
                    <div className="flex items-center gap-3 mb-3">
                      <input
                        type="color"
                        value={style.emphasisColor || '#FFD700'}
                        onChange={(e) => updateStyle({ emphasisColor: e.target.value })}
                        className="w-10 h-10 rounded-full cursor-pointer border-2 border-zinc-700"
                        style={{ backgroundColor: style.emphasisColor || '#FFD700' }}
                      />
                      <span className="text-[12px] text-zinc-400">Cor do destaque</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={autoHighlightKeywords}
                        className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] transition-colors border ${
                          keywordsActive
                            ? "bg-blue-600/20 border-blue-500/40 text-blue-300 hover:bg-blue-600/30"
                            : "bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.06] text-zinc-300"
                        }`}
                      >
                        <Palette className="w-3 h-3" />
                        Destacar auto
                      </button>
                      <button
                        onClick={clearKeywordHighlights}
                        className="flex items-center justify-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] transition-colors"
                      >
                        <X className="w-3 h-3" />
                        Limpar
                      </button>
                    </div>
                    <p className="text-[11px] text-zinc-600 mt-2">
                      Destaca palavras-chave numa cor fixa (heurística). Requer dados word-by-word.
                    </p>
                  </div>
                )}

                {/* Position Reset */}
                <div>
                  <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2.5">Position</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateSubtitlePosition({ x: 50, y: 90 })}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Bottom
                    </button>
                    <button
                      onClick={() => updateSubtitlePosition({ x: 50, y: 50 })}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] transition-colors"
                    >
                      <AlignCenter className="w-3 h-3" />
                      Center
                    </button>
                  </div>
                  <p className="flex items-center gap-1.5 text-[11px] text-zinc-600 mt-2">
                    <Move className="w-3 h-3" />
                    Drag subtitle on video to reposition
                  </p>
                </div>

                {/* Hook / headline overlay (item 5) */}
                <div>
                  <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2.5">
                    Hook / Título
                  </label>
                  {!video.hookOverlay ? (
                    <button
                      onClick={() => updateHook({})}
                      className="w-full flex items-center justify-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] transition-colors"
                    >
                      <Type className="w-3 h-3" />
                      Adicionar hook
                    </button>
                  ) : (() => {
                    const hook = video.hookOverlay
                    return (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={hook.text}
                          onChange={(e) => updateHook({ text: e.target.value })}
                          placeholder="Texto do hook"
                          className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50"
                        />

                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={hook.color}
                            onChange={(e) => updateHook({ color: e.target.value })}
                            className="w-10 h-10 rounded-full cursor-pointer border-2 border-zinc-700"
                            style={{ backgroundColor: hook.color }}
                          />
                          <span className="text-[12px] text-zinc-400">Cor do texto</span>
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-[12px] text-zinc-400 mb-1.5">
                            <span>Tamanho</span>
                            <span className="text-zinc-200 font-medium">{hook.fontSize}</span>
                          </div>
                          <input
                            type="range"
                            min={16}
                            max={96}
                            step={1}
                            value={hook.fontSize}
                            onChange={(e) => updateHook({ fontSize: Number(e.target.value) })}
                            className="w-full accent-blue-500"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-[12px] text-zinc-400 mb-1.5">
                            <span>Posição vertical</span>
                            <span className="text-zinc-200 font-medium">{Math.round(hook.position.y)}%</span>
                          </div>
                          <input
                            type="range"
                            min={2}
                            max={98}
                            step={1}
                            value={hook.position.y}
                            onChange={(e) => updateHook({ position: { x: hook.position.x, y: Number(e.target.value) } })}
                            className="w-full accent-blue-500"
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => updateHook({ uppercase: !hook.uppercase })}
                            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] border transition-colors ${
                              hook.uppercase
                                ? 'bg-blue-600/20 border-blue-500/40 text-blue-300 hover:bg-blue-600/30'
                                : 'bg-white/[0.04] border-white/[0.06] text-zinc-300 hover:bg-white/[0.08]'
                            }`}
                          >
                            MAIÚSCULAS
                          </button>
                          <button
                            onClick={removeHook}
                            className="flex items-center justify-center gap-1.5 bg-white/[0.04] hover:bg-red-600/20 border border-white/[0.06] hover:border-red-500/40 text-zinc-300 hover:text-red-300 rounded-lg px-3 py-2 text-[12px] transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                            Remover
                          </button>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Center - Video Preview */}
        <main className="flex-1 flex flex-col min-w-0 gap-3">
          {/* Video Area */}
          <div className="flex-1 flex items-center justify-center min-h-0">
            <div className="w-full h-full">
              <div className="w-full h-full bg-[#0a0a0c] rounded-xl overflow-hidden relative flex items-center justify-center border border-white/[0.04]">
                {/* Aspect Ratio Wrapper */}
                <div
                  className="relative bg-black"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    width: (() => {
                      const ratio = getFormatAspectRatio(video.format)
                      return ratio ? 'auto' : '100%'
                    })(),
                    height: (() => {
                      const ratio = getFormatAspectRatio(video.format)
                      return ratio ? '100%' : '100%'
                    })(),
                    aspectRatio: (() => {
                      const ratio = getFormatAspectRatio(video.format)
                      return ratio ? `${ratio}` : 'auto'
                    })(),
                  }}
                >
                  <video
                    ref={videoRef}
                    src={video?.videoUrl}
                    className="w-full h-full"
                    style={{ objectFit: 'contain' }}
                    onClick={() => {
                      if (videoRef.current) {
                        if (videoRef.current.paused) {
                          videoRef.current.play()
                        } else {
                          videoRef.current.pause()
                        }
                      }
                    }}
                  >
                    Your browser does not support the video tag.
                  </video>

                  {/* Subtitle Preview Overlay */}
                {(() => {
                  const videoContainer = videoRef.current?.getBoundingClientRect()
                  if (!videoContainer || videoDimensions.width === 0) return null
                  const offsetX = (videoContainer.width - videoDimensions.width) / 2
                  const offsetY = (videoContainer.height - videoDimensions.height) / 2
                  return (
                    <SubtitleTrack
                      currentTime={displayTime}
                      subtitles={video.subtitles || []}
                      style={style}
                      videoWidth={videoDimensions.width}
                      videoHeight={videoDimensions.height}
                      nativeVideoWidth={nativeVideoWidth}
                      offsetX={offsetX}
                      offsetY={offsetY}
                      overrideSubtitle={displayedSubtitle ?? null}
                      interactive
                      isDragging={isDraggingSubtitle}
                      onMouseDown={handleSubtitleMouseDown}
                      onResizeStart={handleResizeStart}
                    />
                  )
                })()}

                {/* Hook Preview Overlay (item 5) */}
                {video.hookOverlay && videoDimensions.width > 0 && (() => {
                  const videoContainer = videoRef.current?.getBoundingClientRect()
                  if (!videoContainer) return null
                  const offsetX = (videoContainer.width - videoDimensions.width) / 2
                  const offsetY = (videoContainer.height - videoDimensions.height) / 2
                  return (
                    <HookOverlay
                      hook={video.hookOverlay}
                      videoWidth={videoDimensions.width}
                      videoHeight={videoDimensions.height}
                      nativeVideoWidth={nativeVideoWidth}
                      offsetX={offsetX}
                      offsetY={offsetY}
                    />
                  )
                })()}

                {/* Logo Preview Overlay */}
                {video.logoOverlay && video.logoOverlay.logoUrl && videoDimensions.width > 0 && (
                  (() => {
                    // Calculate video container dimensions
                    const containerRect = videoRef.current?.getBoundingClientRect()
                    if (!containerRect) return null

                    // Calculate offset to center video within container (letterboxing)
                    const offsetX = (containerRect.width - videoDimensions.width) / 2
                    const offsetY = (containerRect.height - videoDimensions.height) / 2

                    // Calculate logo size based on video width
                    const logoMaxSize = (videoDimensions.width * video.logoOverlay.size) / 100
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
                </div>
              </div>
            </div>
          </div>

          {/* Timeline with Filmstrip */}
          <VideoTimeline
            videoId={video.id}
            videoUrl={video.videoUrl}
            duration={duration}
            currentTime={currentTime}
            isPlaying={isPlaying}
            isMuted={isMuted}
            trim={trim}
            videoDuration={videoRef.current?.duration || initialVideo.duration * 60}
            onPlayPause={() => {
              if (videoRef.current) {
                if (videoRef.current.paused) {
                  videoRef.current.play()
                } else {
                  videoRef.current.pause()
                }
              }
            }}
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
            onTrimHandleDragStart={handleTrimHandleDragStart}
          />
        </main>
      </div>

      {/* Logo Upload Modal */}
      {showLogoModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowLogoModal(false)}>
          <div className="bg-[#1a1a1f] border border-white/[0.08] rounded-2xl p-6 w-[460px] max-h-[80vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Logo / Watermark</h2>
              <button onClick={() => setShowLogoModal(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {video.logoOverlay ? (
              /* Logo already exists - show settings */
              <div className="space-y-4">
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                  <img src={video.logoOverlay.logoUrl || ''} alt="Logo" className="max-h-28 mx-auto" />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Position</label>
                  <select
                    value={video.logoOverlay.position}
                    onChange={(e) => updateLogoSettings({ position: e.target.value as LogoOverlay['position'] })}
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  >
                    <option value="top-left">Top Left</option>
                    <option value="top-right">Top Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="bottom-right">Bottom Right</option>
                  </select>
                </div>

                <div>
                  <label className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                    <span>Size</span>
                    <span className="text-zinc-400 normal-case tracking-normal">{video.logoOverlay.size}%</span>
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="20"
                    value={video.logoOverlay.size}
                    onChange={(e) => updateLogoSettings({ size: parseInt(e.target.value) })}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, rgb(37, 99, 235) 0%, rgb(37, 99, 235) ${((video.logoOverlay.size - 5) / 15) * 100}%, rgb(39, 39, 42) ${((video.logoOverlay.size - 5) / 15) * 100}%, rgb(39, 39, 42) 100%)`
                    }}
                  />
                </div>

                <div>
                  <label className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                    <span>Opacity</span>
                    <span className="text-zinc-400 normal-case tracking-normal">{Math.round(video.logoOverlay.opacity * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={video.logoOverlay.opacity * 100}
                    onChange={(e) => updateLogoSettings({ opacity: parseInt(e.target.value) / 100 })}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, rgb(37, 99, 235) 0%, rgb(37, 99, 235) ${video.logoOverlay.opacity * 100}%, rgb(39, 39, 42) ${video.logoOverlay.opacity * 100}%, rgb(39, 39, 42) 100%)`
                    }}
                  />
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={removeLogo}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 py-2.5 rounded-lg transition-colors text-[13px] font-medium border border-red-500/20"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                  <button
                    onClick={() => setShowLogoModal(false)}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg transition-colors text-[13px] font-medium"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* No logo - show upload form */
              <div className="space-y-4">
                <div className="border-2 border-dashed border-white/[0.08] rounded-xl p-8 text-center hover:border-blue-500/30 transition-colors">
                  {logoPreview ? (
                    <div className="space-y-3">
                      <img src={logoPreview} alt="Logo preview" className="max-h-28 mx-auto" />
                      <p className="text-[12px] text-zinc-500">{logoFile?.name}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto">
                        <Upload className="w-5 h-5 text-zinc-500" />
                      </div>
                      <p className="text-[13px] text-zinc-400">Click to upload or drag and drop</p>
                      <p className="text-[11px] text-zinc-600">PNG, JPG or SVG (max 5MB)</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFileChange}
                    className="hidden"
                    id="logo-upload"
                  />
                  <label htmlFor="logo-upload" className="cursor-pointer mt-4 inline-flex items-center gap-2 bg-white/[0.06] hover:bg-white/[0.1] text-white px-4 py-2 rounded-lg transition-colors text-[13px]">
                    <Image className="w-3.5 h-3.5" />
                    Select Image
                  </label>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowLogoModal(false)
                      setLogoFile(null)
                      setLogoPreview(null)
                    }}
                    className="flex-1 bg-white/[0.06] hover:bg-white/[0.1] text-white py-2.5 rounded-lg transition-colors text-[13px] font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={uploadLogo}
                    disabled={!logoFile || isUploadingLogo}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-[13px] font-medium flex items-center justify-center gap-2"
                  >
                    {isUploadingLogo ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        Upload & Add
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
