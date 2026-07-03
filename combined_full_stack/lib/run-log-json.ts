// AI : full PipelineRun JSON for clipboard — includes llmCalls, failures, server logs, previews,
// AI : plus full text of every referenced document (fetched from /api/docs/:id/text) for offline debugging.
import { failuresFromLlmCalls } from "@/lib/llm-distribution"
import { docTextContent, fetchDocText } from "@/lib/doc-text-cache"
import type { DocId, DocRef, PipelineRun } from "@/lib/types"

type RunDocumentDump = {
  id: DocId
  name?: DocRef["name"]
  type?: DocRef["type"]
  content: string
}

function runDocIds(run: PipelineRun): DocId[] {
  const ids = [
    ...(run.inputDocIds ?? []),
    ...(run.inputDocId ? [run.inputDocId] : []),
    ...run.steps.flatMap((step) => (step.docId ? [step.docId] : [])),
  ]
  return [...new Set(ids)]
}

async function fetchDocDump(id: DocId, docs: DocRef[]): Promise<RunDocumentDump> {
  const meta = docs.find((d) => d.id === id)
  const content = await fetchDocText(id)
    .then(docTextContent)
    .catch(() => `⚠ failed to load content for ${id}`)
  return { id, name: meta?.name, type: meta?.type, content }
}

async function fetchRunDocuments(run: PipelineRun, docs: DocRef[]): Promise<RunDocumentDump[]> {
  return Promise.all(runDocIds(run).map((id) => fetchDocDump(id, docs)))
}

// AI : full *_testing.json content when the run was started from the Testing tab —
// AI : run.test only carries the verdict, the file has the pinned inputs + expected outputs.
async function fetchTestFile(run: PipelineRun, docs: DocRef[]): Promise<RunDocumentDump | undefined> {
  const name = run.test?.testDocName
  const meta = name ? docs.find((d) => d.name === name) : undefined
  return meta ? fetchDocDump(meta.id, docs) : undefined
}

export async function runLogJson(run: PipelineRun, docs: DocRef[]): Promise<string> {
  const enriched = {
    ...run,
    documents: await fetchRunDocuments(run, docs),
    testFile: await fetchTestFile(run, docs),
    steps: run.steps.map((step) => {
      const llmFailures = failuresFromLlmCalls(step.llmCalls, step.status !== "error")
      const descFailures = failuresFromLlmCalls(
        step.descriptionCheckLlmCalls,
        step.inputDescriptionCheck?.matches !== false,
      )
      const mergedFailures = [...(step.failures ?? []), ...llmFailures, ...descFailures]
      return {
        ...step,
        failures: mergedFailures.length ? mergedFailures : step.failures,
      }
    }),
  }
  return JSON.stringify(enriched, null, 2)
}
