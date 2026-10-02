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
import { Highlight } from "@/components/ui/Highlight"
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
      <nav className="fixed top-0 left-0 right-0 z-50 bg-canvas/85 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-[72px] flex items-center justify-between">
          <Link href="/" aria-label="Supertitle home" className="hover:text-paper">
            <Wordmark size={22} />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="text-[14px] font-semibold text-ink-3 hover:text-paper px-3.5 h-9 flex items-center rounded-full"
            >
              Sign in
            </Link>
            <Link href="/register" className={buttonClass("primary", "sm", "px-4 hover:text-on-accent")}>
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-40 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-accent-tint text-accent-ink rounded-full px-3.5 h-8 mb-8">
            <Zap className="size-3.5" />
            <span className="text-[12.5px] font-bold">AI-powered subtitle generation</span>
          </div>

          <h1 className="display text-[56px] sm:text-[80px] leading-[0.95] tracking-[-0.045em] mb-7">
            Subtitles that make
            <br />
            your videos <Highlight className="px-2">shine.</Highlight>
          </h1>

          <p className="text-[17px] text-ink-2 max-w-xl mx-auto mb-10 leading-relaxed">
            Upload your video, let AI transcribe it, customize the style, and
            export — all in one beautiful editor. Ready for YouTube, TikTok, Instagram and more.
          </p>

          <div className="flex items-center justify-center gap-3">
            <Link href="/register" className={buttonClass("primary", "2xl", "hover:text-on-accent")}>
              Start for free
              <ArrowRight className="size-4" />
            </Link>
            <Link href="/login" className={buttonClass("secondary", "2xl", "hover:text-paper")}>
              <Play className="size-4" />
              Watch demo
            </Link>
          </div>
        </div>
      </section>

      {/* Editor Preview */}
      <section className="px-6 pb-24">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-[20px] bg-stage p-10 sm:p-14">
            {/* Video content never changes with theme */}
            <div
              className="relative aspect-[16/9] rounded-2xl overflow-hidden"
              style={{ background: "radial-gradient(120% 90% at 50% 35%, #5a5a55 0%, #2c2c29 55%, #0D0D0D 100%)" }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="size-14 rounded-full bg-white/10 flex items-center justify-center">
                  <Play className="size-6 text-white/80 ml-0.5" fill="currentColor" />
                </div>
              </div>
              <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span
                  className="relative block px-2 py-1 text-white rounded outline-2 outline-offset-2 outline-accent"
                  style={{
                    fontFamily: "var(--font-montserrat), Montserrat, sans-serif",
                    fontWeight: 900,
                    fontSize: "clamp(18px, 3.4vw, 34px)",
                    WebkitTextStroke: "5px #000",
                    paintOrder: "stroke fill",
                  }}
                >
                  YOUR <span style={{ color: "#FFE14D" }}>SUBTITLES</span> HERE
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="display text-[48px] mb-4">
              Everything you <Highlight className="px-1.5">need</Highlight>
            </h2>
            <p className="text-[15px] text-ink-3 max-w-md mx-auto">
              From transcription to export, a complete workflow for professional subtitles.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="bg-surface rounded-[18px] p-6"
              >
                <div className="size-10 rounded-full bg-accent text-white flex items-center justify-center mb-4">
                  <feature.icon className="size-[18px]" strokeWidth={2} />
                </div>
                <h3 className="font-bold text-[16px] mb-2">{feature.title}</h3>
                <p className="text-[14px] text-ink-2 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing — same source of truth as billing (lib/plans) */}
      <section className="px-6 py-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="display text-[48px] mb-4">
              Simple <Highlight className="px-1.5">pricing</Highlight>
            </h2>
            <p className="text-[15px] text-ink-3">Start free. Upgrade when you need more.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.values(PLANS).map((plan) => {
              const highlight = plan.id === "starter"
              return (
                <div key={plan.id} className="rounded-[18px] bg-surface p-6 flex flex-col gap-[18px]">
                  <div className="flex items-center justify-between h-[26px]">
                    <span className="text-[17px] font-bold">{plan.name}</span>
                    {highlight && (
                      <span className="h-6 px-2.5 rounded-full bg-accent-tint text-accent-ink flex items-center text-[11.5px] font-bold">
                        Most picked
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="display text-[64px] leading-[0.9] tracking-[-0.045em]">${plan.priceUsd}</span>
                    <span className="text-[14px] text-ink-3">/ month</span>
                  </div>
                  <ul className="flex flex-col gap-[9px] flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-[9px] text-[14px] leading-[1.4]">
                        <Check className="size-[15px] text-accent-ink mt-0.5 shrink-0" strokeWidth={2} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/register"
                    className={buttonClass(highlight ? "primary" : "inverse", "xl", cn("w-full", highlight ? "hover:text-on-accent" : "hover:text-canvas"))}
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
      <footer className="border-t border-line/12 px-6 py-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wordmark size={20} />
            <span className="text-[12.5px] text-ink-3">AI-powered video subtitles</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-[13px] font-semibold text-ink-3 hover:text-paper">
              Sign in
            </Link>
            <Link href="/register" className="text-[13px] font-semibold text-ink-3 hover:text-paper">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
