import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { Wordmark } from "@/components/ui/Wordmark"

/**
 * Split-screen auth layout: stage panel with product preview on the left
 * (lg+ only), form column (max 400px) on the right.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <aside className="hidden lg:flex flex-col justify-between bg-stage bg-dots border-r border-line/8 px-14 py-10">
        <Link href="/" className="self-start">
          <Wordmark size={30} />
        </Link>
        <div className="flex items-end gap-8">
          <PreviewFrame />
          <div className="flex flex-col gap-3.5 pb-2 flex-none">
            <p className="font-serif text-[52px] leading-[1.14] text-paper whitespace-nowrap">
              Subtitles that
              <br />
              <em className="italic">keep them</em>
              <br />
              watching<span className="text-accent-ink">.</span>
            </p>
            <p className="text-[14px] text-ink-3">Auto-transcribe, style and render — in minutes.</p>
          </div>
        </div>
      </aside>

      <main className="flex items-center justify-center px-6 sm:px-12 py-12">
        <div className="w-full max-w-[400px] flex flex-col gap-[22px]">
          <Link href="/" className="lg:hidden self-start mb-2">
            <Wordmark size={26} />
          </Link>
          {children}
        </div>
      </main>
    </div>
  )
}

// Stylized 9:16 video frame. Video content never changes with theme.
function PreviewFrame() {
  return (
    <div
      aria-hidden
      className="relative w-[236px] h-[420px] flex-none rounded-sm overflow-hidden shadow-[var(--shadow-lg)]"
      style={{
        background:
          "radial-gradient(120% 70% at 50% 38%, #4a4a44 0%, #2a2a26 45%, #0E0E0C 100%)",
      }}
    >
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
      <div className="absolute left-3.5 right-3.5 top-[290px] flex justify-center">
        <span
          className="relative px-1 text-center text-white"
          style={{
            fontFamily: "var(--font-montserrat), Montserrat, sans-serif",
            fontWeight: 900,
            fontSize: 24,
            lineHeight: 1.1,
            textShadow:
              "2px 0 #000,-2px 0 #000,0 2px #000,0 -2px #000,0 4px 10px rgba(0,0,0,0.5)",
          }}
        >
          O <span style={{ color: "#FFD700" }}>ASSUNTO</span>
          <span className="absolute -inset-1.5 border-[1.5px] border-accent rounded-[2px]" />
          {[
            "-left-2.5 -top-2.5",
            "-right-2.5 -top-2.5",
            "-left-2.5 -bottom-2.5",
            "-right-2.5 -bottom-2.5",
          ].map((pos) => (
            <span key={pos} className={`absolute ${pos} size-2 bg-white border border-accent`} />
          ))}
        </span>
      </div>
    </div>
  )
}

export function AuthHeading({
  title,
  em,
  subtitle,
}: {
  title: string
  em?: string
  subtitle?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-serif text-[44px] leading-none text-paper tracking-[-0.01em]">
        {title}
        {em && (
          <>
            {" "}
            <em className="italic">{em}</em>
          </>
        )}
      </h1>
      {subtitle && <p className="text-[14px] text-ink-3">{subtitle}</p>}
    </div>
  )
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-[11.5px] text-ink-4">
      <span className="flex-1 h-px bg-line/8" />
      or
      <span className="flex-1 h-px bg-line/8" />
    </div>
  )
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-paper underline underline-offset-[3px] hover:text-accent-ink">
      {children}
    </Link>
  )
}

/** Centered confirmation state (check email, link expired, success…). */
export function AuthState({
  icon: Icon,
  title,
  em,
  children,
  action,
  tone = "accent",
}: {
  icon: LucideIcon
  title: string
  em?: string
  children?: React.ReactNode
  action?: React.ReactNode
  tone?: "accent" | "danger"
}) {
  return (
    <div className="flex flex-col items-center text-center gap-5 py-6">
      <div className="size-[52px] rounded-[14px] bg-surface border border-line/8 flex items-center justify-center">
        <Icon
          className={tone === "danger" ? "size-[22px] text-danger-ink" : "size-[22px] text-accent-ink"}
          strokeWidth={1.75}
        />
      </div>
      <h1 className="font-serif text-[40px] leading-[1.05] text-paper">
        {title}
        {em && (
          <>
            {" "}
            <em className="italic">{em}</em>
          </>
        )}
      </h1>
      {children && <div className="text-[14px] leading-relaxed text-ink-3 max-w-[340px]">{children}</div>}
      {action}
    </div>
  )
}
