import { cn } from "@/lib/utils"

/**
 * Stylized 9:16 video frame with a burned-in caption ("O ASSUNTO DO").
 * Marketing illustration only (auth panel, empty dashboard) — video content
 * never changes with theme.
 */
export function SampleFrame({
  width,
  height,
  fontSize = 24,
  captionTop = "54%",
  trailing = "DO",
  className,
  style,
}: {
  width: number
  height: number
  fontSize?: number
  /** Vertical position of the caption (CSS top). */
  captionTop?: string
  /** Word after the highlighted keyword ("" to omit). */
  trailing?: string
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      aria-hidden
      className={cn("relative flex-none overflow-hidden bg-black", className)}
      style={{
        width,
        height,
        background: "radial-gradient(120% 70% at 50% 34%, #5a5a55 0%, #2c2c29 45%, #0D0D0D 100%)",
        ...style,
      }}
    >
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
      <span
        className="absolute inset-x-0 text-center text-white whitespace-nowrap"
        style={{
          top: captionTop,
          fontFamily: "var(--font-montserrat), Montserrat, sans-serif",
          fontWeight: 900,
          fontSize,
          WebkitTextStroke: `${Math.max(3, Math.round(fontSize / 5))}px #000`,
          paintOrder: "stroke fill",
        }}
      >
        O <span style={{ color: "#FFE14D" }}>ASSUNTO</span>
        {trailing && ` ${trailing}`}
      </span>
    </div>
  )
}
