import Link from "next/link"
import {
  Subtitles,
  Wand2,
  Download,
  Zap,
  Languages,
  Palette,
  ArrowRight,
  Play,
  Check,
} from "lucide-react"
import { Wordmark } from "@/components/ui/Wordmark"
import { buttonClass } from "@/components/ui/Button"
import { PLANS } from "@/lib/plans"
import { cn } from "@/lib/utils"

const FEATURES = [
  {
    icon: Wand2,
    title: "AI Transcription",
    desc: "Automatic speech-to-text powered by OpenAI Whisper with word-level timing.",
  },
  {
    icon: Palette,
    title: "Custom Styles",
    desc: "15+ templates including Hormozi-style captions. Full control over fonts, colors and position.",
  },
  {
    icon: Languages,
    title: "Multi-format Export",
    desc: "Export as SRT, VTT, or render directly into your video. Supports all aspect ratios.",
  },
  {
    icon: Subtitles,
    title: "Word-by-word Karaoke",
    desc: "Highlight words as they're spoken. Perfect for short-form content and reels.",
  },
  {
    icon: Download,
    title: "Burn-in Rendering",
    desc: "Render subtitles directly into your video with one click. No extra software needed.",
  },
  {
    icon: Play,
    title: "Visual Timeline",
    desc: "Filmstrip timeline with trim handles, real-time preview, and instant seek.",
  },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-canvas text-paper">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-line/8 bg-canvas/85 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <Wordmark size={26} />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="text-[13.5px] font-medium text-ink-2 hover:text-paper px-3.5 h-9 flex items-center rounded-md hover:bg-elevated transition-colors"
            >
              Sign in
            </Link>
            <Link href="/register" className={buttonClass("primary", "sm", "text-[13px]")}>
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-40 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-surface border border-line/8 rounded-full px-3.5 h-8 mb-8">
            <Zap className="size-3.5 text-accent-ink" />
            <span className="text-[12.5px] text-ink-2">AI-powered subtitle generation</span>
          </div>

          <h1 className="font-serif text-[64px] sm:text-[84px] leading-[1.02] tracking-[-0.01em] mb-6">
            Subtitles that make
            <br />
            <em className="italic">your videos shine</em>
            <span className="text-accent-ink">.</span>
          </h1>

          <p className="text-[17px] text-ink-3 max-w-xl mx-auto mb-10 leading-relaxed">
            Upload your video, let AI transcribe it, customize the style, and
            export — all in one beautiful editor. Ready for YouTube, TikTok, Instagram and more.
          </p>

          <div className="flex items-center justify-center gap-3">
            <Link href="/register" className={buttonClass("primary", "lg", "px-6")}>
              Start for free
              <ArrowRight className="size-4" />
            </Link>
            <Link href="/login" className={buttonClass("ghost", "lg", "px-6")}>
              <Play className="size-4" />
              Watch demo
            </Link>
          </div>
        </div>
      </section>

      {/* Editor Preview */}
      <section className="px-6 pb-24">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl border border-line/8 bg-stage bg-dots p-10 sm:p-14 shadow-[var(--shadow-lg)]">
            {/* Video content never changes with theme */}
            <div
              className="relative aspect-[16/9] rounded-sm overflow-hidden shadow-[var(--shadow-lg)]"
              style={{ background: "radial-gradient(120% 90% at 50% 35%, #4a4a44 0%, #1D1D1A 55%, #0E0E0C 100%)" }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="size-14 rounded-full bg-white/10 flex items-center justify-center">
                  <Play className="size-6 text-white/80 ml-0.5" fill="currentColor" />
                </div>
              </div>
              <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span
                  className="relative text-white"
                  style={{
                    fontFamily: "var(--font-montserrat), Montserrat, sans-serif",
                    fontWeight: 900,
                    fontSize: "clamp(18px, 3.4vw, 34px)",
                    textShadow: "2px 0 #000,-2px 0 #000,0 2px #000,0 -2px #000,0 4px 12px rgba(0,0,0,0.5)",
                  }}
                >
                  YOUR <span style={{ color: "#FFD700" }}>SUBTITLES</span> HERE
                  <span className="absolute -inset-2 border-[1.5px] border-accent rounded-[2px]" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-24 border-t border-line/8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-serif text-[52px] leading-[1.02] mb-4">
              Everything <em className="italic">you need</em>
            </h2>
            <p className="text-[15px] text-ink-3 max-w-md mx-auto">
              From transcription to export, a complete workflow for professional subtitles.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="bg-surface border border-line/8 rounded-xl p-6 transition-colors duration-150 hover:border-accent/45"
              >
                <div className="size-10 rounded-lg bg-canvas border border-line/8 flex items-center justify-center mb-4">
                  <feature.icon className="size-[18px] text-accent-ink" strokeWidth={1.75} />
                </div>
                <h3 className="font-semibold text-[15px] mb-2">{feature.title}</h3>
                <p className="text-[13.5px] text-ink-3 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing — same source of truth as billing (lib/plans) */}
      <section className="px-6 py-24 border-t border-line/8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-serif text-[52px] leading-[1.02] mb-4">
              Simple <em className="italic">pricing</em>
            </h2>
            <p className="text-[15px] text-ink-3">Start free. Upgrade when you need more.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.values(PLANS).map((plan) => {
              const highlight = plan.id === "starter"
              return (
                <div
                  key={plan.id}
                  className={cn(
                    "rounded-2xl bg-surface border p-6 flex flex-col gap-5",
                    highlight ? "border-ring" : "border-line/8"
                  )}
                >
                  <div className="flex items-center justify-between h-[22px]">
                    <span className="text-[15px] font-semibold">{plan.name}</span>
                    {highlight && (
                      <span className="h-[22px] px-[9px] rounded-full bg-accent text-on-accent flex items-center text-[11px] font-semibold">
                        Popular
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-serif text-[64px] leading-none">${plan.priceUsd}</span>
                    <span className="text-[13px] text-ink-3">/ month</span>
                  </div>
                  <ul className="flex flex-col gap-2.5 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-[13.5px] leading-[1.4] text-ink-2">
                        <Check className="size-3.5 text-accent-ink mt-[3px] shrink-0" strokeWidth={2.25} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/register"
                    className={buttonClass(highlight ? "primary" : "ghost", "md", "w-full")}
                  >
                    {plan.priceUsd === 0 ? "Get started" : `Start with ${plan.name}`}
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line/8 px-6 py-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wordmark size={20} />
            <span className="text-[12px] text-ink-4">AI-powered video subtitles</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-[12.5px] text-ink-3 hover:text-paper transition-colors">
              Sign in
            </Link>
            <Link href="/register" className="text-[12.5px] text-ink-3 hover:text-paper transition-colors">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
