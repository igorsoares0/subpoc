"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import NewProjectModal from "@/components/new-project-modal"
import { AppShell, TopBar, type ShellPlan } from "@/components/app-shell/TopBar"
import { Button } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import { Highlight } from "@/components/ui/Highlight"
import { SampleFrame } from "@/components/ui/SampleFrame"
import { StatusTag } from "@/components/ui/StatusTag"
import { getPlan } from "@/lib/plans"
import { toast } from "@/lib/toast"
import { cn } from "@/lib/utils"
import { Film, MoreHorizontal, PencilLine, Plus, Search, Trash2, Upload } from "lucide-react"

interface UserType {
  id: string
  email: string
  name?: string | null
}

interface VideoProject {
  id: string
  title: string
  videoUrl: string
  thumbnailUrl: string | null
  duration: number
  status: string
  createdAt: Date
}

interface DashboardClientProps {
  user: UserType
  initialVideos: VideoProject[]
  plan: ShellPlan
}

type StatusFilter = "all" | "ready" | "rendered" | "in_progress" | "failed"

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ready", label: "Ready" },
  { value: "rendered", label: "Rendered" },
  { value: "in_progress", label: "In progress" },
  { value: "failed", label: "Failed" },
]

const IN_PROGRESS = new Set(["uploading", "transcribing", "rendering"])

function matchesFilter(status: string, filter: StatusFilter) {
  switch (filter) {
    case "all":
      return true
    case "ready":
      return status === "ready"
    case "rendered":
      return status === "completed"
    case "in_progress":
      return IN_PROGRESS.has(status)
    case "failed":
      return status === "failed"
  }
}

// duration is stored in seconds
function formatDuration(s: number) {
  const m = Math.floor(s / 60)
  const r = Math.round(s % 60)
  return `${m}:${String(r).padStart(2, "0")}`
}

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export default function DashboardClient({ user, initialVideos, plan }: DashboardClientProps) {
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
  const [videos, setVideos] = useState(initialVideos)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [pendingDelete, setPendingDelete] = useState<VideoProject | null>(null)

  const planInfo = getPlan(plan.id)
  const uploadHint = `mp4 · webm · mov — up to ${planInfo.maxVideoMinutes} min on ${planInfo.name}`

  const counts = useMemo(() => {
    const c = {} as Record<StatusFilter, number>
    for (const f of FILTERS) c[f.value] = videos.filter((v) => matchesFilter(v.status, f.value)).length
    return c
  }, [videos])

  const query = searchQuery.trim().toLowerCase()
  const filteredVideos = videos.filter(
    (v) => matchesFilter(v.status, statusFilter) && (!query || v.title.toLowerCase().includes(query))
  )

  const confirmDelete = async () => {
    const video = pendingDelete
    if (!video) return
    setPendingDelete(null)
    const previous = videos
    setVideos((v) => v.filter((x) => x.id !== video.id))
    try {
      const res = await fetch(`/api/videos/${video.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Project deleted")
    } catch {
      setVideos(previous)
      toast.error("Couldn't delete the project. Try again.")
    }
  }

  return (
    <AppShell topBar={<TopBar active="dashboard" user={user} plan={plan} />}>
      <div className="flex items-end justify-between gap-6 flex-wrap pt-7 pb-6">
        <h1 className="display text-[64px] leading-[0.95] text-paper">
          Your <Highlight className="px-2.5">videos</Highlight>{" "}
          <span className="align-top font-mono font-normal text-[18px] tracking-normal text-ink-3 [font-stretch:100%]">
            {String(videos.length).padStart(2, "0")}
          </span>
        </h1>
        <div className="flex items-center gap-2">
          {videos.length > 0 && (
            <label className="w-[240px] h-11 flex items-center gap-2.5 px-4 rounded-full bg-surface text-ink-3 focus-within:edge-accent">
              <Search className="size-4 flex-none" />
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search projects"
                className="flex-1 min-w-0 bg-transparent border-none outline-none text-[14px] text-paper"
              />
            </label>
          )}
          <Button size="lg" onClick={() => setShowNewProjectModal(true)}>
            <Plus className="size-4" />
            New video
          </Button>
        </div>
      </div>

      {videos.length === 0 ? (
        <EmptyState hint={uploadHint} onUpload={() => setShowNewProjectModal(true)} />
      ) : (
        <>
          <div role="radiogroup" aria-label="Filter by status" className="flex flex-wrap gap-1.5 pb-5 text-[13px] font-semibold">
            {FILTERS.map((f) => {
              const active = statusFilter === f.value
              return (
                <button
                  key={f.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setStatusFilter(f.value)}
                  className={cn(
                    "h-8 px-3.5 rounded-full flex items-center gap-1 cursor-pointer",
                    active ? "bg-paper text-canvas" : "edge-line text-paper hover:bg-surface"
                  )}
                >
                  {f.label} {counts[f.value]}
                </button>
              )
            })}
          </div>

          {filteredVideos.length === 0 ? (
            <div className="py-20 flex flex-col items-center gap-3 text-center">
              <p className="display text-[40px] text-paper">
                Nothing <Highlight>found</Highlight>
              </p>
              <p className="text-[14px] text-ink-3">
                {query ? <>No project matches &ldquo;{searchQuery}&rdquo;.</> : "No projects with this status."}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
              {filteredVideos.map((video) => (
                <ProjectCard key={video.id} video={video} onDelete={() => setPendingDelete(video)} />
              ))}
            </div>
          )}
        </>
      )}

      <DeleteDialog video={pendingDelete} onCancel={() => setPendingDelete(null)} onConfirm={confirmDelete} />

      {/* Mounted only while open so every open starts from the idle state. */}
      {showNewProjectModal && (
        <NewProjectModal isOpen onClose={() => setShowNewProjectModal(false)} plan={planInfo} />
      )}
    </AppShell>
  )
}

function Thumbnail({ video, className }: { video: VideoProject; className?: string }) {
  if (!video.thumbnailUrl) {
    return (
      <div className={cn("w-full h-full flex items-center justify-center bg-surface", className)}>
        <Film className="size-8 text-ink-3" strokeWidth={1.5} />
      </div>
    )
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={video.thumbnailUrl} alt="" className={cn("w-full h-full object-cover block", className)} />
}

function ProjectCard({ video, onDelete }: { video: VideoProject; onDelete: () => void }) {
  const router = useRouter()
  const isUploading = video.status === "uploading"
  const isWorking = video.status === "transcribing" || video.status === "rendering"
  const isFailed = video.status === "failed"

  return (
    <div className="group relative flex flex-col gap-2.5">
      {/* Whole card opens the editor; the More menu sits above this link. */}
      <Link href={`/editor/${video.id}`} aria-label={`Open ${video.title}`} className="absolute inset-0 z-0" />

      <div
        className={cn(
          "relative aspect-[9/16] rounded-xl overflow-hidden pointer-events-none",
          isUploading ? "bg-surface" : "bg-black"
        )}
      >
        {isUploading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
            <span className="display text-[26px] tracking-[-0.03em] text-paper">Uploading</span>
            <span className="text-[12px] font-semibold text-ink-3">Finishing up…</span>
          </div>
        ) : (
          <Thumbnail
            video={video}
            className={cn(
              "transition-transform duration-300 group-hover:scale-[1.02]",
              isWorking && "opacity-55",
              isFailed && "opacity-35 grayscale"
            )}
          />
        )}
        <StatusTag status={video.status} className="absolute left-2.5 top-2.5" />
        {video.duration > 0 && !isUploading && video.status !== "rendering" && (
          <span className="absolute right-2 bottom-2 font-mono tabular-nums text-[11px] text-white bg-black/60 px-[5px] py-px">
            {formatDuration(video.duration)}
          </span>
        )}
        {(isUploading || isWorking) && (
          <span
            className={cn(
              "absolute inset-x-0 bottom-0 h-1 overflow-hidden",
              isUploading ? "bg-elevated" : "bg-white/25"
            )}
          >
            <span
              className={cn(
                "absolute inset-y-0 left-0 w-1/3 animate-[indeterminate_1.4s_ease-in-out_infinite]",
                isUploading ? "bg-paper" : "bg-accent"
              )}
            />
          </span>
        )}
      </div>

      <div className="relative flex items-start gap-1.5">
        <div className="flex-1 min-w-0 flex flex-col gap-0.5 pointer-events-none">
          <span className="text-[14px] font-bold text-paper truncate">{video.title}</span>
          <span className="text-[12.5px] text-ink-3">{formatDate(video.createdAt)}</span>
        </div>
        <MoreMenu onOpen={() => router.push(`/editor/${video.id}`)} onDelete={onDelete} />
      </div>
    </div>
  )
}

function MoreMenu({ onOpen, onDelete }: { onOpen: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", close)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const item = "w-full flex items-center gap-2.5 h-[38px] px-2.5 rounded-[9px] text-[13.5px] font-semibold cursor-pointer"

  return (
    <div ref={ref} className="relative z-10 -mt-1 -mr-[5px]">
      <button
        type="button"
        title="More"
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "size-7 rounded-full flex items-center justify-center cursor-pointer",
          open ? "bg-paper text-canvas" : "text-ink-3 hover:bg-surface hover:text-paper"
        )}
      >
        <MoreHorizontal className="size-[18px]" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute -right-1.5 bottom-[calc(100%+8px)] w-[200px] p-1.5 rounded-2xl bg-canvas shadow-[var(--shadow-menu)] flex flex-col gap-0.5"
        >
          <button role="menuitem" onClick={onOpen} className={`${item} text-paper hover:bg-surface`}>
            <PencilLine className="size-[15px]" />
            Open in editor
          </button>
          <span className="h-px bg-line/12 my-1 mx-1.5" />
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onDelete()
            }}
            className={`${item} text-danger-ink hover:bg-danger-surface`}
          >
            <Trash2 className="size-[15px]" />
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

function DeleteDialog({
  video,
  onCancel,
  onConfirm,
}: {
  video: VideoProject | null
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={!!video} onClose={onCancel} width={440} label="Delete project" className="gap-[18px]">
      {video && (
        <>
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-[78px] rounded-[7px] overflow-hidden flex-none bg-black">
              <Thumbnail video={video} />
            </div>
            <div className="flex flex-col gap-[3px] min-w-0">
              <span className="text-[15px] font-bold text-paper truncate">{video.title}</span>
              <span className="font-mono text-[12px] text-ink-3">
                {video.duration > 0 && `${formatDuration(video.duration)} · `}
                {formatDate(video.createdAt)}
              </span>
            </div>
          </div>
          <h2 className="display text-[34px] leading-[1.02] tracking-[-0.03em] text-paper">
            Delete this <Highlight tone="danger">project?</Highlight>
          </h2>
          <p className="text-[14.5px] leading-normal text-ink-2">
            The video, subtitles and rendered file are removed for good. This can&apos;t be undone.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="xl" className="flex-1" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="danger" size="xl" className="flex-1" onClick={onConfirm} autoFocus>
              <Trash2 className="size-[15px]" />
              Delete project
            </Button>
          </div>
        </>
      )}
    </Dialog>
  )
}

function EmptyState({ hint, onUpload }: { hint: string; onUpload: () => void }) {
  return (
    <div className="flex-1 min-h-[520px] rounded-[20px] bg-surface grid lg:grid-cols-[minmax(0,1fr)_auto] items-center gap-14 px-10 lg:px-[72px] py-12">
      <div className="flex flex-col gap-[22px] max-w-[560px]">
        <h2 className="display text-[56px] leading-[0.98] text-paper">
          Drop your first video. <Highlight className="px-2">We&apos;ll caption it.</Highlight>
        </h2>
        <p className="text-[17px] leading-normal text-ink-2 text-pretty">
          Upload a file and we transcribe it, split it into synced lines, and you style it in the editor.
        </p>
        <div className="flex items-center gap-3.5 flex-wrap">
          <Button size="2xl" className="text-[16px]" onClick={onUpload}>
            <Upload className="size-[18px]" />
            Upload video
          </Button>
          <span className="font-mono text-[12.5px] text-ink-3">{hint}</span>
        </div>
      </div>
      <SampleFrame width={260} height={462} className="hidden lg:block rounded-2xl rotate-3" />
    </div>
  )
}
