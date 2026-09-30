"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import NewProjectModal from "@/components/new-project-modal"
import { AppShell, Sidebar, type SidebarPlan } from "@/components/app-shell/Sidebar"
import { Button, IconButton } from "@/components/ui/Button"
import { Input } from "@/components/ui/Field"
import { StatusPill } from "@/components/ui/StatusPill"
import { toast } from "@/lib/toast"
import { Film, MoreHorizontal, Pencil, Plus, Search, Trash2, Upload } from "lucide-react"

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
  plan: SidebarPlan
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

  const firstName = (user.name || user.email?.split("@")[0] || "").split(" ")[0]

  const filteredVideos = searchQuery
    ? videos.filter(v => v.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : videos

  const deleteVideo = async (video: VideoProject) => {
    if (!window.confirm(`Delete "${video.title}"? This can't be undone.`)) return
    const previous = videos
    setVideos(v => v.filter(x => x.id !== video.id))
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
    <AppShell sidebar={<Sidebar active="dashboard" user={user} plan={plan} />}>
      {videos.length === 0 ? (
        <EmptyState onUpload={() => setShowNewProjectModal(true)} />
      ) : (
        <div className="flex flex-col gap-7">
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div className="flex flex-col gap-2.5">
              <h1 className="font-serif text-[52px] leading-[1.02] tracking-[-0.01em] text-paper">
                Welcome back{firstName && ", "}
                {firstName && <em className="italic">{firstName}</em>}
              </h1>
              <p className="text-[13.5px] text-ink-3">
                {videos.length} {videos.length === 1 ? "project" : "projects"}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <Input
                icon={Search}
                inputSize="md"
                wrapperClassName="w-[280px]"
                type="text"
                placeholder="Search projects…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search projects"
              />
              <Button onClick={() => setShowNewProjectModal(true)}>
                <Plus className="size-4" />
                New project
              </Button>
            </div>
          </div>

          {filteredVideos.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-2 text-center">
              <p className="font-serif text-[32px] leading-none text-paper">
                Nothing <em className="italic">found</em>
              </p>
              <p className="text-[13.5px] text-ink-3">No project matches &ldquo;{searchQuery}&rdquo;.</p>
            </div>
          ) : (
            <div className="grid gap-5 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
              {filteredVideos.map((video) => (
                <ProjectCard key={video.id} video={video} onDelete={() => deleteVideo(video)} />
              ))}
            </div>
          )}
        </div>
      )}

      <NewProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
      />
    </AppShell>
  )
}

function ProjectCard({ video, onDelete }: { video: VideoProject; onDelete: () => void }) {
  const router = useRouter()
  const dimmed = video.status === "uploading" || video.status === "failed"

  return (
    <div className="group relative flex flex-col rounded-xl bg-surface border border-line/8 overflow-hidden transition-colors duration-150 hover:border-accent/45">
      {/* Whole card opens the editor; the More menu sits above this link. */}
      <Link
        href={`/editor/${video.id}`}
        aria-label={`Open ${video.title}`}
        className="absolute inset-0 z-0"
      />
      <div className="relative h-[196px] bg-stage pointer-events-none">
        {video.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-dots">
            <Film className="size-9 text-ink-4" strokeWidth={1.5} />
          </div>
        )}
        {dimmed && <div className="absolute inset-0 bg-scrim/45" />}
        <StatusPill status={video.status} className="absolute top-2.5 left-2.5" />
        {video.duration > 0 && (
          <span className="absolute right-2.5 bottom-2.5 font-mono tabular-nums text-[11px] font-medium text-paper bg-canvas/75 px-1.5 py-[3px] rounded-xs">
            {formatDuration(video.duration)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 pl-4 pr-2.5 pt-3.5 pb-4">
        <div className="flex-1 min-w-0 flex flex-col gap-1 pointer-events-none">
          <span className="text-[14px] font-medium text-paper truncate">{video.title}</span>
          <span className="text-[12px] text-ink-3">{formatDate(video.createdAt)}</span>
        </div>
        <MoreMenu
          onOpen={() => router.push(`/editor/${video.id}`)}
          onDelete={onDelete}
        />
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
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])

  const item =
    "w-full flex items-center gap-2.5 h-8 px-2.5 rounded-[6px] text-[13px] transition-colors duration-150"

  return (
    <div ref={ref} className="relative z-10">
      <IconButton title="More" onClick={() => setOpen(o => !o)}>
        <MoreHorizontal className="size-4" />
      </IconButton>
      {open && (
        <div className="absolute right-0 bottom-full mb-1.5 w-44 p-1.5 rounded-lg bg-elevated border border-line/12 shadow-[var(--shadow-menu)]">
          <button onClick={onOpen} className={`${item} text-paper hover:bg-hover`}>
            <Pencil className="size-[15px] text-ink-3" strokeWidth={1.75} />
            Open in editor
          </button>
          <button
            onClick={() => {
              setOpen(false)
              onDelete()
            }}
            className={`${item} text-danger-ink hover:bg-danger/14`}
          >
            <Trash2 className="size-[15px]" strokeWidth={1.75} />
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center">
      <div className="flex flex-col items-center text-center gap-5 max-w-[380px]">
        <div className="size-[60px] rounded-2xl bg-surface border border-line/8 flex items-center justify-center">
          <Film className="size-6 text-accent-ink" strokeWidth={1.5} />
        </div>
        <h1 className="font-serif text-[40px] leading-[1.05] text-paper">
          No projects <em className="italic">yet</em>
        </h1>
        <p className="text-[14px] leading-relaxed text-ink-3">
          Upload your first video to start adding subtitles automatically with AI.
        </p>
        <Button onClick={onUpload}>
          <Upload className="size-4" />
          Upload video
        </Button>
      </div>
    </div>
  )
}
