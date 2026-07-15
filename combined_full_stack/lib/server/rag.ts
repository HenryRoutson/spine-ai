// AI : traditional RAG — auto-chunk source text, BM25 rank, per-chunk retrieval explanations.

import type { chunk_id_string, ChunkRetrievalRow, query_string, RetrievalMissRow } from "@/lib/retrieval-types";

export type { chunk_id_string, ChunkRetrievalRow, query_string, RetrievalMissRow };

export type TextChunk = {
  chunk_id: chunk_id_string;
  text: string;
  start: number;
  end: number;
};

export type RetrievalConfig = {
  query: query_string;
  topK?: number;
  chunkSize?: number;
  chunkOverlap?: number;
};

export type RetrievalRunResult = {
  query: query_string;
  chunk_size: number;
  overlap: number;
  top_k: number;
  total_chunks: number;
  chunks: ChunkRetrievalRow[];
};

const DEFAULT_TOP_K = 5;

// AI : scale chunk size with document length — keeps ~150–250 token chunks for typical prose.
export function autoChunkSize(sourceChars: number): number {
  if (sourceChars <= 2_000) return 500;
  if (sourceChars <= 10_000) return 800;
  return 1_200;
}

export function autoChunkOverlap(chunkSize: number): number {
  return Math.min(200, Math.max(80, Math.round(chunkSize * 0.15)));
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function uniqueTerms(tokens: string[]): string[] {
  return [...new Set(tokens)];
}

function termFreq(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  return freq;
}

// AI : paragraph-aware chunking with character overlap for context continuity.
export function chunkDocument(
  text: string,
  chunkSize: number,
  overlap: number,
): TextChunk[] {
  if (!text.trim()) return [];
  const size = Math.max(200, chunkSize);
  const lap = Math.min(Math.max(0, overlap), Math.floor(size / 2));
  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + size);
    if (end < text.length) {
      const window = text.slice(start, end);
      const breakAt = Math.max(
        window.lastIndexOf("\n\n"),
        window.lastIndexOf("\n"),
        window.lastIndexOf(". "),
        window.lastIndexOf(" "),
      );
      if (breakAt > size * 0.4) end = start + breakAt + (window[breakAt] === "." ? 2 : 1);
    }
    const slice = text.slice(start, end).trim();
    if (slice) {
      chunks.push({
        chunk_id: `c${index + 1}`,
        text: slice,
        start,
        end,
      });
      index += 1;
    }
    if (end >= text.length) break;
    start = Math.max(start + 1, end - lap);
  }
  return chunks;
}

type Bm25Scored = TextChunk & { score: number; matchedTerms: string[]; missingTerms: string[] };

function bm25ScoreChunk(
  queryTerms: string[],
  chunkTokens: string[],
  docFreq: Map<string, number>,
  totalDocs: number,
  avgDl: number,
): { score: number; matchedTerms: string[]; missingTerms: string[] } {
  const k1 = 1.2;
  const b = 0.75;
  const tf = termFreq(chunkTokens);
  const dl = chunkTokens.length || 1;
  let score = 0;
  const matched: string[] = [];
  const missing: string[] = [];
  for (const term of queryTerms) {
    const f = tf.get(term) ?? 0;
    if (f > 0) matched.push(term);
    else missing.push(term);
    const df = docFreq.get(term) ?? 0;
    const idf = Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5));
    const num = f * (k1 + 1);
    const den = f + k1 * (1 - b + (b * dl) / avgDl);
    score += idf * (num / den);
  }
  return { score, matchedTerms: matched, missingTerms: missing };
}

function explainChunk(
  row: Bm25Scored,
  rank: number | null,
  topK: number,
  cutoffScore: number,
  retrieved: boolean,
): string {
  const matched = row.matchedTerms.length
    ? row.matchedTerms.join(", ")
    : "none";
  const missing = row.missingTerms.length
    ? row.missingTerms.join(", ")
    : "none";
  if (retrieved) {
    return `Retrieved at rank #${rank} (top ${topK}) with BM25 score ${row.score.toFixed(3)}. Query terms matched: ${matched}.`;
  }
  const rankNote = rank != null ? `Rank #${rank}` : "Unranked";
  const cutoffNote =
    cutoffScore > 0
      ? ` below top-${topK} cutoff score ${cutoffScore.toFixed(3)}`
      : ` outside top ${topK}`;
  return `Not retrieved — ${rankNote}${cutoffNote}. BM25 score ${row.score.toFixed(3)}. Missing query terms: ${missing}. Matched: ${matched}.`;
}

export function runTraditionalRetrieval(
  sourceText: string,
  config: RetrievalConfig,
): RetrievalRunResult {
  const query = config.query.trim();
  if (!query) throw new Error("retrieval query is required");
  const chunkSize = config.chunkSize ?? autoChunkSize(sourceText.length);
  const overlap = config.chunkOverlap ?? autoChunkOverlap(chunkSize);
  const topK = Math.max(1, config.topK ?? DEFAULT_TOP_K);
  const rawChunks = chunkDocument(sourceText, chunkSize, overlap);
  const queryTerms = uniqueTerms(tokenize(query));
  if (!queryTerms.length) throw new Error("retrieval query has no searchable terms");

  const chunkTokenLists = rawChunks.map((c) => tokenize(c.text));
  const totalDocs = Math.max(1, rawChunks.length);
  const avgDl =
    chunkTokenLists.reduce((sum, t) => sum + t.length, 0) / totalDocs || 1;
  const docFreq = new Map<string, number>();
  for (const tokens of chunkTokenLists) {
    for (const term of uniqueTerms(tokens)) {
      docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
    }
  }

  const scored: Bm25Scored[] = rawChunks.map((chunk, i) => {
    const { score, matchedTerms, missingTerms } = bm25ScoreChunk(
      queryTerms,
      chunkTokenLists[i]!,
      docFreq,
      totalDocs,
      avgDl,
    );
    return { ...chunk, score, matchedTerms, missingTerms };
  });

  const ranked = [...scored].sort((a, b) => b.score - a.score);
  const top = ranked.slice(0, topK);
  const cutoffScore = top.length ? top[top.length - 1]!.score : 0;
  const retrievedIds = new Set(top.map((c) => c.chunk_id));
  const rankById = new Map<chunk_id_string, number>();
  ranked.forEach((c, i) => rankById.set(c.chunk_id, i + 1));

  const chunks: ChunkRetrievalRow[] = scored.map((row) => {
    const retrieved = retrievedIds.has(row.chunk_id);
    const rank = rankById.get(row.chunk_id) ?? null;
    return {
      chunk_id: row.chunk_id,
      text: row.text,
      start: row.start,
      end: row.end,
      score: +row.score.toFixed(4),
      retrieved,
      rank,
      explanation: explainChunk(row, rank, topK, cutoffScore, retrieved),
    };
  });

  return {
    query,
    chunk_size: chunkSize,
    overlap,
    top_k: topK,
    total_chunks: chunks.length,
    chunks,
  };
}

// AI : pull dynamic query from upstream JSON via dot path (e.g. "question" or "rule.text").
export function resolveRetrievalQuery(
  upstream: unknown,
  staticQuery?: string,
  queryField?: string,
): query_string {
  const trimmed = staticQuery?.trim();
  if (trimmed) return trimmed;
  if (queryField?.trim() && upstream && typeof upstream === "object" && !Array.isArray(upstream)) {
    const parts = queryField.trim().split(".");
    let cur: unknown = upstream;
    for (const p of parts) {
      if (!cur || typeof cur !== "object" || Array.isArray(cur)) {
        cur = undefined;
        break;
      }
      cur = (cur as Record<string, unknown>)[p];
    }
    if (typeof cur === "string" && cur.trim()) return cur.trim();
    if (typeof cur === "number" || typeof cur === "boolean") return String(cur);
  }
  if (typeof upstream === "string" && upstream.trim()) return upstream.trim();
  throw new Error("retrieval step needs a query — set retrievalQuery, prompt, or retrievalQueryField");
}

// AI : testing helper — isolate chunks that should have been retrieved but were not.
export function isolateRetrievalMisses(
  expected: ChunkRetrievalRow[],
  actual: ChunkRetrievalRow[],
): RetrievalMissRow[] {
  const actualById = new Map(actual.map((c) => [c.chunk_id, c]));
  const misses: RetrievalMissRow[] = [];
  for (const exp of expected) {
    if (!exp.retrieved) continue;
    const act = actualById.get(exp.chunk_id);
    if (!act || act.retrieved) continue;
    misses.push({
      chunk_id: exp.chunk_id,
      explanation: act.explanation,
      expected: true,
      actual: false,
    });
  }
  return misses;
}
