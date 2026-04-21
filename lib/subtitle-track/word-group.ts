import type { Subtitle, SubtitleWord } from "./types";

export interface WordGroupDisplay {
  words: SubtitleWord[];
  activeIndex: number;
}

export function getWordGroupDisplay(
  subtitles: Subtitle[],
  currentTime: number,
  wordsPerGroup: number,
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

  const groupIndex = Math.floor(activeWordIdx / wordsPerGroup);
  const groupStart = groupIndex * wordsPerGroup;
  const groupEnd = Math.min(groupStart + wordsPerGroup, allWords.length);
  return {
    words: allWords.slice(groupStart, groupEnd),
    activeIndex: activeWordIdx - groupStart,
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
