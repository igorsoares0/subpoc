import type { Subtitle, SubtitleWord } from "./types";

/**
 * Deterministic keyword detection (item 2).
 *
 * Annotates each word with `emphasis` so it renders in the keyword color.
 * This is the no-LLM first pass: a content word is emphasized when it is not a
 * stopword and is "heavy" enough (long enough, or contains a digit). Adjacent
 * emphasis is suppressed so highlights stay visually spaced — the Submagic look
 * is a few standout words per line, not a wall of color.
 *
 * The flag is stored on the word, so a later LLM pass (or manual per-word
 * toggling) can simply overwrite it without any other plumbing changing.
 */

// Portuguese + English function words. Lowercased, accent-insensitive compare.
const STOPWORDS = new Set([
  // pt
  "a", "o", "as", "os", "um", "uma", "uns", "umas", "de", "do", "da", "dos",
  "das", "em", "no", "na", "nos", "nas", "por", "pra", "para", "com", "sem",
  "que", "se", "e", "ou", "mas", "como", "quando", "porque", "entao", "ja",
  "nao", "sim", "eu", "voce", "ele", "ela", "nos", "eles", "elas", "meu",
  "minha", "seu", "sua", "isso", "isto", "aquilo", "este", "esta", "esse",
  "essa", "ao", "aos", "à", "às", "lhe", "me", "te", "foi", "ser", "estar",
  "tem", "ter", "vai", "vou", "ta", "to", "la", "ali", "aqui", "muito", "mais",
  // en
  "the", "a", "an", "of", "to", "in", "on", "at", "for", "with", "and", "or",
  "but", "so", "if", "is", "are", "was", "were", "be", "been", "it", "its",
  "this", "that", "these", "those", "i", "you", "he", "she", "we", "they",
  "my", "your", "his", "her", "our", "their", "me", "him", "them", "do",
  "does", "did", "will", "would", "can", "could", "just", "not", "no", "yes",
  "as", "by", "from", "up", "out", "about", "into", "over", "than", "too",
]);

function normalize(word: string): string {
  return word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents (combining marks)
    .replace(/[^a-z0-9]/g, ""); // strip punctuation
}

function isKeyword(word: string): boolean {
  const n = normalize(word);
  if (n.length === 0) return false;
  if (STOPWORDS.has(n)) return false;
  if (/\d/.test(n)) return true; // numbers are almost always meaningful
  return n.length >= 5;
}

export interface KeywordOptions {
  /** Don't emphasize two consecutive words (keeps highlights spaced). */
  suppressAdjacent?: boolean;
}

/** Returns a new word array with `emphasis` set by the heuristic. */
export function annotateKeywords(
  words: SubtitleWord[],
  options?: KeywordOptions,
): SubtitleWord[] {
  const suppressAdjacent = options?.suppressAdjacent ?? true;
  let prevEmphasized = false;

  return words.map((w) => {
    let emphasis = isKeyword(w.word);
    if (emphasis && suppressAdjacent && prevEmphasized) emphasis = false;
    prevEmphasized = emphasis;
    return { ...w, emphasis };
  });
}

/** Runs {@link annotateKeywords} across every subtitle's word list. */
export function annotateSubtitleKeywords(
  subtitles: Subtitle[],
  options?: KeywordOptions,
): Subtitle[] {
  return subtitles.map((sub) =>
    sub.words && sub.words.length > 0
      ? { ...sub, words: annotateKeywords(sub.words, options) }
      : sub,
  );
}

/** Clears the `emphasis` flag from every word. */
export function clearSubtitleKeywords(subtitles: Subtitle[]): Subtitle[] {
  return subtitles.map((sub) =>
    sub.words && sub.words.length > 0
      ? {
          ...sub,
          words: sub.words.map((w) => {
            const rest = { ...w };
            delete rest.emphasis;
            return rest;
          }),
        }
      : sub,
  );
}
