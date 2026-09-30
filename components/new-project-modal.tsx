"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { X, Upload, FileVideo } from "lucide-react"
import { Button, IconButton } from "@/components/ui/Button"
import { Banner } from "@/components/ui/Banner"

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
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number; duration: number } | null>(null)

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
      setFileInfo({ name: file.name, size: file.size, duration })

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

  const formatSize = (bytes: number) =>
    bytes >= 1024 * 1024 * 1024
      ? `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
      : `${Math.max(1, Math.round(bytes / 1024 / 1024))} MB`

  const formatDuration = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`

  return (
    <div
      className="fixed inset-0 bg-[var(--backdrop)] flex items-center justify-center z-50 p-4"
      onClick={() => !isUploading && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-title"
        className="w-[460px] max-w-full rounded-2xl bg-surface border border-line/10 shadow-[var(--shadow-modal)] pt-[22px] px-5 pb-6 flex flex-col gap-[18px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="upload-title" className="font-serif text-[30px] leading-none text-paper">
            Upload <em className="italic">video</em>
          </h2>
          <IconButton title="Close" onClick={onClose} disabled={isUploading}>
            <X className="size-4" />
          </IconButton>
        </div>

        {error && <Banner variant="danger">{error}</Banner>}

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />

        {isUploading ? (
          <div className="h-[250px] rounded-xl bg-canvas border border-line/8 flex flex-col justify-center gap-[18px] px-6">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-lg bg-elevated flex items-center justify-center flex-none">
                <FileVideo className="size-[18px] text-accent-ink" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
                <span className="text-[14px] font-medium text-paper truncate">{fileInfo?.name}</span>
                {fileInfo && (
                  <span className="font-mono tabular-nums text-[11.5px] text-ink-3">
                    {formatSize(fileInfo.size)}
                    {fileInfo.duration > 0 && ` · ${formatDuration(fileInfo.duration)}`}
                  </span>
                )}
              </div>
              <span className="font-mono tabular-nums text-[13px] font-medium text-paper">{uploadProgress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-line/12 overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span className="text-[12.5px] text-ink-3">
              Uploading… you&apos;ll land in the editor when it&apos;s done.
            </span>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInputRef.current?.click()}
            className={`h-[250px] rounded-xl border-[1.5px] border-dashed flex flex-col items-center justify-center gap-3.5 text-center cursor-pointer transition-colors duration-150 ${
              isDragging
                ? "border-accent bg-accent/6"
                : "border-line/18 hover:border-accent-ink hover:bg-accent/5"
            }`}
          >
            <div className="size-[52px] rounded-[14px] bg-canvas border border-line/8 flex items-center justify-center">
              <Upload className="size-[22px] text-ink-2" strokeWidth={1.75} />
            </div>
            {isDragging ? (
              <span className="text-[15px] font-medium text-paper">Drop to upload</span>
            ) : (
              <div className="flex flex-col gap-1">
                <span className="text-[15px] font-medium text-paper">Drag &amp; drop your video here</span>
                <span className="text-[13px] text-ink-3">
                  or <span className="text-paper underline underline-offset-[3px]">browse files</span>
                </span>
              </div>
            )}
            <span className="font-mono text-[11.5px] text-ink-4">MP4 · WebM · MOV — up to 500 MB</span>
          </div>
        )}

        {!isUploading && (
          <Button variant="ghost" onClick={onClose} className="w-full text-[13px]">
            Cancel
          </Button>
        )}
      </div>
    </div>
  )
}
