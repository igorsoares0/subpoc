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

  // Current subtitle based on video time
  const currentSubtitle = video.subtitles?.find(
    sub => currentTime >= sub.start && currentTime < sub.end
  )

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

  const updateSubtitleText = async (id: number, newText: string) => {
    const updatedSubtitles = video.subtitles?.map(sub =>
      sub.id === id ? { ...sub, text: newText } : sub
    )

    setVideo({ ...video, subtitles: updatedSubtitles || null })

    // Save to backend
    await saveSubtitles(updatedSubtitles)
  }

  const updateStyle = async (newStyle: Partial<SubtitleStyle>) => {
    const updatedStyle = { ...video.subtitleStyle, ...newStyle } as SubtitleStyle
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

  const style = video.subtitleStyle || {
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
            <span className="text-gray-300">{video.title}</span>
            {isSaving && <span className="text-sm text-purple-400">Saving...</span>}
          </div>

          <div className="flex items-center gap-4">
            <button className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity">
              Export
            </button>
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
                {!video.subtitles || video.subtitles.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-400 mb-4">
                      No subtitles yet.
                    </p>
                    <button
                      onClick={addMockSubtitles}
                      className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                    >
                      Add Mock Subtitles
                    </button>
                  </div>
                ) : (
                  video.subtitles.map((sub) => (
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
                  src={video.videoUrl}
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
                  {formatTime(currentTime)} / {formatTime(video.duration * 60)}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
