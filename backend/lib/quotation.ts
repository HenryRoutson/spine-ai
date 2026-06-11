import type { DocId, SourceQuote } from "./types.js";

type Normalized = string;

// AI : collapse whitespace so quotes that differ only in spacing still match the source.
function norm(s: string): Normalized {
  return s.replace(/\s+/g, " ").trim();
}

export interface QuoteMatch extends SourceQuote {
  exact: boolean; // false when we fell back to the closest fuzzy match
  score: number; // 0-1 token-overlap confidence
}

// AI : map an offset in the normalized string back to an offset in the original source.
function denormOffset(source: string, normIndex: number): number {
  let seen = 0;
  let i = 0;
  let prevSpace = false;
  for (; i < source.length; i++) {
    const isSpace = /\s/.test(source[i]);
    if (isSpace) {
      if (prevSpace) continue; // collapsed run — does not advance normalized index
      prevSpace = true;
    } else {
      prevSpace = false;
    }
    // leading whitespace in source maps to nothing in normalized
    if (seen === normIndex && !(isSpace && seen === 0)) return i;
    if (!(isSpace && seen === 0)) seen++;
    if (seen > normIndex) return i;
  }
  return i;
}

function tokenOverlap(a: Normalized, b: Normalized): number {
  const at = new Set(a.toLowerCase().split(" "));
  const bt = b.toLowerCase().split(" ");
  if (bt.length === 0) return 0;
  const hit = bt.filter((t) => at.has(t)).length;
  return hit / bt.length;
}

// AI : langextract-style quotation — validate an extracted quote against the source.
// AI : exact substring wins; otherwise slide a window of the quote's length to find the closest match.
export function findQuote(quote: string, source: string, docId: DocId): QuoteMatch {
  const nQuote = norm(quote);
  const nSource = norm(source);

  const exactIdx = nSource.indexOf(nQuote);
  if (exactIdx !== -1) {
    const start = denormOffset(source, exactIdx);
    const end = denormOffset(source, exactIdx + nQuote.length);
    return { text: source.slice(start, end), docId, start, end, exact: true, score: 1 };
  }

  // AI : fuzzy fallback — scan windows of the source for the best token overlap with the quote.
  const words = nSource.split(" ");
  const span = Math.max(1, nQuote.split(" ").length);
  let best = { score: -1, normStart: 0, normLen: nQuote.length };
  let cursor = 0;
  for (let i = 0; i < words.length; i++) {
    const window = words.slice(i, i + span).join(" ");
    const score = tokenOverlap(nQuote, window);
    if (score > best.score) best = { score, normStart: cursor, normLen: window.length };
    cursor += words[i].length + 1; // +1 for the joining space
  }
  const start = denormOffset(source, best.normStart);
  const end = denormOffset(source, best.normStart + best.normLen);
  return { text: source.slice(start, end), docId, start, end, exact: false, score: Math.max(0, best.score) };
}
