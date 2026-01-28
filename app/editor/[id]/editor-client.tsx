"use client"

import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { VideoTimeline } from "@/components/timeline/VideoTimeline"

interface Subtitle {
  id: number
  start: number
  end: number
  text: string
}

interface SubtitleStyle {
  fontFamily: string
  fontSize: number
  color: string
  backgroundColor: string
  backgroundOpacity: number
  position: { x: number; y: number } | string  // Support both new {x, y} and legacy string formats
  alignment: string
  outline: boolean
  outlineColor: string
  outlineWidth: number
}

interface LogoOverlay {
  logoUrl: string | null
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  size: number  // percentage (5-20)
  opacity: number  // 0-1
}

interface VideoProject {
  id: string
  title: string
  videoUrl: string
  duration: number
  status: string
  subtitles: Subtitle[] | null
  subtitleStyle: SubtitleStyle | null
  logoOverlay: LogoOverlay | null
  format: string | null
  trim: { start: number; end: number } | null
}

interface EditorClientProps {
  video: VideoProject
}

// Helper function to normalize position from legacy string format to {x, y} coordinates
function normalizePosition(position: { x: number; y: number } | string): { x: number; y: number } {
  if (typeof position === 'string') {
    switch (position) {
      case 'top': return { x: 50, y: 10 }
      case 'center': return { x: 50, y: 50 }
      case 'bottom':
      default: return { x: 50, y: 90 }
    }
  }
  return position
}

// Subtitle style templates
const SUBTITLE_TEMPLATES: { name: string; style: SubtitleStyle }[] = [
  {
    name: "Classic",
    style: {
      fontFamily: "Arial",
      fontSize: 24,
      color: "#FFFFFF",
      backgroundColor: "#000000",
      backgroundOpacity: 0.6,
      position: { x: 50, y: 90 },
      alignment: "center",
      outline: false,
      outlineColor: "#000000",
      outlineWidth: 0,
    },
  },
  {
    name: "Bold Yellow",
    style: {
      fontFamily: "Montserrat",
      fontSize: 36,
      color: "#FFFF00",
      backgroundColor: "#000000",
      backgroundOpacity: 0,
      position: { x: 50, y: 85 },
      alignment: "center",
      outline: true,
      outlineColor: "#000000",
      outlineWidth: 4,
    },
  },
  {
    name: "Neon",
    style: {
      fontFamily: "Montserrat",
      fontSize: 28,
      color: "#39FF14",
      backgroundColor: "#000000",
      backgroundOpacity: 0,
      position: { x: 50, y: 85 },
      alignment: "center",
      outline: true,
      outlineColor: "#000000",
      outlineWidth: 2,
    },
  },
  {
    name: "Karaoke",
    style: {
      fontFamily: "Montserrat",
      fontSize: 24,
      color: "#FFFF00",
      backgroundColor: "#FF00FF",
      backgroundOpacity: 0.8,
      position: { x: 50, y: 90 },
      alignment: "center",
      outline: false,
      outlineColor: "#000000",
      outlineWidth: 2,
    },
  },
  {
    name: "Minimal",
    style: {
      fontFamily: "Inter",
      fontSize: 18,
      color: "#FFFFFF",
      backgroundColor: "#000000",
      backgroundOpacity: 0,
      position: { x: 50, y: 92 },
      alignment: "center",
      outline: true,
      outlineColor: "#000000",
      outlineWidth: 1,
    },
  },
  {
    name: "Cinema",
    style: {
      fontFamily: "Helvetica",
      fontSize: 22,
      color: "#FFFFFF",
      backgroundColor: "#000000",
      backgroundOpacity: 1,
      position: { x: 50, y: 92 },
      alignment: "center",
      outline: false,
      outlineColor: "#000000",
      outlineWidth: 0,
    },
  },
  {
    name: "Pop",
    style: {
      fontFamily: "Poppins",
      fontSize: 26,
      color: "#FF69B4",
      backgroundColor: "#FFFFFF",
      backgroundOpacity: 0.9,
      position: { x: 50, y: 85 },
      alignment: "center",
      outline: false,
      outlineColor: "#000000",
      outlineWidth: 0,
    },
  },
  {
    name: "Glow",
    style: {
      fontFamily: "Montserrat",
      fontSize: 28,
      color: "#FFFFFF",
      backgroundColor: "#000000",
      backgroundOpacity: 0,
      position: { x: 50, y: 85 },
      alignment: "center",
      outline: true,
      outlineColor: "#3B82F6",
      outlineWidth: 4,
    },
  },
]

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
  const [isDraggingSubtitle, setIsDraggingSubtitle] = useState(false)
  const subtitleUpdateTimerRef = useRef<NodeJS.Timeout | null>(null)
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
    const updatedSubtitles = video.subtitles?.map(sub =>
      sub.id === id ? { ...sub, text: newText } : sub
    )

    setVideo({ ...video, subtitles: updatedSubtitles || null })

    // Save to backend
    await saveSubtitles(updatedSubtitles)
  }

  const updateStyle = async (newStyle: Partial<SubtitleStyle>) => {
    const updatedStyle = { ...video?.subtitleStyle, ...newStyle } as SubtitleStyle
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
    }

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
    color: "#FFFF00",
    backgroundColor: "#FF00FF",
    backgroundOpacity: 0.8,
    position: { x: 50, y: 90 },  // Default: centered horizontally, near bottom
    alignment: "center",
    outline: true,
    outlineColor: "#000000",
    outlineWidth: 2
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col p-6 gap-4">
      {/* Header */}
      <header className="bg-[#1b1a1d] rounded-[10px] px-4 h-[60px] flex items-center justify-between w-full">
        {/* Left - Logo */}
        <h1 className="text-[15px] font-bold bg-gradient-to-r from-[#9740fe] to-[#b679fe] bg-clip-text text-transparent">
          SUPERTITLE
        </h1>

        {/* Center - Icons */}
        <div className="flex items-center gap-2 absolute left-1/2 transform -translate-x-1/2">
          <button className="p-1.5 rounded-md bg-purple-600 hover:bg-purple-700 transition-colors">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path fill="white" d="M8 10l5 3-5 3V10z"/>
            </svg>
          </button>
          <div className="relative format-dropdown-container">
            <button
              ref={formatButtonRef}
              onClick={() => setShowFormatDropdown(!showFormatDropdown)}
              className={`p-1.5 rounded-md transition-colors ${
                video.format
                  ? 'bg-purple-600/50 hover:bg-purple-500/50'
                  : 'bg-zinc-700/50 hover:bg-zinc-600/50'
              }`}
              title={`Format: ${getFormatLabel(video.format)}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth="2"/>
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showFormatDropdown && (() => {
              const buttonRect = formatButtonRef.current?.getBoundingClientRect()
              if (!buttonRect || typeof window === 'undefined') return null

              return createPortal(
                <div
                  className="format-dropdown-menu fixed bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-[9999] min-w-[140px] overflow-hidden"
                  style={{
                    top: `${buttonRect.bottom + 8}px`,
                    left: `${buttonRect.left}px`,
                  }}
                >
                  {FORMAT_OPTIONS.map((format) => (
                    <button
                      key={format.label}
                      onClick={() => updateFormat(format.value)}
                      className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between ${
                        video.format === format.value
                          ? 'bg-purple-600/30 text-white'
                          : 'text-gray-300 hover:bg-zinc-700'
                      }`}
                    >
                      <span>{format.label}</span>
                      {video.format === format.value && (
                        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>,
                document.body
              )
            })()}
          </div>
          <button
            onClick={() => setShowLogoModal(true)}
            className={`p-1.5 rounded-md transition-colors ${video.logoOverlay ? 'bg-purple-600 hover:bg-purple-700' : 'bg-zinc-700/50 hover:bg-zinc-600/50'}`}
            title="Add Logo/Watermark"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2"/>
              <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
              <path d="M21 15l-5-5L5 21" strokeWidth="2"/>
            </svg>
          </button>
        </div>

        {/* Center Right - Undo/Redo */}
        <div className="flex items-center gap-2 absolute right-[150px]">
          <button className="p-1.5 hover:bg-zinc-800/50 rounded transition-colors" title="Undo">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
          <button className="p-1.5 hover:bg-zinc-800/50 rounded transition-colors" title="Redo">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
            </svg>
          </button>
        </div>

        {/* Right - Export */}
        <div className="flex items-center gap-3 relative export-menu-container">
          {isSaving && <span className="text-xs text-purple-400">Saving...</span>}
          {isTranscribing && <span className="text-xs text-yellow-400">Transcribing...</span>}
          {isRendering && <span className="text-xs text-green-400">Rendering...</span>}

          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={!video?.subtitles || (video?.subtitles as any[]).length === 0}
            className="bg-[#9740fe] text-white px-5 py-1.5 rounded-[8px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed h-[32px] text-[14px]"
          >
            Export
          </button>

            {/* Export Dropdown Menu */}
            {showExportMenu && (
              <div className="absolute top-full right-0 mt-2 w-56 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="py-1">
                  <button
                    onClick={exportSRT}
                    className="w-full text-left px-4 py-3 hover:bg-zinc-700 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <div>
                      <div className="font-medium">Export SRT</div>
                      <div className="text-xs text-gray-400">Universal subtitle format</div>
                    </div>
                  </button>

                  <button
                    onClick={exportVTT}
                    className="w-full text-left px-4 py-3 hover:bg-zinc-700 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <div>
                      <div className="font-medium">Export VTT</div>
                      <div className="text-xs text-gray-400">Web video text tracks</div>
                    </div>
                  </button>

                  <div className="border-t border-zinc-700 my-1"></div>

                  {video?.outputUrl ? (
                    <button
                      onClick={downloadRenderedVideo}
                      className="w-full text-left px-4 py-3 hover:bg-zinc-700 transition-colors flex items-center gap-3"
                    >
                      <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <div>
                        <div className="font-medium text-green-400">Download Video</div>
                        <div className="text-xs text-gray-400">Rendered with subtitles</div>
                      </div>
                    </button>
                  ) : (
                    <button
                      onClick={renderVideo}
                      disabled={isRendering}
                      className="w-full text-left px-4 py-3 hover:bg-zinc-700 transition-colors flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <div>
                        <div className="font-medium">Render Video</div>
                        <div className="text-xs text-gray-400">Burn subtitles into video</div>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            )}
        </div>
      </header>

      {/* Main Editor */}
      <div className="flex gap-4" style={{ height: 'calc(100vh - 60px - 72px)' }}>
        {/* Left Sidebar - Subtitle Editor */}
        <aside className="w-[350px] bg-[#1b1a1d] rounded-[10px] flex flex-col flex-shrink-0 self-stretch">
          <div className="px-6 pt-6 pb-4">
            <h2 className="text-[17px] font-semibold mb-6 text-white text-center">Subtitle Editor</h2>

            {/* Tabs */}
            <div className="flex gap-6 border-b border-zinc-800/50 -mx-6 px-6 justify-center">
              <button
                onClick={() => setActiveTab("subtitles")}
                className={`pb-3 font-medium text-[15px] transition-colors relative ${
                  activeTab === "subtitles"
                    ? "text-white"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                Subtitles
                {activeTab === "subtitles" && (
                  <div className="absolute bottom-0 left-0 w-full h-[2px] bg-white"></div>
                )}
              </button>
              <button
                onClick={() => setActiveTab("styles")}
                className={`pb-3 font-medium text-[15px] transition-colors relative ${
                  activeTab === "styles"
                    ? "text-white"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                Styles
                {activeTab === "styles" && (
                  <div className="absolute bottom-0 left-0 w-full h-[2px] bg-white"></div>
                )}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
            {activeTab === "subtitles" ? (
              <div className="space-y-3">
                {!video?.subtitles || video?.subtitles.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-[14px] text-gray-400 mb-6">
                      No subtitles yet.
                    </p>
                    <button
                      onClick={transcribeVideo}
                      disabled={isTranscribing}
                      className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:opacity-90 text-white px-4 py-2.5 rounded-lg text-[14px] font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isTranscribing ? "Transcribing..." : "🎤 Auto Transcribe"}
                    </button>
                  </div>
                ) : (
                  video?.subtitles?.map((sub) => (
                    <div
                      key={sub.id}
                      className={`p-3 cursor-pointer transition-all rounded-lg ${
                        highlightedSubtitleId === sub.id
                          ? "bg-purple-600/30"
                          : "hover:bg-zinc-800/50"
                      }`}
                      onClick={() => seekToSubtitle(sub.start, sub.id)}
                    >
                      <div className="flex items-center justify-between text-[11px] text-gray-400 mb-2 font-mono">
                        <span>{formatTime(sub.start)} - {formatTime(sub.end)}</span>
                      </div>
                      {editingSubtitle === sub.id ? (
                        <textarea
                          value={sub.text}
                          onChange={(e) => updateSubtitleText(sub.id, e.target.value)}
                          className={`w-full bg-transparent text-[14px] leading-relaxed resize-none border-none focus:outline-none p-0 ${
                            highlightedSubtitleId === sub.id ? "text-white font-medium" : "text-gray-300"
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
                          className={`text-[14px] leading-relaxed cursor-text ${
                            highlightedSubtitleId === sub.id ? "text-white font-medium" : "text-gray-300"
                          }`}
                          onDoubleClick={(e) => {
                            e.stopPropagation()
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
              <div className="space-y-6">
                {/* Templates */}
                <div>
                  <label className="block text-sm font-normal mb-3 text-gray-300">Templates</label>
                  <div className="grid grid-cols-2 gap-2">
                    {SUBTITLE_TEMPLATES.map((template) => {
                      const isActive = style.color === template.style.color
                        && style.backgroundColor === template.style.backgroundColor
                        && style.backgroundOpacity === template.style.backgroundOpacity
                        && style.fontFamily === template.style.fontFamily
                        && style.fontSize === template.style.fontSize
                        && style.outline === template.style.outline
                        && style.outlineColor === template.style.outlineColor
                        && style.outlineWidth === template.style.outlineWidth

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

                      return (
                        <button
                          key={template.name}
                          onClick={() => updateStyle(template.style)}
                          className={`flex flex-col items-center gap-1.5 rounded-lg p-2 transition-all ${
                            isActive
                              ? "ring-2 ring-purple-500 bg-zinc-700/50"
                              : "bg-zinc-800 hover:bg-zinc-700/50"
                          }`}
                        >
                          <div
                            className="w-full h-[48px] rounded flex items-center justify-center"
                            style={{ backgroundColor: "#18181b" }}
                          >
                            <span
                              style={{
                                color: template.style.color,
                                fontFamily: `${template.style.fontFamily}, sans-serif`,
                                fontSize: "18px",
                                fontWeight: 700,
                                textShadow,
                                backgroundColor: previewBg,
                                padding: template.style.backgroundOpacity > 0 ? "2px 6px" : undefined,
                                borderRadius: "2px",
                              }}
                            >
                              Aa
                            </span>
                          </div>
                          <span className="text-[11px] text-gray-400">{template.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Subtitle Color */}
                <div>
                  <label className="block text-sm font-normal mb-3 text-gray-300">Subtitle Color</label>
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
                  <label className="block text-sm font-normal mb-3 text-gray-300">Subtitle Background</label>
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
                  <label className="block text-sm font-normal mb-3 text-gray-300">Background Opacity</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={style.backgroundOpacity}
                    onChange={(e) => updateStyle({ backgroundOpacity: parseFloat(e.target.value) })}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer slider-purple"
                    style={{
                      background: `linear-gradient(to right, rgb(147, 51, 234) 0%, rgb(147, 51, 234) ${style.backgroundOpacity * 100}%, rgb(39, 39, 42) ${style.backgroundOpacity * 100}%, rgb(39, 39, 42) 100%)`
                    }}
                  />
                </div>

                {/* Font Family */}
                <div>
                  <label className="block text-sm font-normal mb-3 text-gray-300">Font</label>
                  <select
                    value={style.fontFamily}
                    onChange={(e) => updateStyle({ fontFamily: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                  <label className="block text-sm font-normal mb-3 text-gray-300">Font Size</label>
                  <input
                    type="range"
                    min="12"
                    max="72"
                    value={style.fontSize}
                    onChange={(e) => updateStyle({ fontSize: parseInt(e.target.value) })}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer slider-purple"
                    style={{
                      background: `linear-gradient(to right, rgb(147, 51, 234) 0%, rgb(147, 51, 234) ${((style.fontSize - 12) / (72 - 12)) * 100}%, rgb(39, 39, 42) ${((style.fontSize - 12) / (72 - 12)) * 100}%, rgb(39, 39, 42) 100%)`
                    }}
                  />
                </div>

                {/* Position Reset */}
                <div>
                  <label className="block text-sm font-normal mb-3 text-gray-300">Position</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateSubtitlePosition({ x: 50, y: 90 })}
                      className="flex-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md px-3 py-2 text-sm transition-colors"
                    >
                      Reset to Bottom
                    </button>
                    <button
                      onClick={() => updateSubtitlePosition({ x: 50, y: 50 })}
                      className="flex-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md px-3 py-2 text-sm transition-colors"
                    >
                      Center
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Drag subtitle on video to reposition
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Center - Video Preview */}
        <main className="flex-1 flex flex-col min-w-0 gap-4">
          {/* Video Area */}
          <div className="flex-1 flex items-center justify-center min-h-0">
            <div className="w-full h-full">
              <div className="w-full h-full bg-zinc-900 rounded-[10px] overflow-hidden relative flex items-center justify-center">
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
                {displayedSubtitle && (() => {
                  const position = normalizePosition(style.position)
                  const videoContainer = videoRef.current?.getBoundingClientRect()
                  if (!videoContainer || videoDimensions.width === 0) return null

                  // Calculate letterboxing offset
                  const offsetX = (videoContainer.width - videoDimensions.width) / 2
                  const offsetY = (videoContainer.height - videoDimensions.height) / 2

                  // Convert percentage to pixels
                  const leftPx = offsetX + (position.x / 100) * videoDimensions.width
                  const topPx = offsetY + (position.y / 100) * videoDimensions.height

                  // Scale factor: ratio between preview width and native video width
                  // The worker renders at native resolution, so we scale proportionally
                  const scaleFactor = videoDimensions.width / nativeVideoWidth

                  return (
                    <div
                      className="absolute"
                      style={{
                        left: `${leftPx}px`,
                        top: `${topPx}px`,
                        transform: 'translate(-50%, -50%)',
                        cursor: isDraggingSubtitle ? 'grabbing' : 'grab',
                        pointerEvents: 'auto',
                        maxWidth: `${Math.min(videoDimensions.width * 0.9, videoDimensions.width - 32)}px`,
                      }}
                      onMouseDown={handleSubtitleMouseDown}
                    >
                      <div
                        className="px-4 py-2 rounded-sm font-bold"
                        style={{
                          backgroundColor: (() => {
                            if (style.backgroundOpacity <= 0) return "transparent"
                            const hex = style.backgroundColor.replace('#', '')
                            const r = parseInt(hex.substring(0, 2), 16)
                            const g = parseInt(hex.substring(2, 4), 16)
                            const b = parseInt(hex.substring(4, 6), 16)
                            return `rgba(${r}, ${g}, ${b}, ${style.backgroundOpacity})`
                          })(),
                          color: style.color,
                          fontFamily: `${style.fontFamily}, sans-serif`,
                          fontSize: `${Math.max(style.fontSize * scaleFactor, 12)}px`,
                          fontWeight: 700,
                          textAlign: style.alignment as any,
                          textShadow: (() => {
                            if (!style.outline || style.backgroundOpacity > 0) return "none"
                            const w = Math.max(style.outlineWidth * scaleFactor, 1)
                            const oc = style.outlineColor
                            return `${w}px 0 0 ${oc}, -${w}px 0 0 ${oc}, 0 ${w}px 0 ${oc}, 0 -${w}px 0 ${oc}, ${w}px ${w}px 0 ${oc}, -${w}px -${w}px 0 ${oc}, ${w}px -${w}px 0 ${oc}, -${w}px ${w}px 0 ${oc}`
                          })()
                        }}
                      >
                        {displayedSubtitle.text}
                      </div>
                    </div>
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
            onSetTrimStart={setTrimStart}
            onSetTrimEnd={setTrimEnd}
            onClearTrim={clearTrim}
            onTrimHandleDragStart={handleTrimHandleDragStart}
          />
        </main>
      </div>

      {/* Logo Upload Modal */}
      {showLogoModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowLogoModal(false)}>
          <div className="bg-zinc-900 rounded-lg p-6 w-[500px] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Add Logo/Watermark</h2>

            {video.logoOverlay ? (
              /* Logo already exists - show settings */
              <div className="space-y-4">
                <div className="bg-zinc-800 rounded-lg p-4">
                  <img src={video.logoOverlay.logoUrl || ''} alt="Logo" className="max-h-32 mx-auto" />
                </div>

                <div>
                  <label className="block text-sm mb-2">Position</label>
                  <select
                    value={video.logoOverlay.position}
                    onChange={(e) => updateLogoSettings({ position: e.target.value as LogoOverlay['position'] })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2"
                  >
                    <option value="top-left">Top Left</option>
                    <option value="top-right">Top Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="bottom-right">Bottom Right</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm mb-2">Size: {video.logoOverlay.size}%</label>
                  <input
                    type="range"
                    min="5"
                    max="20"
                    value={video.logoOverlay.size}
                    onChange={(e) => updateLogoSettings({ size: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm mb-2">Opacity: {Math.round(video.logoOverlay.opacity * 100)}%</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={video.logoOverlay.opacity * 100}
                    onChange={(e) => updateLogoSettings({ opacity: parseInt(e.target.value) / 100 })}
                    className="w-full"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={removeLogo}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded transition-colors"
                  >
                    Remove Logo
                  </button>
                  <button
                    onClick={() => setShowLogoModal(false)}
                    className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white py-2 rounded transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* No logo - show upload form */
              <div className="space-y-4">
                <div className="border-2 border-dashed border-zinc-700 rounded-lg p-8 text-center">
                  {logoPreview ? (
                    <div className="space-y-4">
                      <img src={logoPreview} alt="Logo preview" className="max-h-32 mx-auto" />
                      <p className="text-sm text-gray-400">{logoFile?.name}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <svg className="w-16 h-16 mx-auto text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm text-gray-400">Click to upload or drag and drop</p>
                      <p className="text-xs text-gray-500">PNG, JPG or SVG (max 5MB)</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFileChange}
                    className="hidden"
                    id="logo-upload"
                  />
                  <label htmlFor="logo-upload" className="cursor-pointer mt-4 inline-block bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded transition-colors">
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
                    className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white py-2 rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={uploadLogo}
                    disabled={!logoFile || isUploadingLogo}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploadingLogo ? 'Uploading...' : 'Upload & Add'}
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
