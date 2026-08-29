import type { DocId, SourceQuote, StructureModel } from "./types";
import {
  collectQuotesForModel,
  resolveQuotesForModel,
  type LinkedQuoteValue,
  isLinkedQuoteValue,
  quoteDisplayText,
} from "./quote_schema";

export { isLinkedQuoteValue, quoteDisplayText };

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

export type quote_source = { docId: DocId; text: string }

export function findQuoteInSources(quote: string, sources: quote_source[]): QuoteMatch {
  let best: QuoteMatch | null = null
  for (const s of sources) {
    if (!s.text) continue
    const m = findQuote(quote, s.text, s.docId)
    if (m.exact) return m
    if (!best || m.score > best.score) best = m
  }
  return (
    best ?? {
      text: quote,
      docId: (sources[0]?.docId ?? ("none" as DocId)),
      start: 0,
      end: 0,
      exact: false,
      score: 0,
    }
  )
}

export function quoteSourcesFromRun(ctx: {
  store: { docs(): { id: DocId }[]; docContent(id: DocId): string | undefined }
  inputByModule: Map<string, DocId[]>
  sourceText: string
  sourceDocId: DocId
}): quote_source[] {
  const seen = new Set<string>()
  const out: quote_source[] = []
  const add = (id: DocId, text?: string) => {
    if (seen.has(id)) return
    const content = text ?? ctx.store.docContent(id)
    if (typeof content !== "string" || !content) return
    seen.add(id)
    out.push({ docId: id, text: content })
  }
  for (const ids of ctx.inputByModule.values()) {
    for (const id of ids) add(id)
  }
  if (ctx.sourceText) add(ctx.sourceDocId, ctx.sourceText)
  return out
}

// AI : convert quote fields declared on this model (incl. nested refs) from LLM strings → linked spans.
export function resolveQuotesInRecord(
  value: unknown,
  model: StructureModel,
  models: StructureModel[],
  sourceText: string,
  docId: DocId,
): unknown {
  const link = (verbatim: string): LinkedQuoteValue => {
    const m = findQuote(verbatim, sourceText, docId);
    return { text: m.text, quote: { doc_id: m.docId, start: m.start, end: m.end } };
  };
  return resolveQuotesForModel(value, model, models, link, false);
}

// AI : resolve quote fields on a step output — handles list vs single-object out.
export function resolveQuotesValue(
  value: unknown,
  model: StructureModel,
  models: StructureModel[],
  sourceText: string,
  docId: DocId,
  isList: boolean,
): unknown {
  return resolveQuotesValueFromSources(value, model, models, [{ docId, text: sourceText }], isList)
}

export function resolveQuotesValueFromSources(
  value: unknown,
  model: StructureModel,
  models: StructureModel[],
  sources: quote_source[],
  isList: boolean,
): unknown {
  const link = (verbatim: string): LinkedQuoteValue => {
    const m = findQuoteInSources(verbatim, sources)
    return { text: m.text, quote: { doc_id: m.docId, start: m.start, end: m.end } }
  }
  return resolveQuotesForModel(value, model, models, link, isList)
}

type quote_href_span =
  | Pick<SourceQuote, "docId" | "start" | "end">
  | Pick<LinkedQuoteValue["quote"], "doc_id" | "start" | "end">;

// AI : canonical export link for a saved quote — the doc CONTENT HASH + index range survive
// AI : export and resolve without any run context: load docs/<hash>.txt and slice [start, end).
export function quoteHref(q: quote_href_span): string {
  const docId = "docId" in q ? q.docId : q.doc_id;
  return `doc://${docId}#${q.start}-${q.end}`;
}

// AI : flatten { text, quote } → ExportedQuote without restating doc_id / start / end.
export function exportedQuoteFromLinked(value: LinkedQuoteValue): ExportedQuote {
  const { quote, ...rest } = structuredClone(value);
  return { ...rest, ...quote, href: quoteHref(quote) };
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
// AI : when model is known, follow the structure graph; otherwise fall back to shape detection.
export function collectQuotes(
  value: unknown,
  out: ExportedQuote[] = [],
  model?: StructureModel,
  models: StructureModel[] = [],
  isList = false,
): ExportedQuote[] {
  if (model && models.length) {
    for (const q of collectQuotesForModel(value, model, models, isList)) {
      out.push(exportedQuoteFromLinked(q));
    }
    return out;
  }

  if (Array.isArray(value)) {
    for (const v of value) collectQuotes(v, out);
    return out;
  }
  if (isLinkedQuoteValue(value)) {
    out.push(exportedQuoteFromLinked(value));
    return out;
  }
  if (!value || typeof value !== "object") return out;
  for (const v of Object.values(value)) collectQuotes(v, out);
  return out;
}
