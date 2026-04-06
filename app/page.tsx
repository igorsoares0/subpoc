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
  CheckCircle2,
} from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0c0c0e] text-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.04] bg-[#0c0c0e]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <h1 className="text-[15px] font-bold tracking-wide bg-gradient-to-r from-[#2563eb] to-[#60a5fa] bg-clip-text text-transparent">
            SUPERTITLE
          </h1>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-[13px] text-zinc-400 hover:text-white px-4 py-2 rounded-lg transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="text-[13px] font-medium bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-40 pb-24 px-6">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-600/[0.07] rounded-full blur-[120px]" />
        </div>

        <div className="max-w-3xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/[0.06] rounded-full px-4 py-1.5 mb-8">
            <Zap className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[12px] text-zinc-400">AI-powered subtitle generation</span>
          </div>

          <h2 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
            Subtitles that make
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
              your videos shine
            </span>
          </h2>

          <p className="text-lg text-zinc-400 max-w-xl mx-auto mb-10 leading-relaxed">
            Upload your video, let AI transcribe it, customize the style, and
            export — all in one beautiful editor. Ready for YouTube, TikTok, Instagram and more.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-medium text-[14px] transition-colors"
            >
              Start for free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white px-6 py-3 rounded-xl font-medium text-[14px] transition-colors"
            >
              <Play className="w-4 h-4" />
              Watch demo
            </Link>
          </div>
        </div>
      </section>

      {/* Editor Preview */}
      <section className="px-6 pb-24">
        <div className="max-w-5xl mx-auto">
          <div className="bg-[#16161a] border border-white/[0.06] rounded-2xl p-2 shadow-2xl shadow-blue-600/[0.03]">
            <div className="bg-[#0a0a0c] rounded-xl aspect-[16/9] flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/[0.03] to-transparent" />
              <div className="text-center relative">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
                  <Subtitles className="w-7 h-7 text-blue-400" />
                </div>
                <p className="text-zinc-500 text-[13px]">Editor preview</p>
              </div>

              {/* Fake subtitle overlay */}
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
                <div className="bg-black/70 backdrop-blur-sm px-6 py-2.5 rounded-lg">
                  <p className="text-white font-semibold text-lg tracking-wide">
                    YOUR <span className="text-blue-400">SUBTITLES</span> HERE
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-24 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold mb-4">Everything you need</h3>
            <p className="text-zinc-500 max-w-md mx-auto">
              From transcription to export, a complete workflow for professional subtitles.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
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
            ].map((feature) => (
              <div
                key={feature.title}
                className="bg-[#16161a] border border-white/[0.04] rounded-xl p-6 hover:border-white/[0.08] transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-600/10 border border-blue-600/20 flex items-center justify-center mb-4 group-hover:bg-blue-600/15 transition-colors">
                  <feature.icon className="w-5 h-5 text-blue-400" />
                </div>
                <h4 className="font-semibold text-[15px] mb-2">{feature.title}</h4>
                <p className="text-[13px] text-zinc-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-6 py-24 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold mb-4">Simple pricing</h3>
            <p className="text-zinc-500">Start free. Upgrade when you need more.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {[
              {
                name: "Free",
                price: "$0",
                minutes: "10 min",
                features: ["AI Transcription", "Basic templates", "SRT/VTT export"],
                cta: "Get started",
                highlight: false,
              },
              {
                name: "Basic",
                price: "$9",
                minutes: "100 min",
                features: ["All templates", "Video rendering", "Logo overlay", "Priority processing"],
                cta: "Start trial",
                highlight: true,
              },
              {
                name: "Pro",
                price: "$29",
                minutes: "500 min",
                features: ["Everything in Basic", "Custom fonts", "API access", "Priority support"],
                cta: "Start trial",
                highlight: false,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl p-6 border transition-colors ${
                  plan.highlight
                    ? "bg-blue-600/[0.06] border-blue-500/20"
                    : "bg-[#16161a] border-white/[0.04] hover:border-white/[0.08]"
                }`}
              >
                <div className="mb-6">
                  <p className="text-[12px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">{plan.name}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-zinc-500 text-sm">/mo</span>
                  </div>
                  <p className="text-[13px] text-zinc-500 mt-1">{plan.minutes} of video</p>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-[13px] text-zinc-300">
                      <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/register"
                  className={`block text-center py-2.5 rounded-lg font-medium text-[13px] transition-colors ${
                    plan.highlight
                      ? "bg-blue-600 hover:bg-blue-500 text-white"
                      : "bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.04] px-6 py-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <p className="text-[12px] text-zinc-600">
            SUPERTITLE &mdash; AI-powered video subtitles
          </p>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors">
              Sign in
            </Link>
            <Link href="/register" className="text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
