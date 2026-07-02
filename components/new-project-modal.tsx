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

  // Lê a duração real do arquivo antes do upload (metadata local, sem rede)
  const readVideoDuration = (file: File): Promise<number> =>
    new Promise((resolve) => {
      const url = URL.createObjectURL(file)
      const video = document.createElement("video")
      video.preload = "metadata"
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url)
        resolve(Number.isFinite(video.duration) ? video.duration : 0)
      }
      video.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(0)
      }
      video.src = url
    })

  // PUT direto ao R2 via XHR (fetch não expõe progresso de upload)
  const putToStorage = (url: string, file: File): Promise<void> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open("PUT", url)
      // Precisa bater com o Content-Type assinado na presigned URL
      xhr.setRequestHeader("Content-Type", file.type)
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100))
        }
      }
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(`Storage upload failed (${xhr.status})`))
      xhr.onerror = () => reject(new Error("Storage upload failed"))
      xhr.send(file)
    })

  const uploadVideo = async (file: File) => {
    setError("")
    setIsUploading(true)
    setUploadProgress(0)

    try {
      const duration = await readVideoDuration(file)

      // 1. Pedir presigned URL (valida tipo/tamanho e cria o projeto)
      const startRes = await fetch("/api/videos/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }),
      })

      if (!startRes.ok) {
        const data = await startRes.json()
        throw new Error(data.error || "Upload failed")
      }

      const { projectId, uploadUrl } = await startRes.json()

      // 2. Upload direto browser → R2 (não passa pelo servidor)
      await putToStorage(uploadUrl, file)

      // 3. Confirmar upload (verifica objeto no R2 e dispara filmstrip)
      const completeRes = await fetch(
        `/api/videos/${projectId}/upload-complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ duration }),
        }
      )

      if (!completeRes.ok) {
        const data = await completeRes.json()
        throw new Error(data.error || "Upload failed")
      }

      // Redirect to editor
      setTimeout(() => {
        router.push(`/editor/${projectId}`)
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
        className="bg-surface rounded-2xl p-6 max-w-lg w-full border border-white/[0.06] shadow-2xl"
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
            className="w-full mt-4 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 py-2.5 rounded-xl transition-colors text-[13px] font-medium border border-white/[0.08]"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
