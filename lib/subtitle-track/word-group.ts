import type { Subtitle, SubtitleWord } from "./types";
import {
  buildSegments,
  findSegmentForWord,
  type SegmentOptions,
} from "./segments";

export interface WordGroupDisplay {
  words: SubtitleWord[];
  activeIndex: number;
}

/**
 * Returns the caption chunk to show at `currentTime` plus which word inside it
 * is currently active. Chunk boundaries come from the deterministic auto-split
 * (item 4) instead of mechanical fixed-size slicing, so pauses and long lines
 * break the caption where a viewer would expect.
 */
export function getWordGroupDisplay(
  subtitles: Subtitle[],
  currentTime: number,
  options?: Partial<SegmentOptions>,
): WordGroupDisplay | null {
  const allWords: SubtitleWord[] = [];
  for (const sub of subtitles) {
    if (sub.words) {
      allWords.push(...sub.words);
    }
  }
  if (allWords.length === 0) return null;

  let activeWordIdx = -1;
  for (let i = 0; i < allWords.length; i++) {
    if (currentTime >= allWords[i].start && currentTime < allWords[i].end) {
      activeWordIdx = i;
      break;
    }
  }
  if (activeWordIdx === -1) return null;

  const segments = buildSegments(allWords, options);
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
