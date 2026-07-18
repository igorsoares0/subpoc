import type { SubtitleWord } from "./types";

/** Floor (seconds) for how long a word stays active — ~2 frames at 30fps.
 * Whisper occasionally emits near-zero-duration words, which would make the
 * highlight "teleport" through them. */
export const MIN_WORD_DURATION = 0.06;

/**
 * Sanitizes Whisper word timings for display. Whisper routinely leaves small
 * silent gaps between consecutive words (end of one ≠ start of the next); a
 * raw `start <= t < end` lookup then finds no active word inside those gaps
 * and the whole caption group flickers off for a few frames.
 *
 * Rules, applied per word against the next one (never moves `start`, so a
 * word can never light up before it is actually spoken):
 *  1. overlap  — `end` is clamped to the next word's `start`, so only one
 *     word can be active at a time;
 *  2. snap     — a gap smaller than `pauseGap` is absorbed by extending `end`
 *     to the next `start`: the group holds on screen and the highlight rests
 *     on the last spoken word, exactly through the moments a chunk is visible;
 *  3. min hold — otherwise (real pause, or last word) `end` is raised to at
 *     least `start + max(MIN_WORD_DURATION, minGroupHold)`, then clamped to the
 *     next `start` so it never overflows into the following word.
 *
 * The else-branch of rule 3 only ever fires on a chunk's *final* word — the one
 * before a pause >= `pauseGap`, or the very last word — because every other
 * word takes the snap branch. So `minGroupHold` gives each caption chunk a
 * readability tail into the trailing silence (fixing fast/blinking captions)
 * WITHOUT touching within-chunk timing or the split boundaries: it can only
 * lengthen a word that already ends a chunk, and never past the next word's
 * start, so `buildSegments` (which keys off the same `pauseGap`) is unchanged.
 * Pass `minGroupHold = 0` to get the raw MIN_WORD_DURATION floor — that variant
 * feeds segmentation, so the tail extension can't feed back and merge chunks.
 *
 * Mirrored in worker/subtitle_renderer.py (_normalize_word_intervals) so the
 * capture schedule covers the same extended intervals this component paints —
 * keep both in sync when changing.
 */
export function normalizeWords(
  words: SubtitleWord[],
  pauseGap: number,
  minGroupHold = 0,
): SubtitleWord[] {
  const hold = Math.max(MIN_WORD_DURATION, minGroupHold);
  const sorted = [...words].sort((a, b) => a.start - b.start);
  return sorted.map((w, i) => {
    const next = sorted[i + 1];
    let end = Math.max(w.end, w.start);
    if (next && end > next.start) end = next.start;
    if (next && next.start - end < pauseGap) {
      end = next.start;
    } else {
      end = Math.max(end, w.start + hold);
      if (next) end = Math.min(end, next.start);
    }
    return end === w.end ? w : { ...w, end };
  });
}
