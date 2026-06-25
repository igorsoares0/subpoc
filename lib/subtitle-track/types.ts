export interface SubtitleWord {
  word: string;
  start: number;
  end: number;
  /** Semantic keyword emphasis (item 2) — persistent, independent of the
   * time-based active-word highlight. Annotated post-transcription. */
  emphasis?: boolean;
}

export interface Subtitle {
  id: number;
  start: number;
  end: number;
  text: string;
  words?: SubtitleWord[];
}

export interface SubtitleStyle {
  fontFamily: string;
  fontSize: number;
  /** Largura da caixa de legenda em % da largura do vídeo. Default 90. */
  boxWidth?: number;
  fontWeight?: number;
  color: string;
  backgroundColor: string;
  backgroundOpacity: number;
  position: { x: number; y: number } | string;
  alignment: string;
  outline: boolean;
  outlineColor: string;
  outlineWidth: number;
  highlightColor?: string;
  highlightBg?: string;
  highlightBgOpacity?: number;
  /** Keyword emphasis color (item 2) — persistent color for words flagged
   * `emphasis`, independent of the time-based active-word highlight. */
  emphasisColor?: string;
  displayMode?: "sentence" | "word-group";
  /** Auto-split (item 4): hard cap on words per chunk in word-group mode. */
  wordsPerGroup?: number;
  /** Auto-split: soft cap on characters per chunk. Falls back to a sane default. */
  maxCharsPerGroup?: number;
  /** Auto-split: silent gap (seconds) between words that forces a new chunk. */
  splitPauseGap?: number;
  uppercase?: boolean;
  /** Per-word entrance animation played as each word becomes active
   * (word-group mode only). Default: "none". */
  animationMode?: "none" | "pop" | "scale" | "slide-up" | "fade";
}

/**
 * Static headline/CTA overlay drawn on top of the video (item 5). Persistent
 * (not time-gated), so it appears on every rendered frame — the worker captures
 * it in the blank frame and every keyframe with no pipeline change.
 */
export interface HookOverlay {
  text: string;
  /** Percentage position of the box center. Default top-center {50, 12}. */
  position: { x: number; y: number };
  fontFamily: string;
  fontSize: number;
  fontWeight?: number;
  color: string;
  backgroundColor: string;
  backgroundOpacity: number;
  outline: boolean;
  outlineColor: string;
  outlineWidth: number;
  uppercase?: boolean;
}
