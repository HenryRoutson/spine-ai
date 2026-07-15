"use client"

// AI : dedicated Traditional RAG inspector — chunk explanations, questions, and testing miss isolation.

import { useCallback, useMemo, useState } from "react"
import { CircleHelp, Loader2, Search } from "lucide-react"
import { WindowHeader } from "@/components/window-header"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { apiJson, JSON_HEADERS } from "@/lib/api-client"
import { API_ROUTES } from "@/lib/api-routes"
import { labelAsStateKey } from "@/lib/server/pipeline_state"
import { useStore } from "@/lib/store"
import { ModuleKind, type PipelineModule, type PipelineRun } from "@/lib/types"
import { parseRetrievalChunks, retrievedChunks } from "@/lib/retrieval-utils"
import { tryParseJson } from "@/lib/json-utils"
import { cn } from "@/lib/utils"

const DEFAULT_QUESTIONS = [
  "Why were these chunks retrieved and others were not?",
  "Why did the pipeline retrieve quotes from these passages (or skip quotes entirely)?",
  "Which chunk should have been retrieved for this query but was not?",
]

function retrievalSteps(modules: PipelineModule[]): PipelineModule[] {
  return modules.filter((m) => m.kind === ModuleKind.Retrieval)
}

function latestRunWithStep(runs: PipelineRun[], stepLabel: string): PipelineRun | null {
  const key = labelAsStateKey(stepLabel)
  for (const run of runs) {
    const step = run.steps.find((s) => labelAsStateKey(s.label) === key)
    if (step?.outputJson) return run
  }
  return null
}

function queryFromStepPreview(inputPreview: string | undefined): string {
  if (!inputPreview) return ""
  const marker = "── RETRIEVAL QUERY ──"
  const idx = inputPreview.indexOf(marker)
  if (idx < 0) return ""
  const rest = inputPreview.slice(idx + marker.length).trim()
  const end = rest.indexOf("\n\n──")
  return (end >= 0 ? rest.slice(0, end) : rest.split("\n")[0] ?? "").trim()
}

function quoteContextFromRun(run: PipelineRun | null, afterLabel: string): string {
  if (!run) return ""
  const key = labelAsStateKey(afterLabel)
  let seen = false
  const parts: string[] = []
  for (const step of run.steps) {
    if (labelAsStateKey(step.label) === key) seen = true
    if (!seen) continue
    if (step.kind === ModuleKind.Quote || step.kind === ModuleKind.Llm) {
      if (step.outputJson) parts.push(`${step.label}:\n${step.outputJson.slice(0, 4000)}`)
    }
  }
  return parts.join("\n\n")
}

export function RetrievalPage() {
  const { modules, runs, project, model } = useStore()
  const steps = useMemo(() => retrievalSteps(modules), [modules])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = steps.find((s) => s.id === selectedId) ?? steps[0] ?? null
  const run = useMemo(
    () => (selected ? latestRunWithStep(runs, selected.label) : null),
    [runs, selected],
  )
  const step = useMemo(() => {
    if (!selected || !run) return null
    const key = labelAsStateKey(selected.label)
    return run.steps.find((s) => labelAsStateKey(s.label) === key) ?? null
  }, [run, selected])

  const chunks = useMemo(() => {
    if (!step?.outputJson) return []
    const parsed = tryParseJson(step.outputJson)
    return parsed.ok ? parseRetrievalChunks(parsed.value) : []
  }, [step])

  const query = useMemo(
    () =>
      selected?.retrievalQuery?.trim() ||
      selected?.prompt?.trim() ||
      queryFromStepPreview(step?.inputPreview) ||
      "",
    [selected, step],
  )

  const testMisses = useMemo(() => {
    if (!run?.test || !selected) return []
    const row = run.test.results.find((r) => r.label === selected.label)
    return row?.retrievalMissExplanations ?? []
  }, [run, selected])

  const [debugMissesOnly, setDebugMissesOnly] = useState(false)
  const [question, setQuestion] = useState(DEFAULT_QUESTIONS[0]!)
  const [answer, setAnswer] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [askError, setAskError] = useState<string | null>(null)

  const visibleChunks = useMemo(() => {
    if (debugMissesOnly && testMisses.length) {
      const ids = new Set(testMisses.map((m) => m.chunk_id))
      return chunks.filter((c) => ids.has(c.chunk_id))
    }
    return chunks
  }, [chunks, debugMissesOnly, testMisses])

  const ask = useCallback(async () => {
    if (!selected || !project || !question.trim() || !chunks.length) return
    setAsking(true)
    setAskError(null)
    setAnswer(null)
    try {
      const res = await apiJson<{ answer: string }>(API_ROUTES.retrievalQuestions, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          projectId: project.id,
          stepLabel: selected.label,
          question: question.trim(),
          query,
          chunks,
          quoteContext: quoteContextFromRun(run, selected.label),
          model,
        }),
      })
      setAnswer(res.answer)
    } catch (err) {
      setAskError((err as Error).message)
    } finally {
      setAsking(false)
    }
  }, [selected, project, question, query, chunks, run, model])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <WindowHeader
        step="02b"
        title="Retrieval"
        description="Traditional RAG — chunk explanations, why-questions, and testing miss isolation"
      />
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        {steps.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground">
            Add a <span className="text-foreground">Traditional RAG</span> step in Pipeline to inspect BM25 retrieval here.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] uppercase text-muted-foreground">Step</span>
              {steps.map((s) => (
                <Button
                  key={s.id}
                  type="button"
                  size="sm"
                  variant={selected?.id === s.id ? "default" : "outline"}
                  className="h-7 font-mono text-[11px]"
                  onClick={() => setSelectedId(s.id)}
                >
                  {s.label}
                </Button>
              ))}
            </div>

            {!run || !step ? (
              <p className="font-mono text-xs text-muted-foreground">
                Run Inference or Testing once to populate chunk rows for this step.
              </p>
            ) : (
              <>
                <div className="rounded-md border border-border bg-secondary/20 px-3 py-2">
                  <p className="font-mono text-[10px] uppercase text-muted-foreground">Query</p>
                  <p className="mt-1 font-mono text-xs">{query || "—"}</p>
                  <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                    {retrievedChunks(chunks).length}/{chunks.length} chunks retrieved · run {run.id.slice(0, 8)}
                  </p>
                </div>

                {testMisses.length > 0 && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-[10px] uppercase text-destructive">
                        Testing — expected chunks missed ({testMisses.length})
                      </p>
                      <label className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                        <Switch checked={debugMissesOnly} onCheckedChange={setDebugMissesOnly} />
                        Isolate misses only
                      </label>
                    </div>
                    <ul className="mt-2 space-y-2">
                      {testMisses.map((m) => (
                        <li key={m.chunk_id} className="rounded border border-destructive/30 bg-background/60 p-2">
                          <p className="font-mono text-[11px] font-medium text-destructive">{m.chunk_id}</p>
                          <p className="mt-1 font-mono text-[10px] leading-relaxed text-muted-foreground">
                            {m.explanation}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <ScrollArea className="min-h-0 flex-1 rounded-md border border-border">
                  <ul className="divide-y divide-border">
                    {visibleChunks.map((c) => (
                      <li key={c.chunk_id} className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11px] font-medium">{c.chunk_id}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-mono text-[9px]",
                              c.retrieved ? "border-chart-2/40 text-chart-2" : "text-muted-foreground",
                            )}
                          >
                            {c.retrieved ? "retrieved" : "not retrieved"}
                          </Badge>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            score {c.score} · rank {c.rank ?? "—"}
                          </span>
                        </div>
                        <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
                          {c.explanation}
                        </p>
                        <p className="mt-1.5 line-clamp-3 font-mono text-[10px] text-foreground/80">{c.text}</p>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>

                <section className="rounded-md border border-border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <CircleHelp className="h-3.5 w-3.5 text-primary" />
                    <p className="font-mono text-[10px] uppercase text-muted-foreground">Ask why</p>
                  </div>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {DEFAULT_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setQuestion(q)}
                        className="rounded border border-border px-2 py-1 font-mono text-[9px] text-muted-foreground hover:border-primary hover:text-foreground"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                  <Textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    className="min-h-[64px] font-mono text-xs"
                    placeholder="Why did this step retrieve / skip quotes for this query?"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <Button type="button" size="sm" disabled={asking || !chunks.length} onClick={() => void ask()}>
                      {asking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                      Ask
                    </Button>
                    {askError && (
                      <span className="font-mono text-[10px] text-destructive">{askError}</span>
                    )}
                  </div>
                  {answer && (
                    <p className="mt-3 rounded border border-chart-2/30 bg-chart-2/5 p-2 font-mono text-[11px] leading-relaxed">
                      {answer}
                    </p>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
