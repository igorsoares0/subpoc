"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowRight, FileX2, Film } from "lucide-react"
import { Button, buttonClass } from "@/components/ui/Button"
import { Dialog, DialogHeader } from "@/components/ui/Dialog"
import { PLANS, type Plan } from "@/lib/plans"
import { cn } from "@/lib/utils"

interface NewProjectModalProps {
  isOpen: boolean
  onClose: () => void
  /** Current plan — only used for the limits shown in the copy (the server enforces them). */
  plan: Plan
}

type FileInfo = { name: string; size: number; duration: number }
type UploadError = { message: string; code?: string }

class UploadFailure extends Error {
  code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 * 1024
    ? `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
    : `${Math.max(1, Math.round(bytes / 1024 / 1024))} MB`

const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`

export default function NewProjectModal({ isOpen, onClose, plan }: NewProjectModalProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const xhrRef = useRef<XMLHttpRequest | null>(null)
  const projectIdRef = useRef<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [canCancel, setCanCancel] = useState(false)
  const [error, setError] = useState<UploadError | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    const videoFile = files.find((file) => file.type.startsWith("video/"))

    if (videoFile) {
      await uploadVideo(videoFile)
    } else {
      setFileInfo(files[0] ? { name: files[0].name, size: files[0].size, duration: 0 } : null)
      setError({ message: "Please drop a video file (mp4, webm or mov)." })
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (file) uploadVideo(file)
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
      xhrRef.current = xhr
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
      xhr.onabort = () => reject(new UploadFailure("Upload cancelled", "aborted"))
      xhr.send(file)
    })

  const uploadVideo = async (file: File) => {
    setError(null)
    setIsUploading(true)
    setUploadProgress(0)
    projectIdRef.current = null

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
        throw new UploadFailure(data.error || "Upload failed", data.code)
      }

      const { projectId, uploadUrl } = await startRes.json()
      projectIdRef.current = projectId

      // 2. Upload direto browser → R2 (não passa pelo servidor)
      setCanCancel(true)
      await putToStorage(uploadUrl, file)
      setCanCancel(false)
      xhrRef.current = null

      // 3. Confirmar upload (verifica objeto no R2 e dispara filmstrip)
      const completeRes = await fetch(`/api/videos/${projectId}/upload-complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration }),
      })

      if (!completeRes.ok) {
        const data = await completeRes.json()
        throw new UploadFailure(data.error || "Upload failed", data.code)
      }

      // Redirect to editor
      setTimeout(() => {
        router.push(`/editor/${projectId}`)
        router.refresh()
      }, 500)
    } catch (err: unknown) {
      setCanCancel(false)
      xhrRef.current = null
      setIsUploading(false)
      setUploadProgress(0)
      const code = err instanceof UploadFailure ? err.code : undefined
      if (code === "aborted") {
        // Cancelled by the user: drop the half-created project, back to idle.
        const id = projectIdRef.current
        if (id) fetch(`/api/videos/${id}`, { method: "DELETE" }).catch(() => {})
        setFileInfo(null)
        return
      }
      setError({ message: err instanceof Error ? err.message : "Failed to upload video", code })
    }
  }

  const cancelUpload = () => xhrRef.current?.abort()

  const resetToIdle = () => {
    setError(null)
    setFileInfo(null)
    fileInputRef.current?.click()
  }

  const title = isUploading ? "Uploading" : error ? "Can’t upload" : "Drop a video"
  const limitHint = `mp4 · webm · mov — up to ${plan.maxVideoMinutes} min on ${plan.name}`
  const isPlanLimit = error?.code === "video_too_long" || error?.code === "quota_exceeded"

  return (
    <Dialog open={isOpen} onClose={onClose} locked={isUploading} width={560} padding={28} label={title} className="gap-5">
      <DialogHeader onClose={onClose} closeDisabled={isUploading}>
        <h2 className="display text-[40px] tracking-[-0.03em] text-paper">{title}</h2>
      </DialogHeader>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading}
      />

      {isUploading ? (
        <>
          <div className="h-[300px] rounded-2xl bg-surface flex flex-col justify-between p-6">
            <FileRow info={fileInfo} />
            <div className="flex flex-col gap-3">
              <span className="display text-[96px] leading-[0.85] tracking-[-0.05em] text-paper tabular-nums">
                {uploadProgress}
                <span className="text-[48px]">%</span>
              </span>
              <div className="h-2 rounded-full bg-elevated overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-[13px] text-ink-3">You&apos;ll land in the editor when it&apos;s done.</span>
            {canCancel && (
              <button
                type="button"
                onClick={cancelUpload}
                className="text-[13px] font-semibold text-paper underline underline-offset-[3px] cursor-pointer hover:text-accent-ink"
              >
                Cancel upload
              </button>
            )}
          </div>
        </>
      ) : error ? (
        <>
          <div className="min-h-[300px] rounded-2xl bg-danger-surface flex flex-col justify-between gap-6 p-6">
            <div className="flex items-center gap-3">
              <span className="w-10 h-16 rounded-md bg-canvas flex items-center justify-center text-danger-ink flex-none">
                <FileX2 className="size-[18px]" />
              </span>
              <div className="flex flex-col gap-[3px] min-w-0">
                <span className="text-[15px] font-bold text-paper truncate">{fileInfo?.name ?? "Upload failed"}</span>
                {fileInfo && (
                  <span className="font-mono text-[12px] text-danger-ink">
                    {formatSize(fileInfo.size)}
                    {fileInfo.duration > 0 && ` · ${formatDuration(fileInfo.duration)}`}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="display text-[34px] leading-[1.02] tracking-[-0.03em] text-danger-ink">
                {error.code === "video_too_long"
                  ? `This video is too long for ${plan.name}.`
                  : error.code === "quota_exceeded"
                    ? "You’re out of minutes."
                    : "Upload failed."}
              </span>
              <span className="text-[14px] leading-normal text-ink-2">
                {error.code === "video_too_long" && plan.id !== "pro"
                  ? `Trim it to ${plan.maxVideoMinutes} minutes, or upgrade — Starter takes videos up to ${PLANS.starter.maxVideoMinutes} min, Pro up to ${PLANS.pro.maxVideoMinutes}.`
                  : error.message}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="xl" className="flex-1" onClick={resetToIdle}>
              Choose another file
            </Button>
            {isPlanLimit && plan.id !== "pro" && (
              <Link href="/dashboard/billing" className={buttonClass("primary", "xl", "flex-1 hover:text-on-accent")}>
                See plans
                <ArrowRight className="size-[15px]" />
              </Link>
            )}
          </div>
        </>
      ) : (
        <>
          <div
            role="button"
            tabIndex={0}
            onDragOver={handleDragOver}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInputRef.current?.click()}
            className={cn(
              "h-[300px] rounded-2xl flex flex-col items-center justify-center gap-4 text-center cursor-pointer transition-[transform,background-color] duration-150",
              isDragging ? "bg-accent text-white scale-[1.02]" : "bg-surface edge-line hover:bg-hover"
            )}
          >
            {isDragging ? (
              <>
                <span className="size-[72px] rounded-full bg-white text-accent flex items-center justify-center">
                  <ArrowDown className="size-8" />
                </span>
                <span className="display text-[44px] font-black text-white">Release to upload</span>
                <span className="text-[14px] font-semibold opacity-90">Drop it anywhere in this box</span>
              </>
            ) : (
              <>
                <span className="size-16 rounded-full bg-paper text-canvas flex items-center justify-center">
                  <ArrowDown className="size-7" />
                </span>
                <div className="flex flex-col gap-1">
                  <span className="text-[18px] font-bold text-paper">Drag your video in</span>
                  <span className="text-[14px] text-ink-2">
                    or <span className="font-semibold text-paper underline underline-offset-[3px]">browse files</span>
                  </span>
                </div>
                <span className="font-mono text-[12px] text-ink-3">{limitHint}</span>
              </>
            )}
          </div>
          <span className="text-[13px] text-ink-3">Up to 500 MB. Once it&apos;s up, you&apos;ll land in the editor.</span>
        </>
      )}
    </Dialog>
  )
}

function FileRow({ info }: { info: FileInfo | null }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-10 h-16 rounded-md bg-elevated flex items-center justify-center text-ink-3 flex-none">
        <Film className="size-[18px]" />
      </span>
      <div className="flex flex-col gap-[3px] min-w-0">
        <span className="text-[15px] font-bold text-paper truncate">{info?.name ?? "Preparing…"}</span>
        {info && (
          <span className="font-mono tabular-nums text-[12px] text-ink-3">
            {formatSize(info.size)}
            {info.duration > 0 && ` · ${formatDuration(info.duration)}`}
          </span>
        )}
      </div>
    </div>
  )
}
