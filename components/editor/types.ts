export interface LogoOverlay {
  logoUrl: string | null
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  size: number  // percentage (5-20)
  opacity: number  // 0-1
}

/** Right-column tab. The script (transcript) is always on the left. */
export type EditorPanel = "looks" | "text" | "overlays"

// Mapeamento de formatos para exibição e backend
export const FORMAT_OPTIONS = [
  { label: "Original", value: null, aspectRatio: null },
  { label: "16:9", value: "youtube", aspectRatio: 16 / 9 },
  { label: "9:16", value: "instagram_story", aspectRatio: 9 / 16 },
  { label: "1:1", value: "instagram_feed", aspectRatio: 1 },
  { label: "4:3", value: "classic", aspectRatio: 4 / 3 },
] as const

export function getFormatLabel(backendValue: string | null): string {
  return FORMAT_OPTIONS.find((f) => f.value === backendValue)?.label || "Original"
}

export function getFormatAspectRatio(backendValue: string | null): number | null {
  return FORMAT_OPTIONS.find((f) => f.value === backendValue)?.aspectRatio || null
}

// Quick-pick palette for subtitle/background colors — the most common
// caption colors so users don't have to fish in the native color picker.
export const COLOR_PRESETS = [
  "#FFFFFF", "#FFD700", "#00E676", "#00E5FF",
  "#FF5252", "#FF4FD8", "#FF9100", "#000000",
]

/** 0:01.20 — timeline / transcript timecodes. */
export function formatTimecode(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const cs = Math.floor((seconds % 1) * 100)
  return `${m}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`
}

/** 0:18 — compact duration. */
export function formatShort(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, "0")}`
}
