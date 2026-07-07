import type { SubtitleStyle } from "./types";

/**
 * Base subtitle style. Single source of truth — used as the editor's starting
 * point and as the merge base when applying a preset, so optional fields left
 * over from a previous preset (highlightBg, animationMode, emphasisColor, …)
 * are reset rather than silently inherited.
 */
export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontFamily: "Arial",
  fontSize: 24,
  boxWidth: 90,
  fontWeight: 700,
  color: "#FFFFFF",
  backgroundColor: "#000000",
  backgroundOpacity: 0,
  position: { x: 50, y: 90 },
  alignment: "center",
  outline: false,
  outlineColor: "#000000",
  outlineWidth: 0,
  highlightColor: undefined,
  highlightBg: undefined,
  highlightBgOpacity: undefined,
  emphasisColor: undefined,
  displayMode: "sentence",
  wordsPerGroup: 3,
  maxCharsPerGroup: undefined,
  splitPauseGap: undefined,
  uppercase: false,
  animationMode: "none",
  animationIntensity: "medium",
};

export interface SubtitlePreset {
  /** Stable id — used for active-preset detection and analytics. */
  id: string;
  name: string;
  style: SubtitleStyle;
}

/** Build a complete style from partial overrides on top of the base. */
function preset(id: string, name: string, overrides: Partial<SubtitleStyle>): SubtitlePreset {
  return { id, name, style: { ...DEFAULT_SUBTITLE_STYLE, ...overrides } };
}

/**
 * Curated subtitle presets. Each one is a distinct "look" that leverages the
 * full feature set (entrance animations, keyword emphasis, auto-split), so
 * applying a preset gives a finished result without touching the sliders.
 *
 * Ordered: clean/sentence styles first, then the high-energy word-group
 * ("viral") styles that drive most short-form content.
 */
export const SUBTITLE_PRESETS: SubtitlePreset[] = [
  // --- Sentence styles (full-line captions) ---
  preset("clean", "Clean", {
    fontFamily: "Inter",
    fontSize: 22,
    fontWeight: 700,
    color: "#FFFFFF",
    outline: true,
    outlineColor: "#000000",
    outlineWidth: 2,
    position: { x: 50, y: 90 },
    displayMode: "sentence",
  }),
  preset("cinema", "Cinema", {
    fontFamily: "Helvetica",
    fontSize: 22,
    fontWeight: 600,
    color: "#FFFFFF",
    backgroundColor: "#000000",
    backgroundOpacity: 1,
    position: { x: 50, y: 92 },
    displayMode: "sentence",
  }),
  preset("minimal", "Minimal", {
    fontFamily: "Inter",
    fontSize: 18,
    fontWeight: 600,
    color: "#FFFFFF",
    outline: true,
    outlineColor: "#000000",
    outlineWidth: 1,
    position: { x: 50, y: 92 },
    displayMode: "sentence",
  }),
  preset("classic", "Classic", {
    fontFamily: "Roboto",
    fontSize: 22,
    fontWeight: 500,
    color: "#FFFFFF",
    backgroundColor: "#000000",
    backgroundOpacity: 0.75,
    position: { x: 50, y: 90 },
    displayMode: "sentence",
  }),
  preset("classic-yellow", "Classic Yellow", {
    fontFamily: "Roboto",
    fontSize: 22,
    fontWeight: 700,
    color: "#FFE600",
    outline: true,
    outlineColor: "#000000",
    outlineWidth: 2,
    position: { x: 50, y: 90 },
    displayMode: "sentence",
  }),
  preset("light", "Light", {
    fontFamily: "Inter",
    fontSize: 20,
    fontWeight: 700,
    color: "#111111",
    backgroundColor: "#FFFFFF",
    backgroundOpacity: 0.95,
    position: { x: 50, y: 90 },
    displayMode: "sentence",
  }),
  preset("bold", "Bold", {
    fontFamily: "Montserrat",
    fontSize: 28,
    fontWeight: 800,
    color: "#FFFFFF",
    outline: true,
    outlineColor: "#000000",
    outlineWidth: 3,
    position: { x: 50, y: 88 },
    displayMode: "sentence",
  }),

  // --- Word-group styles (one phrase at a time, animated) ---
  preset("hormozi", "Hormozi", {
    fontFamily: "Montserrat",
    fontSize: 42,
    fontWeight: 900,
    color: "#FFFFFF",
    outline: true,
    outlineColor: "#000000",
    outlineWidth: 5,
    highlightColor: "#FFD700",
    emphasisColor: "#FFD700",
    position: { x: 50, y: 50 },
    displayMode: "word-group",
    wordsPerGroup: 3,
    uppercase: true,
    animationMode: "pop",
  }),
  preset("beast", "Beast", {
    fontFamily: "Poppins",
    fontSize: 46,
    fontWeight: 900,
    color: "#FFFFFF",
    outline: true,
    outlineColor: "#000000",
    outlineWidth: 6,
    highlightColor: "#FFE600",
    emphasisColor: "#FF3B30",
    position: { x: 50, y: 50 },
    displayMode: "word-group",
    wordsPerGroup: 2,
    uppercase: true,
    animationMode: "scale",
    animationIntensity: "strong",
  }),
  preset("karaoke", "Karaoke", {
    fontFamily: "Montserrat",
    fontSize: 38,
    fontWeight: 800,
    color: "#FFFFFF",
    highlightColor: "#FFFFFF",
    highlightBg: "#22C55E",
    highlightBgOpacity: 0.95,
    emphasisColor: "#4ADE80",
    position: { x: 50, y: 88 },
    displayMode: "word-group",
    wordsPerGroup: 4,
    animationMode: "slide-up",
  }),
  preset("neon", "Neon", {
    fontFamily: "Montserrat",
    fontSize: 40,
    fontWeight: 800,
    color: "#39FF14",
    outline: true,
    outlineColor: "#003300",
    outlineWidth: 3,
    emphasisColor: "#FFFFFF",
    position: { x: 50, y: 85 },
    displayMode: "word-group",
    wordsPerGroup: 3,
    animationMode: "fade",
  }),
  preset("bold-yellow", "Bold Yellow", {
    fontFamily: "Montserrat",
    fontSize: 40,
    fontWeight: 900,
    color: "#FFEB00",
    outline: true,
    outlineColor: "#000000",
    outlineWidth: 5,
    highlightColor: "#FFFFFF",
    emphasisColor: "#FFFFFF",
    position: { x: 50, y: 50 },
    displayMode: "word-group",
    wordsPerGroup: 3,
    uppercase: true,
    animationMode: "pop",
  }),
  preset("candy", "Candy", {
    fontFamily: "Poppins",
    fontSize: 42,
    fontWeight: 900,
    color: "#FFFFFF",
    backgroundColor: "#FF1493",
    backgroundOpacity: 0.9,
    highlightColor: "#FFFF00",
    emphasisColor: "#FFFF00",
    position: { x: 50, y: 50 },
    displayMode: "word-group",
    wordsPerGroup: 3,
    uppercase: true,
    animationMode: "pop",
  }),
  preset("ice", "Ice", {
    fontFamily: "Inter",
    fontSize: 40,
    fontWeight: 900,
    color: "#FFFFFF",
    outline: true,
    outlineColor: "#001A33",
    outlineWidth: 5,
    highlightColor: "#38BDF8",
    emphasisColor: "#38BDF8",
    position: { x: 50, y: 50 },
    displayMode: "word-group",
    wordsPerGroup: 4,
    uppercase: true,
    animationMode: "scale",
  }),
  preset("flash", "Flash", {
    fontFamily: "Montserrat",
    fontSize: 44,
    fontWeight: 900,
    color: "#FFFFFF",
    outline: true,
    outlineColor: "#000000",
    outlineWidth: 5,
    highlightColor: "#FFFFFF",
    highlightBg: "#E63946",
    highlightBgOpacity: 0.95,
    emphasisColor: "#FF4D4D",
    position: { x: 50, y: 50 },
    displayMode: "word-group",
    wordsPerGroup: 3,
    uppercase: true,
    animationMode: "pop",
    animationIntensity: "strong",
  }),
  preset("sunset", "Sunset", {
    fontFamily: "Poppins",
    fontSize: 42,
    fontWeight: 900,
    color: "#FFFFFF",
    outline: true,
    outlineColor: "#000000",
    outlineWidth: 5,
    highlightColor: "#FF6B35",
    emphasisColor: "#FF6B35",
    position: { x: 50, y: 50 },
    displayMode: "word-group",
    wordsPerGroup: 2,
    uppercase: true,
    animationMode: "slide-up",
  }),
];

/** Visual-identity fields that define a preset (position/box excluded, since
 * the user is free to reposition without losing the preset identity). */
const MATCH_FIELDS: (keyof SubtitleStyle)[] = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "color",
  "backgroundColor",
  "backgroundOpacity",
  "outline",
  "outlineColor",
  "outlineWidth",
  "highlightColor",
  "highlightBg",
  "emphasisColor",
  "displayMode",
  "uppercase",
  "animationMode",
  // animationIntensity intentionally excluded: presets are already unique on the
  // fields above, and including it would drop active-preset detection for
  // projects saved before the field existed.
];

/** True when `style` still matches the preset's visual identity. Used to mark
 * the active preset in the UI; returns false once the user tweaks a field. */
export function matchesPreset(style: SubtitleStyle | null | undefined, p: SubtitlePreset): boolean {
  if (!style) return false;
  return MATCH_FIELDS.every((f) => (style[f] ?? undefined) === (p.style[f] ?? undefined));
}

/** The preset whose visual identity the given style currently matches, if any. */
export function findActivePreset(style: SubtitleStyle | null | undefined): SubtitlePreset | undefined {
  return SUBTITLE_PRESETS.find((p) => matchesPreset(style, p));
}
