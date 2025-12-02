"use client"

import { useState, useRef, useEffect } from "react"
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
  position: string
  alignment: string
  outline: boolean
  outlineColor: string
  outlineWidth: number
}

interface VideoProject {
  id: string
  title: string
  videoUrl: string
  duration: number
  status: string
  subtitles: Subtitle[] | null
  subtitleStyle: SubtitleStyle | null
}

interface EditorClientProps {
  video: VideoProject
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
  const [editingSubtitle, setEditingSubtitle] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)

  // Current subtitle based on video time
  const currentSubtitle = video?.subtitles?.find(
    sub => currentTime >= sub.start && currentTime < sub.end
  )

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
      setCurrentTime(videoElement.currentTime)
    }

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    const handleLoadedMetadata = () => {
      // Update duration when video metadata is loaded
      if (videoElement.duration && !isNaN(videoElement.duration)) {
        console.log(`[Editor] Video metadata loaded, duration: ${videoElement.duration}s`)
        setDuration(videoElement.duration)
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
  }, [])

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

  const seekToSubtitle = (start: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = start
    }
  }

  const style = video?.subtitleStyle || {
    fontFamily: "Montserrat",
    fontSize: 24,
    color: "#FFFF00",
    backgroundColor: "#FF00FF",
    backgroundOpacity: 0.8,
    position: "bottom",
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
          <button className="p-1.5 rounded-md bg-zinc-700/50 hover:bg-zinc-600/50 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth="2"/>
            </svg>
          </button>
          <button className="p-1.5 rounded-md bg-zinc-700/50 hover:bg-zinc-600/50 transition-colors">
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

          <div className="flex-1 overflow-y-auto px-6 py-4">
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
                        currentSubtitle?.id === sub.id
                          ? "bg-purple-600/30"
                          : "hover:bg-zinc-800/50"
                      }`}
                      onClick={() => seekToSubtitle(sub.start)}
                    >
                      <div className="flex items-center justify-between text-[11px] text-gray-400 mb-2 font-mono">
                        <span>{formatTime(sub.start)} - {formatTime(sub.end)}</span>
                      </div>
                      {editingSubtitle === sub.id ? (
                        <textarea
                          value={sub.text}
                          onChange={(e) => updateSubtitleText(sub.id, e.target.value)}
                          className="w-full bg-zinc-900 text-white text-[14px] p-2 rounded border border-zinc-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
                          rows={2}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={() => setEditingSubtitle(null)}
                        />
                      ) : (
                        <p
                          className={`text-[14px] leading-relaxed ${
                            currentSubtitle?.id === sub.id ? "text-white font-medium" : "text-gray-300"
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
              </div>
            )}
          </div>
        </aside>

        {/* Center - Video Preview */}
        <main className="flex-1 flex flex-col min-w-0 gap-4">
          {/* Video Area */}
          <div className="flex-1 flex items-center justify-center min-h-0">
            <div className="w-full h-full">
              <div className="w-full h-full bg-zinc-900 rounded-[10px] overflow-hidden relative">
                <video
                  ref={videoRef}
                  src={video?.videoUrl}
                  className="w-full h-full object-contain"
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
                {currentSubtitle && (
                  <div className="absolute bottom-12 left-0 right-0 flex justify-center pointer-events-none">
                    <div
                      className="px-4 py-2 rounded-sm font-bold"
                      style={{
                        maxWidth: videoDimensions.width > 0
                          ? `${Math.min(videoDimensions.width * 0.9, videoDimensions.width - 32)}px`
                          : '90%',
                        backgroundColor: style.backgroundColor,
                        opacity: style.backgroundOpacity,
                        color: style.color,
                        fontFamily: `${style.fontFamily}, sans-serif`,
                        fontSize: `${Math.max(style.fontSize * 0.8, 16)}px`,
                        fontWeight: 700,
                        textAlign: style.alignment as any,
                        textShadow: style.outline
                          ? `${style.outlineWidth}px ${style.outlineWidth}px 0 ${style.outlineColor},
                             -${style.outlineWidth}px -${style.outlineWidth}px 0 ${style.outlineColor},
                             ${style.outlineWidth}px -${style.outlineWidth}px 0 ${style.outlineColor},
                             -${style.outlineWidth}px ${style.outlineWidth}px 0 ${style.outlineColor}`
                          : "none"
                      }}
                    >
                      {currentSubtitle.text}
                    </div>
                  </div>
                )}
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
          />
        </main>
      </div>
    </div>
  )
}
