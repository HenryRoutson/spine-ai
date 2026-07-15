import { BUILTIN_RETRIEVED_CHUNK_ID } from "../../builtin_models";
import { resolveRetrievalQuery, runTraditionalRetrieval } from "../../rag";
import { ModuleKind, type PipelineModule } from "../../types";
import { modelById, sourceDocumentBlock } from "../helpers";
import { requireLinearInput } from "../context";
import { jsonStringifyStepValue } from "../results";
import type { ExecResult, RunCtx, RunLogger } from "../engine_types";

export async function execRetrievalStep(
  m: PipelineModule,
  ctx: RunCtx,
  log: RunLogger,
): Promise<ExecResult> {
  const { project } = ctx;
  const out = modelById(project.models, m.outStructureId);
  if (!out) throw new Error(`retrieval step ${m.id} has no output structure`);
  if (!ctx.sourceText) {
    throw new Error(`retrieval step ${m.id} needs source text from an upstream input step`);
  }
  const upstream = requireLinearInput(m, ctx);
  const query = resolveRetrievalQuery(
    upstream,
    m.retrievalQuery ?? m.prompt,
    m.retrievalQueryField,
  );
  log.info(`retrieval step`, {
    moduleId: m.id,
    sourceDocId: ctx.sourceDocId,
    sourceChars: ctx.sourceText.length,
    queryChars: query.length,
    topK: m.retrievalTopK ?? 5,
  });
  const result = runTraditionalRetrieval(ctx.sourceText, {
    query,
    topK: m.retrievalTopK,
    chunkSize: m.retrievalChunkSize,
    chunkOverlap: m.retrievalChunkOverlap,
  });
  const rows = result.chunks.map((c) => ({
    chunk_id: c.chunk_id,
    text: c.text,
    start: c.start,
    end: c.end,
    score: c.score,
    retrieved: c.retrieved,
    rank: c.rank,
    explanation: c.explanation,
  }));
  const retrievedCount = rows.filter((r) => r.retrieved).length;
  const inputPreview = [
    sourceDocumentBlock(ctx.sourceText, ctx.sourceDocId),
    "",
    "── RETRIEVAL QUERY ──",
    query,
    "",
    `── CHUNKS (${result.total_chunks} total, top ${result.top_k} retrieved: ${retrievedCount}) ──`,
    ...result.chunks.map(
      (c) =>
        `[${c.chunk_id}] ${c.retrieved ? "✓" : "·"} score=${c.score} rank=${c.rank ?? "—"}\n${c.explanation}\n${c.text.slice(0, 240)}${c.text.length > 240 ? "…" : ""}`,
    ),
  ].join("\n");
  return {
    value: rows,
    preview: `retrieved ${retrievedCount}/${result.total_chunks} chunks for "${query.slice(0, 48)}${query.length > 48 ? "…" : ""}"`,
    json: jsonStringifyStepValue(rows),
    inputPreview,
    docId: ctx.sourceDocId,
  };
}

export function isRetrievalOutputStructure(structureId: string | undefined): boolean {
  return structureId === BUILTIN_RETRIEVED_CHUNK_ID || structureId === "m_builtin_retrieved_chunk";
}

export function defaultRetrievalModulePatch(): Partial<PipelineModule> {
  return {
    kind: ModuleKind.Retrieval,
    outStructureId: BUILTIN_RETRIEVED_CHUNK_ID,
    outIsList: true,
    retrievalTopK: 5,
    prompt: "",
    retrievalQuery: "",
  };
}
