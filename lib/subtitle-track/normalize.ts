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
 *     least `start + MIN_WORD_DURATION`.
 *
 * Gaps >= `pauseGap` are deliberately left open — that's the same threshold
 * `buildSegments` uses to split chunks, so the caption still hides during
 * real pauses and the chunking is unchanged by normalization.
 *
 * Mirrored in worker/subtitle_renderer.py (_normalize_word_intervals) so the
 * capture schedule covers the same extended intervals this component paints —
 * keep both in sync when changing.
 */
export function normalizeWords(
  words: SubtitleWord[],
  pauseGap: number,
): SubtitleWord[] {
  const sorted = [...words].sort((a, b) => a.start - b.start);
  return sorted.map((w, i) => {
    const next = sorted[i + 1];
    let end = Math.max(w.end, w.start);
    if (next && end > next.start) end = next.start;
    if (next && next.start - end < pauseGap) {
      end = next.start;
    } else {
      end = Math.max(end, w.start + MIN_WORD_DURATION);
      if (next) end = Math.min(end, next.start);
    }
    return end === w.end ? w : { ...w, end };
  });
}
