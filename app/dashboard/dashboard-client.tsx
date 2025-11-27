"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import NewProjectModal from "@/components/new-project-modal"

interface User {
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
  user: User
  initialVideos: VideoProject[]
}

export default function DashboardClient({ user, initialVideos }: DashboardClientProps) {
  const router = useRouter()
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
  const [videos, setVideos] = useState(initialVideos)

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" })
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds)
    const secs = Math.round((seconds - mins) * 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      uploading: "bg-blue-500/10 text-blue-500 border-blue-500/50",
      transcribing: "bg-yellow-500/10 text-yellow-500 border-yellow-500/50",
      ready: "bg-green-500/10 text-green-500 border-green-500/50",
      rendering: "bg-purple-500/10 text-purple-500 border-purple-500/50",
      completed: "bg-green-500/10 text-green-500 border-green-500/50",
      failed: "bg-red-500/10 text-red-500 border-red-500/50",
    }

    return (
      <span className={`px-2 py-1 rounded text-xs border ${styles[status as keyof typeof styles] || styles.ready}`}>
        {status}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white flex p-6 gap-4">
      {/* Sidebar */}
      <aside className="w-64 bg-[#1b1a1d] rounded-[10px] flex flex-col p-6">
        <div className="mb-8">
          <h1 className="text-[20px] font-bold bg-gradient-to-r from-[#9740fe] to-[#b679fe] bg-clip-text text-transparent">
            SUPERTITLE
          </h1>
        </div>

        <nav className="flex-1">
          <Link
            href="/dashboard"
            className="flex items-center px-4 py-3 mb-2 rounded-[8px] bg-purple-600/20 text-purple-400 font-medium"
          >
            Dashboard
          </Link>
          <Link
            href="/dashboard/profile"
            className="flex items-center px-4 py-3 mb-2 rounded-[8px] text-gray-400 hover:bg-zinc-800/50 hover:text-white transition-colors"
          >
            Profile
          </Link>
          <Link
            href="/dashboard/settings"
            className="flex items-center px-4 py-3 mb-2 rounded-[8px] text-gray-400 hover:bg-zinc-800/50 hover:text-white transition-colors"
          >
            Settings
          </Link>
        </nav>

        <div>
          <button className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white py-3 rounded-[8px] font-medium hover:opacity-90 transition-opacity">
            Upgrade Plan
          </button>
          <button
            onClick={handleSignOut}
            className="w-full mt-2 text-gray-400 hover:text-white py-2 text-sm transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-[28px] font-semibold text-white">
                Welcome back, {user.name || user.email?.split("@")[0]}
              </h2>
            </div>
            <button
              onClick={() => setShowNewProjectModal(true)}
              className="flex items-center gap-2 bg-[#9740fe] text-white px-6 py-3 rounded-[8px] font-medium hover:opacity-90 transition-opacity"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Project
            </button>
          </div>

          {/* Video Grid or Empty State */}
          {videos.length === 0 ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <div className="text-6xl text-gray-700 mb-4">🎬</div>
                <h3 className="text-[22px] font-semibold text-gray-400 mb-2">
                  No videos yet
                </h3>
                <p className="text-[14px] text-gray-500 mb-6">
                  Upload your first video to get started
                </p>
                <button
                  onClick={() => setShowNewProjectModal(true)}
                  className="bg-[#9740fe] text-white px-8 py-3 rounded-[8px] font-medium hover:opacity-90 transition-opacity"
                >
                  Upload Video
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map((video) => (
                <Link
                  key={video.id}
                  href={`/editor/${video.id}`}
                  className="group bg-[#1b1a1d] rounded-[10px] overflow-hidden border border-zinc-800/50 hover:border-purple-500 transition-all"
                >
                  <div className="aspect-video bg-zinc-800 relative overflow-hidden">
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-16 h-16 text-zinc-700" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm12.553 1.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      {getStatusBadge(video.status)}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium text-white mb-1 truncate group-hover:text-purple-400 transition-colors">
                      {video.title}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {formatDuration(video.duration)} min • {new Date(video.createdAt).toLocaleDateString()}
                    </p>
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
