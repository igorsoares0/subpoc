"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

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
  const [isPlaying, setIsPlaying] = useState(false)
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

  // Update current time
  useEffect(() => {
    const videoElement = videoRef.current
    if (!videoElement) return

    const handleTimeUpdate = () => {
      setCurrentTime(videoElement.currentTime)
    }

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    videoElement.addEventListener("timeupdate", handleTimeUpdate)
    videoElement.addEventListener("play", handlePlay)
    videoElement.addEventListener("pause", handlePause)

    return () => {
      videoElement.removeEventListener("timeupdate", handleTimeUpdate)
      videoElement.removeEventListener("play", handlePlay)
      videoElement.removeEventListener("pause", handlePause)
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

  const addMockSubtitles = async () => {
    try {
      const response = await fetch(`/api/videos/${video.id}/mock-subtitles`, {
        method: "POST"
      })

      if (!response.ok) throw new Error("Failed to add subtitles")

      const data = await response.json()
      setVideo(data.video)
      router.refresh()
    } catch (error) {
      console.error("Error adding mock subtitles:", error)
      alert("Failed to add mock subtitles")
    }
  }

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
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-purple-500 hover:text-purple-400 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
              SUPERTITLE
            </h1>
            <span className="text-gray-400">•</span>
            <span className="text-gray-300">{video?.title}</span>
            {isSaving && <span className="text-sm text-purple-400">Saving...</span>}
            {isTranscribing && <span className="text-sm text-yellow-400">Transcribing...</span>}
            {isRendering && <span className="text-sm text-green-400">Rendering...</span>}
          </div>

          <div className="flex items-center gap-4 relative export-menu-container">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={!video?.subtitles || (video?.subtitles as any[]).length === 0}
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Export
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
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
                      <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        </div>
      </header>

      {/* Main Editor */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Subtitle Editor */}
        <aside className="w-80 bg-zinc-900 border-r border-zinc-800 flex flex-col">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="text-lg font-semibold mb-4">Subtitle Editor</h2>

            {/* Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab("subtitles")}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === "subtitles"
                    ? "bg-purple-600/20 text-purple-400"
                    : "text-gray-400 hover:bg-zinc-800"
                }`}
              >
                Subtitles
              </button>
              <button
                onClick={() => setActiveTab("styles")}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === "styles"
                    ? "bg-purple-600/20 text-purple-400"
                    : "text-gray-400 hover:bg-zinc-800"
                }`}
              >
                Styles
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === "subtitles" ? (
              <div className="space-y-4">
                {!video?.subtitles || video?.subtitles.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-400 mb-4">
                      No subtitles yet.
                    </p>
                    <div className="space-y-2">
                      <button
                        onClick={transcribeVideo}
                        disabled={isTranscribing}
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isTranscribing ? "Transcribing..." : "🎤 Auto Transcribe"}
                      </button>
                      <button
                        onClick={addMockSubtitles}
                        disabled={isTranscribing}
                        className="w-full bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Add Mock Subtitles
                      </button>
                    </div>
                  </div>
                ) : (
                  video?.subtitles?.map((sub) => (
                    <div
                      key={sub.id}
                      className={`bg-zinc-800 rounded-lg p-3 space-y-2 cursor-pointer transition-all ${
                        currentSubtitle?.id === sub.id ? "ring-2 ring-purple-500" : ""
                      }`}
                      onClick={() => seekToSubtitle(sub.start)}
                    >
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>{formatTime(sub.start)} - {formatTime(sub.end)}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingSubtitle(editingSubtitle === sub.id ? null : sub.id)
                          }}
                          className="text-purple-400 hover:text-purple-300"
                        >
                          {editingSubtitle === sub.id ? "Done" : "Edit"}
                        </button>
                      </div>
                      {editingSubtitle === sub.id ? (
                        <textarea
                          value={sub.text}
                          onChange={(e) => updateSubtitleText(sub.id, e.target.value)}
                          className="w-full bg-zinc-700 text-white text-sm p-2 rounded border border-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          rows={2}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <p className="text-sm text-white">{sub.text}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Subtitle Color */}
                <div>
                  <label className="block text-sm font-medium mb-2">Subtitle Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={style.color}
                      onChange={(e) => updateStyle({ color: e.target.value })}
                      className="w-12 h-12 rounded cursor-pointer"
                    />
                    <span className="text-sm text-gray-400">{style.color}</span>
                  </div>
                </div>

                {/* Background Color */}
                <div>
                  <label className="block text-sm font-medium mb-2">Background Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={style.backgroundColor}
                      onChange={(e) => updateStyle({ backgroundColor: e.target.value })}
                      className="w-12 h-12 rounded cursor-pointer"
                    />
                    <span className="text-sm text-gray-400">{style.backgroundColor}</span>
                  </div>
                </div>

                {/* Font Family */}
                <div>
                  <label className="block text-sm font-medium mb-2">Font</label>
                  <select
                    value={style.fontFamily}
                    onChange={(e) => updateStyle({ fontFamily: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
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
                  <label className="block text-sm font-medium mb-2">Font Size: {style.fontSize}px</label>
                  <input
                    type="range"
                    min="12"
                    max="72"
                    value={style.fontSize}
                    onChange={(e) => updateStyle({ fontSize: parseInt(e.target.value) })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>12px</span>
                    <span>72px</span>
                  </div>
                </div>

                {/* Background Opacity */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Background Opacity: {Math.round(style.backgroundOpacity * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={style.backgroundOpacity * 100}
                    onChange={(e) => updateStyle({ backgroundOpacity: parseInt(e.target.value) / 100 })}
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Center - Video Preview */}
        <main className="flex-1 bg-black flex flex-col">
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="w-full max-w-4xl">
              <div className="aspect-video bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 relative">
                <video
                  ref={videoRef}
                  src={video?.videoUrl}
                  controls
                  className="w-full h-full"
                >
                  Your browser does not support the video tag.
                </video>

                {/* Subtitle Preview Overlay */}
                {currentSubtitle && (
                  <div className="absolute bottom-12 left-0 right-0 flex justify-center pointer-events-none px-8">
                    <div
                      className="px-4 py-2 rounded max-w-[90%]"
                      style={{
                        backgroundColor: style.backgroundColor,
                        opacity: style.backgroundOpacity,
                        color: style.color,
                        fontFamily: `${style.fontFamily}, sans-serif`,
                        fontSize: `${style.fontSize}px`,
                        fontWeight: 600,
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

              {/* Progress bar */}
              <div className="mt-4">
                <div className="text-sm text-gray-400 mb-1">
                  {formatTime(currentTime)} / {formatTime((video?.duration || 0) * 60)}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
