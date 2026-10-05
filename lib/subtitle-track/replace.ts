import type { Subtitle, SubtitleWord } from "./types";

/**
 * Transcript-wide find & replace. Matches whole words/phrases,
 * case-insensitively ("super title" → "Supertitle" fixes every occurrence of
 * a name Whisper got wrong).
 *
 * Both representations are updated: `text` (sentence mode, SRT/VTT export)
 * and `words` (word-group mode). Only the matched words are re-timed — the
 * replacement tokens share the matched span proportionally to their length —
 * so the rest of the line keeps its sync. (Editing the whole line instead
 * would redistribute timing across the entire cue when the word count
 * changes.)
 */

// Built with the RegExp constructor: Unicode property escapes in a regex
// literal need an ES2018 target, and tsconfig targets ES2017.
const NOT_WORD_CHAR = new RegExp("[^\\p{L}\\p{N}]", "gu");
const LEADING_PUNCT = new RegExp("^[^\\p{L}\\p{N}]*", "u");
const TRAILING_PUNCT = new RegExp("[^\\p{L}\\p{N}]*$", "u");

/** Lowercased, punctuation-free form of a token, for word-level matching. */
function bare(token: string): string {
  return token.toLocaleLowerCase().replace(NOT_WORD_CHAR, "");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tokenize(s: string): string[] {
  return s.trim().split(/\s+/).filter(Boolean);
}

/** Whole-phrase, case-insensitive matcher; any run of whitespace between the
 * phrase's words matches. Null for an empty query. */
function phraseRegex(find: string): RegExp | null {
  const tokens = tokenize(find);
  if (tokens.length === 0) return null;
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${tokens.map(escapeRegExp).join("\\s+")}(?![\\p{L}\\p{N}])`,
    "giu",
  );
}

/** Number of matches of `find` across every line's text. */
export function countMatches(subtitles: Subtitle[], find: string): number {
  const re = phraseRegex(find);
  if (!re) return 0;
  return subtitles.reduce((n, sub) => n + (sub.text.match(re)?.length ?? 0), 0);
}

function replaceInWords(
  words: SubtitleWord[],
  findTokens: string[],
  replTokens: string[],
): SubtitleWord[] {
  const k = findTokens.length;
  const out: SubtitleWord[] = [];
  let i = 0;

  while (i < words.length) {
    const isMatch =
      i + k <= words.length &&
      findTokens.every((t, j) => bare(words[i + j].word) === t);
    if (!isMatch) {
      out.push(words[i]);
      i++;
      continue;
    }

    const first = words[i];
    const last = words[i + k - 1];
    // Keep punctuation glued to the matched span ("(super" / "title,").
    const lead = first.word.match(LEADING_PUNCT)?.[0] ?? "";
    const trail = last.word.match(TRAILING_PUNCT)?.[0] ?? "";

    if (k === 1 && replTokens.length === 1) {
      // One-for-one: keep the word's timing and emphasis untouched.
      out.push({ ...first, word: lead + replTokens[0] + trail });
    } else {
      const totalChars = replTokens.reduce((n, t) => n + t.length, 0) || 1;
      const span = last.end - first.start;
      let cursor = first.start;
      replTokens.forEach((t, j) => {
        const isLastToken = j === replTokens.length - 1;
        const start = cursor;
        const end = isLastToken ? last.end : cursor + (span * t.length) / totalChars;
        cursor = end;
        out.push({
          word: (j === 0 ? lead : "") + t + (isLastToken ? trail : ""),
          start,
          end,
        });
      });
    }
    i += k;
  }

  return out;
}

/**
 * Replaces every whole-phrase, case-insensitive match of `find` with
 * `replace` (which may be empty, to delete it). Returns the updated list and
 * how many matches were replaced; lines without a match are returned as-is.
 */
export function replaceInSubtitles(
  subtitles: Subtitle[],
  find: string,
  replace: string,
): { subtitles: Subtitle[]; count: number } {
  const re = phraseRegex(find);
  if (!re) return { subtitles, count: 0 };

  const findTokens = tokenize(find).map(bare);
  // A query made only of punctuation can't be matched against Whisper words.
  const wordLevel = findTokens.every(Boolean);
  const replTokens = tokenize(replace);

  let count = 0;
  const updated = subtitles.map((sub) => {
    const hits = sub.text.match(re)?.length ?? 0;
    if (hits === 0) return sub;
    count += hits;

    const text = sub.text
      .replace(re, () => replace.trim())
      .replace(/\s{2,}/g, " ")
      .trim();
    const words =
      wordLevel && sub.words && sub.words.length > 0
        ? replaceInWords(sub.words, findTokens, replTokens)
        : sub.words;
    return { ...sub, text, words };
  });

  return { subtitles: updated, count };
}
