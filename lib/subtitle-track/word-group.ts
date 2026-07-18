import type { Subtitle, SubtitleWord } from "./types";
import {
  buildSegments,
  findSegmentForWord,
  DEFAULT_SEGMENT_OPTIONS,
  type SegmentOptions,
} from "./segments";
import { normalizeWords } from "./normalize";

export interface WordGroupDisplay {
  words: SubtitleWord[];
  activeIndex: number;
}

/**
 * Returns the caption chunk to show at `currentTime` plus which word inside it
 * is currently active. Chunk boundaries come from the deterministic auto-split
 * (item 4) instead of mechanical fixed-size slicing, so pauses and long lines
 * break the caption where a viewer would expect.
 *
 * Word timings are normalized first (see ./normalize): small inter-word gaps
 * are absorbed so the chunk stays on screen for its whole duration — the
 * highlight rests on the last spoken word instead of the caption blinking off
 * between words.
 */
export function getWordGroupDisplay(
  subtitles: Subtitle[],
  currentTime: number,
  options?: Partial<SegmentOptions>,
): WordGroupDisplay | null {
  const rawWords: SubtitleWord[] = [];
  for (const sub of subtitles) {
    if (sub.words) {
      rawWords.push(...sub.words);
    }
  }
  if (rawWords.length === 0) return null;

  const pauseGap = options?.pauseGap ?? DEFAULT_SEGMENT_OPTIONS.pauseGap;
  const minGroupHold =
    options?.minGroupHold ?? DEFAULT_SEGMENT_OPTIONS.minGroupHold;

  // Two normalize passes over the same word list (same order/count/starts, so
  // indices align): `segWords` keeps the raw MIN_WORD_DURATION floor and feeds
  // segmentation, so the readability tail can't shrink a gap and merge chunks;
  // `dispWords` carries the min-group-hold tail and drives the active-word
  // lookup, so a chunk's last word stays "active" through its hold and the
  // caption lingers into the trailing silence instead of blinking off.
  const segWords = normalizeWords(rawWords, pauseGap);
  const dispWords = normalizeWords(rawWords, pauseGap, minGroupHold);

  let activeWordIdx = -1;
  for (let i = 0; i < dispWords.length; i++) {
    if (currentTime >= dispWords[i].start && currentTime < dispWords[i].end) {
      activeWordIdx = i;
      break;
    }
  }
  if (activeWordIdx === -1) return null;

  const segments = buildSegments(segWords, options);
  const segment = findSegmentForWord(segments, activeWordIdx);
  if (!segment) return null;

  return {
    words: segment.words,
    activeIndex: activeWordIdx - segment.firstIndex,
  };
}

export function normalizePosition(
  position: { x: number; y: number } | string,
): { x: number; y: number } {
  if (typeof position === "string") {
    switch (position) {
      case "top":
        return { x: 50, y: 10 };
      case "center":
        return { x: 50, y: 50 };
      case "bottom":
      default:
        return { x: 50, y: 90 };
    }
  }
  return position;
}
