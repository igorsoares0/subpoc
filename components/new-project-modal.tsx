"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { X, Upload, Film, Loader2 } from "lucide-react"

interface NewProjectModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function NewProjectModal({ isOpen, onClose }: NewProjectModalProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState("")
  const [uploadProgress, setUploadProgress] = useState(0)

  if (!isOpen) return null

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    const videoFile = files.find(file => file.type.startsWith("video/"))

    if (videoFile) {
      await uploadVideo(videoFile)
    } else {
      setError("Please drop a video file")
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      uploadVideo(file)
    }
  }

  const uploadVideo = async (file: File) => {
    setError("")
    setIsUploading(true)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append("file", file)

      // Simulate progress (real progress would need XMLHttpRequest)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      const response = await fetch("/api/videos/upload", {
        method: "POST",
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Upload failed")
      }

      const data = await response.json()

      // Redirect to editor
      setTimeout(() => {
        router.push(`/editor/${data.project.id}`)
        router.refresh()
      }, 500)
    } catch (err: any) {
      setError(err.message || "Failed to upload video")
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#16161a] rounded-2xl p-6 max-w-lg w-full border border-white/[0.06] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Upload Video</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300 transition-colors"
            disabled={isUploading}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-[13px]">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-xl p-12 text-center transition-all
            ${isDragging ? "border-blue-500/50 bg-blue-500/[0.05]" : "border-white/[0.08] hover:border-white/[0.15]"}
            ${isUploading ? "opacity-60 pointer-events-none" : "cursor-pointer"}
          `}
          onClick={() => !isUploading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />

          {isUploading ? (
            <div className="space-y-5">
              <div className="w-12 h-12 rounded-full bg-blue-600/10 border border-blue-600/20 flex items-center justify-center mx-auto">
                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              </div>
              <div>
                <p className="text-[14px] font-medium mb-3">Uploading...</p>
                <div className="w-full max-w-xs mx-auto bg-white/[0.04] rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-[12px] text-zinc-500 mt-2">{uploadProgress}%</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto">
                <Upload className="w-6 h-6 text-zinc-500" />
              </div>
              <div>
                <p className="text-[14px] font-medium mb-1">
                  Drag & drop your video here
                </p>
                <p className="text-[13px] text-zinc-500 mb-4">
                  or click to browse files
                </p>
                <p className="text-[11px] text-zinc-600">
                  Supports MP4, WebM, MOV (max 500MB)
                </p>
              </div>
            </div>
          )}
        </div>

        {!isUploading && (
          <button
            onClick={onClose}
            className="w-full mt-4 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 py-2.5 rounded-xl transition-colors text-[13px] font-medium border border-white/[0.04]"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
