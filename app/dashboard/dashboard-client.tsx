"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import NewProjectModal from "@/components/new-project-modal"
import {
  LayoutDashboard,
  User,
  Settings,
  Sparkles,
  LogOut,
  Plus,
  Film,
  Clock,
  Calendar,
  Search,
} from "lucide-react"

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
}

export default function DashboardClient({ user, initialVideos }: DashboardClientProps) {
  const router = useRouter()
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
  const [videos, setVideos] = useState(initialVideos)
  const [searchQuery, setSearchQuery] = useState("")

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" })
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds)
    const secs = Math.round((seconds - mins) * 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      uploading: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      transcribing: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
      ready: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      rendering: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      failed: "bg-red-500/10 text-red-400 border-red-500/20",
    }

    return (
      <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${styles[status] || styles.ready}`}>
        {status}
      </span>
    )
  }

  const filteredVideos = searchQuery
    ? videos.filter(v => v.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : videos

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-white flex p-4 gap-3">
      {/* Sidebar */}
      <aside className="w-[240px] bg-[#16161a] rounded-xl flex flex-col p-4 border border-white/[0.04]">
        <div className="mb-8 px-2 pt-1">
          <h1 className="text-[15px] font-bold tracking-wide bg-gradient-to-r from-[#2563eb] to-[#60a5fa] bg-clip-text text-transparent">
            SUPERTITLE
          </h1>
        </div>

        <nav className="flex-1 space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-blue-600/10 text-blue-400 font-medium text-[13px]"
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
          <Link
            href="/dashboard/profile"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300 transition-colors text-[13px]"
          >
            <User className="w-4 h-4" />
            Profile
          </Link>
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300 transition-colors text-[13px]"
          >
            <Settings className="w-4 h-4" />
            Settings
          </Link>
        </nav>

        <div className="space-y-2 pt-4 border-t border-white/[0.04]">
          <button className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg font-medium text-[13px] transition-colors">
            <Sparkles className="w-3.5 h-3.5" />
            Upgrade Plan
          </button>

          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-[11px] font-semibold text-zinc-400 uppercase">
              {(user.name || user.email)?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-zinc-300 truncate">{user.name || user.email?.split("@")[0]}</p>
              <p className="text-[11px] text-zinc-600 truncate">{user.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-md text-zinc-600 hover:bg-white/[0.06] hover:text-zinc-400 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-2">
          {/* Header */}
          <div className="flex items-center justify-between mb-8 pt-2">
            <div>
              <h2 className="text-2xl font-semibold text-white mb-1">
                Welcome back, {user.name || user.email?.split("@")[0]}
              </h2>
              <p className="text-[13px] text-zinc-500">
                {videos.length} {videos.length === 1 ? 'project' : 'projects'}
              </p>
            </div>
            <button
              onClick={() => setShowNewProjectModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-medium text-[13px] transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Project
            </button>
          </div>

          {/* Search bar (show when there are videos) */}
          {videos.length > 0 && (
            <div className="relative mb-6">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full max-w-sm bg-[#16161a] border border-white/[0.04] rounded-lg pl-10 pr-4 py-2.5 text-[13px] text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 transition-colors"
              />
            </div>
          )}

          {/* Video Grid or Empty State */}
          {videos.length === 0 ? (
            <div className="flex items-center justify-center h-[60vh]">
              <div className="text-center max-w-sm">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-5">
                  <Film className="w-7 h-7 text-zinc-600" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-300 mb-2">
                  No projects yet
                </h3>
                <p className="text-[13px] text-zinc-600 mb-6 leading-relaxed">
                  Upload your first video to start adding subtitles automatically with AI.
                </p>
                <button
                  onClick={() => setShowNewProjectModal(true)}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-medium text-[13px] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Upload Video
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVideos.map((video) => (
                <Link
                  key={video.id}
                  href={`/editor/${video.id}`}
                  className="group bg-[#16161a] rounded-xl overflow-hidden border border-white/[0.04] hover:border-blue-500/30 transition-all"
                >
                  <div className="aspect-video bg-[#0a0a0c] relative overflow-hidden">
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="w-10 h-10 text-zinc-800" />
                      </div>
                    )}
                    <div className="absolute top-2.5 right-2.5">
                      {getStatusBadge(video.status)}
                    </div>
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium text-[14px] text-white mb-2 truncate group-hover:text-blue-400 transition-colors">
                      {video.title}
                    </h3>
                    <div className="flex items-center gap-3 text-[12px] text-zinc-600">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(video.duration)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(video.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* New Project Modal */}
      <NewProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
      />
    </div>
  )
}
