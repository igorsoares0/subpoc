export { SubtitleTrack } from "./SubtitleTrack";
export type { SubtitleTrackProps } from "./SubtitleTrack";
export { HookOverlay } from "./HookOverlay";
export type { HookOverlayProps } from "./HookOverlay";
export type {
  Subtitle,
  SubtitleWord,
  SubtitleStyle,
  HookOverlay as HookOverlayData,
} from "./types";
export { FONT_FAMILY_CSS, resolveFontFamily } from "./fonts";
export {
  getWordGroupDisplay,
  normalizePosition,
} from "./word-group";
export type { WordGroupDisplay } from "./word-group";
export {
  buildSegments,
  findSegmentForWord,
  DEFAULT_SEGMENT_OPTIONS,
} from "./segments";
export type { SubtitleSegment, SegmentOptions } from "./segments";
export {
  annotateKeywords,
  annotateSubtitleKeywords,
  clearSubtitleKeywords,
} from "./keywords";
export type { KeywordOptions } from "./keywords";
export {
  DEFAULT_SUBTITLE_STYLE,
  SUBTITLE_PRESETS,
  matchesPreset,
  findActivePreset,
} from "./presets";
export type { SubtitlePreset } from "./presets";
