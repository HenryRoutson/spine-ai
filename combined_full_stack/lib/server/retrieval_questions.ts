// AI : LLM answers questions about Traditional RAG retrieval and quote decisions.

import { z } from "zod";
import { llmStructured } from "./llm";
import { UsageLedger } from "./usage";
import type { ChunkRetrievalRow } from "./rag";
import { DEFAULT_MODEL, type ModelId } from "./types";

const answerSchema = z.object({
  answer: z.string(),
});

export type RetrievalQuestionPayload = {
  stepLabel: string;
  question: string;
  query: string;
  chunks: ChunkRetrievalRow[];
  quoteContext?: string;
};

function formatChunksForPrompt(chunks: ChunkRetrievalRow[]): string {
  return chunks
    .map(
      (c, i) =>
        `${i + 1}. [${c.chunk_id}] retrieved=${c.retrieved} score=${c.score} rank=${c.rank ?? "—"}\n   explanation: ${c.explanation}\n   text: ${c.text.slice(0, 400)}${c.text.length > 400 ? "…" : ""}`,
    )
    .join("\n\n");
}

function buildRetrievalQuestionPrompt(payload: RetrievalQuestionPayload): string {
  const retrieved = payload.chunks.filter((c) => c.retrieved);
  const notRetrieved = payload.chunks.filter((c) => !c.retrieved);
  const quoteBlock = payload.quoteContext?.trim()
    ? `\nRelated quote / answer context from downstream steps:\n${payload.quoteContext.trim()}\n`
    : "";
  return `You explain Traditional RAG retrieval for a pipeline step.

Step: "${payload.stepLabel}"
Query: ${JSON.stringify(payload.query)}

Retrieved chunks (${retrieved.length}):
${retrieved.length ? formatChunksForPrompt(retrieved) : "(none)"}

Not retrieved (${notRetrieved.length}):
${notRetrieved.length ? formatChunksForPrompt(notRetrieved.slice(0, 12)) : "(none)"}
${quoteBlock}
User question:
${payload.question}

Answer clearly:
- Cite specific chunk ids, BM25 scores, and the stored explanation fields.
- When asked about quotes, connect retrieval choices to whether supporting passages were in the top-K set.
- If a chunk should have been retrieved but was not, explain missing query terms or low score vs cutoff.
- Keep the answer concise (2–6 sentences unless the question needs more detail).`;
}

export async function answerRetrievalQuestion(
  payload: RetrievalQuestionPayload,
  model: ModelId = DEFAULT_MODEL,
): Promise<{ answer: string; costCents: number }> {
  const ledger = new UsageLedger();
  const raw = await llmStructured(buildRetrievalQuestionPrompt(payload), answerSchema, {
    model,
    ledger,
  });
  return { answer: raw.answer.trim(), costCents: +ledger.totalCents().toFixed(4) };
}
