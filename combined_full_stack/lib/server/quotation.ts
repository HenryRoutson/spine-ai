import type { DocId, SourceQuote, StructureModel } from "./types";

type Normalized = string;

// AI : collapse whitespace + ASCII-fold case so spacing/case-only differences still match
// AI : exactly. ASCII-only folding keeps string length stable (unicode lowercasing can change
// AI : it), so normalized offsets keep mapping 1:1 back onto the source.
function norm(s: string): Normalized {
  return s.replace(/\s+/g, " ").trim().replace(/[A-Z]/g, (c) => c.toLowerCase());
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

// AI : bug fix — scoring was normalized by the WINDOW's token count, so truncated windows at
// AI : the document tail scored a spurious 1.0 and beat better full-length matches. Score is
// AI : now the fraction of the QUOTE's tokens covered; punctuation is stripped ("(72)" ≈ "72").
function tokens(s: Normalized): string[] {
  return s.split(" ").map((t) => t.replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean);
}

function tokenOverlap(quote: Normalized, window: Normalized): number {
  const qt = tokens(quote);
  const wt = new Set(tokens(window));
  if (qt.length === 0) return 0;
  return qt.filter((t) => wt.has(t)).length / qt.length;
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

// AI : convert one record's top-level quote fields from LLM strings → {text, quote:{doc_id,start,end}}.
export function resolveQuotesInRecord(
  value: unknown,
  model: StructureModel,
  sourceText: string,
  docId: DocId,
): unknown {
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = { ...obj };
  for (const f of model.fields) {
    if (f.type === "tuple[text,quote]" && typeof obj[f.name] === "string") {
      const m = findQuote(obj[f.name] as string, sourceText, docId);
      out[f.name] = { text: m.text, quote: { doc_id: m.docId, start: m.start, end: m.end } };
    }
    if (f.type === "list[tuple[text,quote]]" && Array.isArray(obj[f.name])) {
      out[f.name] = (obj[f.name] as string[]).map((q) => {
        const m = findQuote(q, sourceText, docId);
        return { text: m.text, quote: { doc_id: m.docId, start: m.start, end: m.end } };
      });
    }
  }
  return out;
}

// AI : resolve quote fields on a step output — handles list vs single-object out.
export function resolveQuotesValue(
  value: unknown,
  model: StructureModel,
  sourceText: string,
  docId: DocId,
  isList: boolean,
): unknown {
  if (isList && Array.isArray(value)) {
    return value.map((row) => resolveQuotesInRecord(row, model, sourceText, docId));
  }
  return resolveQuotesInRecord(value, model, sourceText, docId);
}

// AI : canonical export link for a saved quote — the doc CONTENT HASH + index range survive
// AI : export and resolve without any run context: load docs/<hash>.txt and slice [start, end).
export function quoteHref(q: Pick<SourceQuote, "docId" | "start" | "end">): string {
  return `doc://${q.docId}#${q.start}-${q.end}`;
}

export function parseQuoteHref(href: string): Pick<SourceQuote, "docId" | "start" | "end"> | undefined {
  const m = href.match(/^doc:\/\/([^#]+)#(\d+)-(\d+)$/);
  return m ? { docId: m[1] as DocId, start: +m[2], end: +m[3] } : undefined;
}

// AI : a quote as serialized in exported artifacts (snake_case doc_id, plus its href).
export interface ExportedQuote {
  text: string;
  doc_id: DocId;
  start: number;
  end: number;
  href: string;
}

// AI : walk any exported artifact value and collect every resolved {text, quote:{…}} span.
export function collectQuotes(value: unknown, out: ExportedQuote[] = []): ExportedQuote[] {
  if (Array.isArray(value)) {
    for (const v of value) collectQuotes(v, out);
    return out;
  }
  if (!value || typeof value !== "object") return out;
  const o = value as { text?: unknown; quote?: { doc_id?: unknown; start?: unknown; end?: unknown } };
  if (typeof o.text === "string" && typeof o.quote?.doc_id === "string" && typeof o.quote.start === "number" && typeof o.quote.end === "number") {
    const { doc_id, start, end } = o.quote as { doc_id: DocId; start: number; end: number };
    out.push({ text: o.text, doc_id, start, end, href: quoteHref({ docId: doc_id, start, end }) });
    return out;
  }
  for (const v of Object.values(o)) collectQuotes(v, out);
  return out;
}
