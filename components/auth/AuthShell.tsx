import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { Wordmark } from "@/components/ui/Wordmark"
import { Highlight } from "@/components/ui/Highlight"
import { SampleFrame } from "@/components/ui/SampleFrame"

/**
 * Split-screen auth layout: solid accent panel with the tagline and a tilted
 * sample frame on the left (lg+ only), form column (max 400px) on the right.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-accent text-white px-14 py-10">
        <Link href="/" className="self-start hover:text-white" aria-label="Supertitle home">
          <Wordmark size={26} inverse />
        </Link>
        <div className="relative z-[1] flex flex-col gap-[18px]">
          <p className="font-black stretch-wide text-[76px] leading-[0.92] tracking-[-0.045em]">
            Subtitles
            <br />
            that keep
            <br />
            them <Highlight tone="yellow" className="px-2">watching.</Highlight>
          </p>
          <p className="text-[17px] font-medium opacity-[0.88]">Auto-transcribe, style and render — in minutes.</p>
        </div>
        <SampleFrame
          width={250}
          height={444}
          fontSize={23}
          captionTop="52%"
          trailing=""
          className="absolute -right-[30px] top-[120px] rounded-[18px] rotate-6 shadow-[0_30px_60px_rgba(0,0,0,0.25)]"
        />
      </aside>

      <main className="flex items-center justify-center px-6 sm:px-12 py-12">
        <div className="w-full max-w-[400px] flex flex-col gap-[22px]">
          <Link href="/" className="lg:hidden self-start mb-2 hover:text-paper" aria-label="Supertitle home">
            <Wordmark size={24} />
          </Link>
          {children}
        </div>
      </main>
    </div>
  )
}

/** Display L heading; `highlight` renders as the accent highlight block. */
export function AuthHeading({
  title,
  highlight,
  subtitle,
}: {
  title: string
  highlight?: string
  subtitle?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="display text-[48px] text-paper">
        {title}
        {highlight && (
          <>
            {" "}
            <Highlight className="px-1.5">{highlight}</Highlight>
          </>
        )}
      </h1>
      {subtitle && <p className="text-[15px] leading-normal text-ink-3">{subtitle}</p>}
    </div>
  )
}

export function OrDivider({ label = "or with email" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-[12px] text-ink-3">
      <span className="flex-1 h-px bg-line/12" />
      {label}
      <span className="flex-1 h-px bg-line/12" />
    </div>
  )
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-paper font-semibold underline underline-offset-[3px] hover:text-accent-ink">
      {children}
    </Link>
  )
}

/** Confirmation state (check email, link expired, success…). */
export function AuthState({
  icon: Icon,
  title,
  highlight,
  children,
  action,
  tone = "accent",
}: {
  icon: LucideIcon
  title: string
  highlight?: string
  children?: React.ReactNode
  action?: React.ReactNode
  tone?: "accent" | "danger"
}) {
  return (
    <div className="flex flex-col gap-[22px]">
      <span
        className={`size-16 rounded-full flex items-center justify-center text-white ${tone === "danger" ? "bg-danger" : "bg-accent"}`}
      >
        <Icon className="size-7" strokeWidth={2} />
      </span>
      <h1 className="display text-[48px] text-paper">
        {title}
        {highlight && (
          <>
            {" "}
            <Highlight tone={tone === "danger" ? "danger" : "accent"} className="px-1.5">
              {highlight}
            </Highlight>
          </>
        )}
      </h1>
      {children && <div className="text-[16px] leading-normal text-ink-2 text-pretty">{children}</div>}
      {action && <div className="flex">{action}</div>}
    </div>
  )
}
