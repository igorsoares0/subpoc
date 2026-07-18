import type { SubtitleWord } from "./types";

/**
 * A caption chunk shown on screen at once in word-group mode.
 *
 * Segments are computed on the fly from the flat word list (no stored data,
 * no migration) so changing the split options re-chunks instantly, and the
 * exact same boundaries are produced in the editor preview and in the worker
 * render (which screenshots this same component).
 */
export interface SubtitleSegment {
  words: SubtitleWord[];
  start: number;
  end: number;
  /** Index of the first/last word within the flat word list this segment covers. */
  firstIndex: number;
  lastIndex: number;
}

export interface SegmentOptions {
  /** Hard cap on words per chunk. */
  maxWords: number;
  /** Soft cap on characters per chunk (word letters, excluding joining spaces). */
  maxChars: number;
  /** A silent gap >= this many seconds between two words forces a new chunk. */
  pauseGap: number;
  /**
   * Minimum time (seconds) a chunk's final word is held on screen before a
   * trailing pause, so short/fast phrases don't blink past faster than they can
   * be read. Applied in normalizeWords (display pass only) and clamped to the
   * next word's start, so it adds a readability tail into silence without
   * overlapping the next chunk or changing where chunks split. Conservative by
   * default — bump it for slower captions, set 0 to disable.
   *
   * Mirror: _DEFAULT_MIN_GROUP_HOLD in worker/subtitle_renderer.py.
   */
  minGroupHold: number;
}

export const DEFAULT_SEGMENT_OPTIONS: SegmentOptions = {
  maxWords: 4,
  maxChars: 24,
  pauseGap: 0.35,
  minGroupHold: 0.7,
};

/**
 * Deterministic auto-split: groups a flat word list into readable caption
 * chunks. A new chunk starts when adding the next word would exceed the word
 * cap, exceed the character cap, or when a pause longer than `pauseGap`
 * separates it from the previous word. A single over-long word still gets
 * placed (in its own chunk) rather than being dropped.
 */
export function buildSegments(
  words: SubtitleWord[],
  options?: Partial<SegmentOptions>,
): SubtitleSegment[] {
  const opts = { ...DEFAULT_SEGMENT_OPTIONS, ...options };
  const segments: SubtitleSegment[] = [];

  let current: SubtitleWord[] = [];
  let charCount = 0;
  let firstIndex = 0;

  const flush = (lastIndex: number) => {
    if (current.length === 0) return;
    segments.push({
      words: current,
      start: current[0].start,
      end: current[current.length - 1].end,
      firstIndex,
      lastIndex,
    });
    current = [];
    charCount = 0;
  };

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const wordLen = w.word.length;

    if (current.length > 0) {
      const prevEnd = current[current.length - 1].end;
      const exceedsWords = current.length + 1 > opts.maxWords;
      const exceedsChars = charCount + wordLen > opts.maxChars;
      const pauseBreak = w.start - prevEnd >= opts.pauseGap;

      if (exceedsWords || exceedsChars || pauseBreak) {
        flush(i - 1);
      }
    }

    if (current.length === 0) firstIndex = i;
    current.push(w);
    charCount += wordLen;
  }
  flush(words.length - 1);

  return segments;
}

/** Find the segment that contains the given flat-word index, or null. */
export function findSegmentForWord(
  segments: SubtitleSegment[],
  wordIndex: number,
): SubtitleSegment | null {
  for (const seg of segments) {
    if (wordIndex >= seg.firstIndex && wordIndex <= seg.lastIndex) return seg;
  }
  return null;
}
