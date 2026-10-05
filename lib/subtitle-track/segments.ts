import type { SubtitleWord } from "./types";
import { normalizeToken } from "./keywords";

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
 * Connector words (articles, prepositions, contractions, conjunctions) that
 * read wrong at the end of a chunk — "VOCÊ PRECISA DE" / "DINHEIRO". They
 * lead into the next word, so the split prefers to carry them forward.
 * Compared via normalizeToken (lowercase, no accents/punctuation).
 */
const CONNECTORS = new Set([
  // pt
  "a", "o", "as", "os", "um", "uma", "uns", "umas", "de", "do", "da", "dos",
  "das", "em", "no", "na", "nos", "nas", "num", "numa", "por", "pelo", "pela",
  "pelos", "pelas", "pra", "pro", "para", "com", "sem", "ao", "aos", "e", "ou",
  "mas", "que", "se", "nem", "como", "quando", "porque", "sobre", "entre",
  "ate", "seu", "sua", "meu", "minha",
  // en
  "the", "a", "an", "of", "to", "in", "on", "at", "for", "with", "and", "or",
  "but", "if", "from", "by", "as", "my", "your", "our", "their", "his", "her",
]);

/** Cost added when a chunk (other than the last before a pause) ends on a
 * connector. Larger than the balance cost of shifting one word between two
 * chunks, so it wins over balance but never over the chunk count. */
const CONNECTOR_END_PENALTY = 4;

/**
 * Splits one pause-free run of words into chunks. Among all splits that
 * respect the caps, picks the one with the FEWEST chunks, then the lowest
 * cost: Σ(chunk size²) — minimal when chunks are equal, so 4 words with a cap
 * of 3 become 2+2 instead of 3+1 (no orphan chunk) — plus a penalty for
 * chunks ending on a connector. Exact DP over chunk end positions; a run is
 * short and the inner loop is bounded by maxWords, so this is O(n·maxWords).
 * Returns the [first, last] word index (relative to the run) of each chunk.
 */
function splitRun(
  run: SubtitleWord[],
  maxWords: number,
  maxChars: number,
): Array<[number, number]> {
  const n = run.length;
  const lens = run.map((w) => w.word.length);
  const endsOnConnector = run.map((w) => CONNECTORS.has(normalizeToken(w.word)));

  // best[j] = optimal split of run[0..j-1]: [chunkCount, cost, prevBoundary]
  const best: Array<[number, number, number]> = [[0, 0, -1]];
  for (let j = 1; j <= n; j++) {
    let pick: [number, number, number] | null = null;
    let chars = 0;
    for (let i = j - 1; i >= 0 && j - i <= maxWords; i--) {
      chars += lens[i];
      const size = j - i;
      // A single over-long word still gets its own chunk rather than being dropped.
      if (size > 1 && chars > maxChars) break;
      const [count, cost] = best[i];
      const penalty = j < n && endsOnConnector[j - 1] ? CONNECTOR_END_PENALTY : 0;
      const cand: [number, number, number] = [count + 1, cost + size * size + penalty, i];
      if (!pick || cand[0] < pick[0] || (cand[0] === pick[0] && cand[1] < pick[1])) {
        pick = cand;
      }
    }
    // maxWords >= 1 always admits the single-word chunk, so pick is set.
    best.push(pick!);
  }

  const chunks: Array<[number, number]> = [];
  for (let j = n; j > 0; j = best[j][2]) chunks.push([best[j][2], j - 1]);
  return chunks.reverse();
}

/**
 * Deterministic auto-split: groups a flat word list into readable caption
 * chunks. A pause longer than `pauseGap` always starts a new chunk; each
 * pause-free run is then split into the fewest chunks that respect the word
 * and character caps, balanced so no chunk is left with a lone orphan word,
 * and avoiding chunks that end on a connector ("de", "e", "o"...). See
 * splitRun.
 */
export function buildSegments(
  words: SubtitleWord[],
  options?: Partial<SegmentOptions>,
): SubtitleSegment[] {
  const opts = { ...DEFAULT_SEGMENT_OPTIONS, ...options };
  const maxWords = Math.max(1, opts.maxWords);
  const segments: SubtitleSegment[] = [];

  let runStart = 0;
  for (let i = 1; i <= words.length; i++) {
    const pauseBreak =
      i === words.length || words[i].start - words[i - 1].end >= opts.pauseGap;
    if (!pauseBreak) continue;

    const run = words.slice(runStart, i);
    for (const [a, b] of splitRun(run, maxWords, opts.maxChars)) {
      const chunk = run.slice(a, b + 1);
      segments.push({
        words: chunk,
        start: chunk[0].start,
        end: chunk[chunk.length - 1].end,
        firstIndex: runStart + a,
        lastIndex: runStart + b,
      });
    }
    runStart = i;
  }

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
