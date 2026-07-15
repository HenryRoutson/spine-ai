// AI : client-safe helpers for Traditional RAG chunk rows in runs and tests.

import type { ChunkRetrievalRow, RetrievalMissRow } from "@/lib/retrieval-types"

export type { ChunkRetrievalRow, RetrievalMissRow }

export function parseRetrievalChunks(value: unknown): ChunkRetrievalRow[] {
  if (!Array.isArray(value)) return []
  const rows: ChunkRetrievalRow[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    if (typeof row.chunk_id !== "string" || typeof row.text !== "string") continue
    rows.push({
      chunk_id: row.chunk_id,
      text: row.text,
      start: typeof row.start === "number" ? row.start : 0,
      end: typeof row.end === "number" ? row.end : 0,
      score: typeof row.score === "number" ? row.score : 0,
      retrieved: row.retrieved === true,
      rank: typeof row.rank === "number" ? row.rank : null,
      explanation: typeof row.explanation === "string" ? row.explanation : "",
    })
  }
  return rows
}

export function retrievalMissesFromCompare(
  expected: unknown,
  actual: unknown,
): RetrievalMissRow[] {
  const exp = parseRetrievalChunks(expected)
  const act = parseRetrievalChunks(actual)
  const actualById = new Map(act.map((c) => [c.chunk_id, c]))
  const misses: RetrievalMissRow[] = []
  for (const e of exp) {
    if (!e.retrieved) continue
    const a = actualById.get(e.chunk_id)
    if (!a || a.retrieved) continue
    misses.push({
      chunk_id: e.chunk_id,
      explanation: a.explanation,
      expected: true,
      actual: false,
    })
  }
  return misses
}

export function retrievedChunks(chunks: ChunkRetrievalRow[]): ChunkRetrievalRow[] {
  return chunks.filter((c) => c.retrieved)
}

export function missedExpectedChunks(misses: RetrievalMissRow[]): RetrievalMissRow[] {
  return misses.filter((m) => m.expected && !m.actual)
}
