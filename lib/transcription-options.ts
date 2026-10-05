// Options the user can pass when starting a transcription. Shared by the
// editor UI and /api/videos/[id]/transcribe (which validates against it).

/** "auto" → language omitted, Whisper detects it. Codes are ISO-639-1. */
export const TRANSCRIPTION_LANGUAGES = [
  { value: "auto", label: "Auto-detect" },
  { value: "pt", label: "Português" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
] as const

export type TranscriptionLanguage = (typeof TRANSCRIPTION_LANGUAGES)[number]["value"]

/** Whisper only reads the last ~224 tokens of the prompt; this keeps a
 * glossary comfortably inside that. */
export const VOCABULARY_MAX_CHARS = 600

export function isTranscriptionLanguage(v: unknown): v is TranscriptionLanguage {
  return TRANSCRIPTION_LANGUAGES.some((l) => l.value === v)
}

/** Normalizes the free-text glossary ("Supertitle, Hormozi\nCAC") into a
 * comma-separated list for the Whisper prompt. Empty → undefined. */
export function normalizeVocabulary(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined
  const terms = raw
    .split(/[,\n;]+/)
    .map((t) => t.trim())
    .filter(Boolean)
  if (terms.length === 0) return undefined
  return terms.join(", ").slice(0, VOCABULARY_MAX_CHARS)
}
