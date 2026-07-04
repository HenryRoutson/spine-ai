"use client"

// AI : Testing tab — *_testing.json files pin exact per-step outputs; a run pinpoints the
// AI : first step that diverges. Static checks stay in Structure/Pipeline; this is for full runs.

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react"
import {
  Boxes,
  CheckSquare,
  CircleCheck,
  CircleX,
  GitBranch,
  ListChecks,
  Loader2,
  MinusCircle,
  Play,
  Plus,
  ScrollText,
  Sparkles,
  Square,
  TriangleAlert,
} from "lucide-react"
import { JsonHighlight } from "@/components/highlight"
import { TestResults } from "@/components/test-results"
import {
  draftFromTest,
  draftHasErrors,
  draftToContent,
  SectionLabel,
  TestFileEditor,
  type TestDraft,
} from "@/components/testing-editor"
import { GoToLoggingButton } from "@/components/inference/inference-run-chrome"
import { WindowHeader } from "@/components/window-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { apiJson, JSON_HEADERS } from "@/lib/api-client"
import { API_ROUTES } from "@/lib/api-routes"
import { evaluateTestReport } from "@/lib/testing-evaluate"
import { useAppShell } from "@/lib/app-shell"
import { computeWorkspaceValidity } from "@/lib/workspace-validity-ui"
import { docTextContent, fetchDocText, invalidateDocText } from "@/lib/doc-text-cache"
import { labelAsStateKey } from "@/lib/server/pipeline_state"
import { docsForProject } from "@/lib/project-docs"
import { awaitRun, cancelRun, isRunBillingError, mergeStepStates, startRunWithRetry, type StepUiState } from "@/lib/run-engine"
import { useStore } from "@/lib/store"
import { formatCostCents, formatSecondsShort } from "@/lib/format"
import { runBilledCents, runTotalMs } from "@/lib/run-metrics"
import { useStatusPalette } from "@/lib/chart-colors"
import { timeAgo } from "@/lib/time-ago"
import {
  isTestingFileName,
  latestTestVerdictForDoc,
  nextTestFileName,
  parseTestFile,
  resolveTestRunInputs,
  testFileSkeleton,
  testContentSig,
  testContentStableSig,
  testPipelineSig,
  testPipelineStableSig,
  testRunContextStableSig,
  testRunHistoryForDoc,
  testVerdictPassed,
  validateTestFile,
  type SpineTestFile,
  type TestFileIssue,
  type TestStepResult,
} from "@/lib/testing-files"
import { cn } from "@/lib/utils"
import { DocLabel, InputType, RunSource, type PipelineRun, type RunTestReport } from "@/lib/types"
import type { DocId, DocRef, ModuleId, PipelineModule, Project, RunJobId } from "@/lib/types"

type doc_name_string = string

type TestDocState = {
  doc: DocRef
  content?: string
  loadError?: string
  parseError?: string
  test?: SpineTestFile
  issues: TestFileIssue[]
}

type GeneratedTestFile = { name: string; content: string; issues: TestFileIssue[] }

type RunPhase = "idle" | "running" | "done"
type RunTestOutcome = "ok" | "error" | "billing" | "stopped"

type TestRunUiState = {
  phase: RunPhase
  stepStates: Map<ModuleId, StepUiState>
  results: TestStepResult[] | null
  resultRunId: string | null
  runError: string | null
  jobId: RunJobId | null
}

const EMPTY_TEST_RUN: TestRunUiState = {
  phase: "idle",
  stepStates: new Map(),
  results: null,
  resultRunId: null,
  runError: null,
  jobId: null,
}

function RunStopButton({
  onClick,
  className,
}: {
  onClick: (e: MouseEvent<HTMLButtonElement>) => void
  className?: string
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={cn("h-6 shrink-0 bg-transparent px-2", className)}
      onClick={onClick}
      title="Stop run"
    >
      <Square className="h-3 w-3 fill-current" />
    </Button>
  )
}

function testStatus(t: TestDocState): "loading" | "load_failed" | "broken" | "errors" | "warnings" | "ok" {
  if (t.loadError) return "load_failed"
  if (t.content === undefined) return "loading"
  if (t.parseError) return "broken"
  if (t.issues.some((i) => i.level === "error")) return "errors"
  if (t.issues.length) return "warnings"
  return "ok"
}

function isRunnableTest(t: TestDocState): boolean {
  if (!t.test || t.loadError || t.parseError || t.content === undefined) return false
  if (t.issues.some((i) => i.level === "error")) return false
  return true
}

const STATUS_BADGE: Record<ReturnType<typeof testStatus>, { label: string; className: string }> = {
  loading: { label: "loading", className: "border-border text-muted-foreground" },
  load_failed: { label: "load failed", className: "border-destructive/40 text-destructive" },
  broken: { label: "invalid json", className: "border-destructive/40 text-destructive" },
  errors: { label: "stale", className: "border-destructive/40 text-destructive" },
  warnings: { label: "incomplete", className: "border-yellow-500/40 text-yellow-500" },
  ok: { label: "valid", className: "border-chart-2/40 text-chart-2" },
}

function TestLastVerdictIcon({ passed }: { passed: boolean }) {
  return passed ? (
    <CircleCheck className="h-3.5 w-3.5 shrink-0 text-chart-2" aria-label="Passed last run" />
  ) : (
    <CircleX className="h-3.5 w-3.5 shrink-0 text-destructive" aria-label="Failed last run" />
  )
}

const VERDICT_BADGE = {
  passed: { label: "passed", className: "border-chart-2/40 text-chart-2" },
  failed: { label: "failed", className: "border-destructive/40 text-destructive" },
} as const

function sidebarTestBadge(
  status: ReturnType<typeof testStatus>,
  lastVerdict: boolean | null,
): { label: string; className: string } {
  if (lastVerdict !== null) return lastVerdict ? VERDICT_BADGE.passed : VERDICT_BADGE.failed
  return STATUS_BADGE[status]
}

export function Testing() {
  const {
    project,
    modules,
    models,
    typeAliases,
    docs,
    model,
    addDocContent,
    addRun,
    runs,
    updateRunTest,
    refreshBilling,
    flushPendingSave,
  } = useStore()

  const projectDocs = useMemo(() => docsForProject(docs, project), [docs, project])
  const testDocs = useMemo(() => projectDocs.filter((d) => isTestingFileName(d.name)), [projectDocs])
  const { setActiveWindow } = useAppShell()
  const { typesInvalid, runTabsBlocked: runBlocked } = computeWorkspaceValidity(
    modules,
    models,
    typeAliases,
  )

  const [contents, setContents] = useState<Record<DocId, string>>({})
  const [loadErrors, setLoadErrors] = useState<Record<DocId, string>>({})
  const loadingIds = useRef<Set<DocId>>(new Set())
  const [selectedId, setSelectedId] = useState<DocId | null>(null)
  const [selectedName, setSelectedName] = useState<doc_name_string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [creatingTest, setCreatingTest] = useState(false)

  // AI : per-test run state — stale batch runs many jobs in parallel, each with its own progress.
  const [runByName, setRunByName] = useState<Map<doc_name_string, TestRunUiState>>(new Map())
  const abortByName = useRef<Map<doc_name_string, AbortController>>(new Map())
  const [runAllActive, setRunAllActive] = useState(false)
  const [runAllDone, setRunAllDone] = useState(0)
  const [runAllTotal, setRunAllTotal] = useState(0)
  const [dirtyContentByName, setDirtyContentByName] = useState<Partial<Record<doc_name_string, string>>>({})

  // AI panel
  const [aiOpen, setAiOpen] = useState(false)
  const [aiInstruction, setAiInstruction] = useState("")
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiGenerated, setAiGenerated] = useState<GeneratedTestFile | null>(null)

  const loadTestDoc = useCallback((docId: DocId) => {
    if (loadingIds.current.has(docId)) return
    loadingIds.current.add(docId)
    invalidateDocText(docId)
    setLoadErrors((prev) => {
      const { [docId]: _gone, ...rest } = prev
      return rest
    })
    void fetchDocText(docId)
      .then((data) => setContents((prev) => ({ ...prev, [docId]: docTextContent(data) })))
      .catch((err) => setLoadErrors((prev) => ({ ...prev, [docId]: (err as Error).message })))
      .finally(() => loadingIds.current.delete(docId))
  }, [])

  useEffect(() => {
    for (const d of testDocs) {
      if (contents[d.id] !== undefined || loadErrors[d.id] || loadingIds.current.has(d.id)) continue
      loadTestDoc(d.id)
    }
  }, [testDocs, contents, loadErrors, loadTestDoc])

const LOAD_FAILED_PREFIX = "<<load failed:"
const LOAD_FAILED_SUFFIX = ">>"

function staleLoadFailedContent(content: string): string | null {
  const t = content.trim()
  if (!t.startsWith(LOAD_FAILED_PREFIX) || !t.endsWith(LOAD_FAILED_SUFFIX)) return null
  return t.slice(LOAD_FAILED_PREFIX.length, -LOAD_FAILED_SUFFIX.length).trim()
}

  const testStates: TestDocState[] = useMemo(
    () =>
      testDocs.map((doc) => {
        const loadError = loadErrors[doc.id]
        if (loadError) return { doc, loadError, issues: [] }
        const content = contents[doc.id]
        if (content === undefined) return { doc, issues: [] }
        const staleLoad = staleLoadFailedContent(content)
        if (staleLoad) return { doc, loadError: staleLoad, issues: [] }
        const parsed = parseTestFile(content)
        if (!parsed.ok) return { doc, content, parseError: parsed.error, issues: [] }
        return { doc, content, test: parsed.test, issues: validateTestFile(parsed.test, project, projectDocs) }
      }),
    [testDocs, contents, loadErrors, project, projectDocs],
  )

  const runnableTests = useMemo(() => testStates.filter(isRunnableTest), [testStates])
  const selected =
    testStates.find((t) => t.doc.id === selectedId) ??
    (selectedName ? testStates.find((t) => t.doc.name === selectedName) : undefined) ??
    testStates[0]
  const selectedRun = selected ? (runByName.get(selected.doc.name) ?? EMPTY_TEST_RUN) : EMPTY_TEST_RUN
  const anyTestRunning = useMemo(() => {
    for (const s of runByName.values()) {
      if (s.phase === "running") return true
    }
    return false
  }, [runByName])
  const runBusy = anyTestRunning || runAllActive

  const patchRunState = useCallback((docName: doc_name_string, patch: Partial<TestRunUiState>) => {
    setRunByName((prev) => {
      const next = new Map(prev)
      const cur = next.get(docName) ?? EMPTY_TEST_RUN
      next.set(docName, { ...cur, ...patch })
      return next
    })
  }, [])

  const pipelineSnapshot = useMemo(
    () => ({ modules, models, typeAliases }),
    [modules, models, typeAliases],
  )

  const pipelineSig = useMemo(
    () => testPipelineSig(project, model, pipelineSnapshot),
    [project, model, pipelineSnapshot],
  )

  const testSigSets = useMemo(() => {
    const m = new Map<
      doc_name_string,
      {
        testContentSig: string
        pipelineSig: string
        legacy: { contentStable: string; pipelineStable: string; combinedStable: string }
      }
    >()
    for (const t of testStates) {
      const content = dirtyContentByName[t.doc.name] ?? t.content ?? ""
      m.set(t.doc.name, {
        testContentSig: testContentSig(content),
        pipelineSig,
        legacy: {
          contentStable: testContentStableSig(content),
          pipelineStable: testPipelineStableSig(project, model, pipelineSnapshot),
          combinedStable: testRunContextStableSig(content, project, model, pipelineSnapshot),
        },
      })
    }
    return m
  }, [testStates, dirtyContentByName, project, model, pipelineSnapshot, pipelineSig])

  const resolveLastVerdict = useCallback(
    (docName: doc_name_string): boolean | null => {
      const sigs = testSigSets.get(docName)
      if (!sigs) return null
      // AI : verdict lives on persisted runs (Supabase) — match separate test + pipeline hashes.
      return latestTestVerdictForDoc(
        runs,
        docName,
        sigs.testContentSig,
        sigs.pipelineSig,
        sigs.legacy,
      )
    },
    [testSigSets, runs],
  )

  const staleTests = useMemo(
    () => runnableTests.filter((t) => resolveLastVerdict(t.doc.name) === null),
    [runnableTests, resolveLastVerdict],
  )

  // AI : hide stale run results when test/pipeline no longer matches the persisted verdict.
  useEffect(() => {
    if (!selected) return
    const rs = runByName.get(selected.doc.name)
    if (!rs?.results || rs.phase !== "done") return
    if (resolveLastVerdict(selected.doc.name) !== null) return
    patchRunState(selected.doc.name, { results: null, resultRunId: null, phase: "idle" })
  }, [selected, runByName, resolveLastVerdict, testSigSets, dirtyContentByName, patchRunState])

  const onDirtyContentChange = useCallback((docName: doc_name_string, content: string | null) => {
    setDirtyContentByName((prev) => {
      if (content === null) {
        const { [docName]: _gone, ...rest } = prev
        return rest
      }
      return { ...prev, [docName]: content }
    })
  }, [])

  const selectTest = useCallback((id: DocId, name?: doc_name_string) => {
    setSelectedId(id)
    if (name) setSelectedName(name)
    setActionError(null)
  }, [])

  const stopTest = useCallback((docName: doc_name_string) => {
    abortByName.current.get(docName)?.abort()
    setRunByName((prev) => {
      const jobId = prev.get(docName)?.jobId
      if (jobId) void cancelRun(jobId).catch(console.error)
      const next = new Map(prev)
      const cur = next.get(docName) ?? EMPTY_TEST_RUN
      next.set(docName, { ...cur, phase: "idle", runError: "Stopped" })
      return next
    })
  }, [])

  const stopAllRunningTests = useCallback(() => {
    setRunByName((prev) => {
      const next = new Map(prev)
      for (const [docName, rs] of prev) {
        if (rs.phase !== "running") continue
        abortByName.current.get(docName)?.abort()
        if (rs.jobId) void cancelRun(rs.jobId).catch(console.error)
        next.set(docName, { ...rs, phase: "idle", runError: "Stopped" })
      }
      return next
    })
    setRunAllActive(false)
    setRunAllDone(0)
    setRunAllTotal(0)
  }, [])

  async function createBlankTest() {
    setActionError(null)
    setCreatingTest(true)
    try {
      const doc = await addDocContent(
        nextTestFileName(projectDocs),
        InputType.Json,
        testFileSkeleton(project, projectDocs),
        DocLabel.Training,
        project.id,
      )
      invalidateDocText(doc.id)
      setContents(({ [doc.id]: _stale, ...rest }) => rest)
      selectTest(doc.id, doc.name)
    } catch (err) {
      setActionError((err as Error).message)
    } finally {
      setCreatingTest(false)
    }
  }

  // AI : content-hash ids change on edit — replace in one request, keyed by stable doc name.
  async function saveEdit(state: TestDocState, draft: string): Promise<DocId | null> {
    setActionError(null)
    const parsed = parseTestFile(draft)
    if (!parsed.ok) {
      setActionError(parsed.error)
      return null
    }
    try {
      const doc = await addDocContent(
        state.doc.name,
        InputType.Json,
        draft,
        DocLabel.Training,
        project.id,
        state.doc.id,
      )
      setDirtyContentByName((prev) => {
        const { [state.doc.name]: _gone, ...rest } = prev
        return rest
      })
      setContents((prev) => {
        const { [state.doc.id]: _old, ...rest } = prev
        return { ...rest, [doc.id]: draft }
      })
      selectTest(doc.id, state.doc.name)
      return doc.id
    } catch (err) {
      setActionError((err as Error).message)
      return null
    }
  }

  // AI : one-click Run — unsaved form edits are saved first, then the run targets the new doc id.
  async function saveAndRun(state: TestDocState, contentToSave: string | null) {
    let target = state
    if (contentToSave !== null) {
      const parsed = parseTestFile(contentToSave)
      if (!parsed.ok) {
        setActionError(parsed.error)
        return
      }
      const newId = await saveEdit(state, contentToSave)
      if (!newId) return
      target = { ...state, doc: { ...state.doc, id: newId }, content: contentToSave, test: parsed.test }
    }
    await runTest(target)
  }

  async function runTest(state: TestDocState): Promise<RunTestOutcome> {
    if (!state.test) return "error"
    const docName = state.doc.name
    const resolved = resolveTestRunInputs(state.test, modules, projectDocs)
    if (!resolved.ok) {
      patchRunState(docName, { runError: resolved.error, phase: "idle" })
      return "error"
    }
    const ac = new AbortController()
    abortByName.current.set(docName, ac)
    patchRunState(docName, {
      phase: "running",
      stepStates: new Map(),
      results: null,
      resultRunId: null,
      runError: null,
      jobId: null,
    })
    try {
      await flushPendingSave()
      const { jobId } = await startRunWithRetry(
        project.id,
        resolved.primary,
        model,
        resolved.rest,
        resolved.byModule,
        // AI : no run-dedupe — every test gets its own Logging entry tagged "test" with its
        // AI : verdict attached; per-step caching still makes identical reruns ~free.
        true,
        RunSource.Testing, // AI : flags the run in Logging (spec § Testing)
      )
      patchRunState(docName, { jobId })
      refreshBilling().catch(console.error)
      const { run } = await awaitRun(jobId, {
        signal: ac.signal,
        onStep: (steps) =>
          setRunByName((prev) => {
            const next = new Map(prev)
            const cur = next.get(docName) ?? EMPTY_TEST_RUN
            next.set(docName, { ...cur, stepStates: mergeStepStates(cur.stepStates, steps) })
            return next
          }),
        // AI : tests are unattended — auto-approve human-review gates.
        onHumanReview: () => Promise.resolve("approved" as const),
      })
      const report = await evaluateTestReport(run, state.test, project, model)
      refreshBilling().catch(console.error)
      const content = state.content ?? ""
      const persistedTest: RunTestReport = {
        testDocName: docName,
        results: report,
        testContentSig: testContentSig(content),
        pipelineSig,
      }
      // AI : upsert locally with verdict immediately so run history updates before PATCH returns.
      addRun({ ...run, source: run.source ?? RunSource.Testing, test: persistedTest })
      patchRunState(docName, { results: report, resultRunId: run.id, phase: "done" })
      // AI : pin verdict + content/pipeline hashes onto the run row (Supabase via PATCH /api/runs).
      updateRunTest(run.id, persistedTest).catch(console.error)
      return "ok"
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        patchRunState(docName, { phase: "idle", runError: "Stopped" })
        return "stopped"
      }
      if (isRunBillingError(err)) {
        refreshBilling().catch(console.error)
        patchRunState(docName, { runError: (err as Error).message, phase: "idle" })
        return "billing"
      }
      patchRunState(docName, { runError: (err as Error).message, phase: "idle" })
      return "error"
    } finally {
      abortByName.current.delete(docName)
    }
  }

  async function runAllStaleTests() {
    if (!staleTests.length) {
      setActionError("No stale tests — every runnable test already has a current pass/fail verdict.")
      return
    }
    setActionError(null)
    setRunAllActive(true)
    setRunAllTotal(staleTests.length)
    setRunAllDone(0)
    let billingHit = false
    try {
      await Promise.all(
        staleTests.map(async (t) => {
          const outcome = await runTest(t)
          setRunAllDone((d) => d + 1)
          if (outcome === "billing") billingHit = true
        }),
      )
    } finally {
      setRunAllActive(false)
      setRunAllDone(0)
      setRunAllTotal(0)
    }
    if (billingHit) setActionError("Some tests stopped — insufficient billing balance.")
  }

  async function generateWithAi() {
    if (!aiInstruction.trim()) return
    setAiBusy(true)
    setAiError(null)
    setAiGenerated(null)
    try {
      const generated = await apiJson<GeneratedTestFile>(API_ROUTES.testingAssistant, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ projectId: project.id, instruction: aiInstruction, model }),
      })
      setAiGenerated(generated)
    } catch (err) {
      setAiError((err as Error).message)
    } finally {
      setAiBusy(false)
    }
  }

  async function saveGenerated(generated: GeneratedTestFile) {
    setAiError(null)
    try {
      const existing = projectDocs.find((d) => d.name === generated.name)
      const doc = await addDocContent(
        generated.name,
        InputType.Json,
        generated.content,
        DocLabel.Training,
        project.id,
        existing?.id,
      )
      setContents((prev) => {
        if (!existing) return { ...prev, [doc.id]: generated.content }
        const { [existing.id]: _old, ...rest } = prev
        return { ...rest, [doc.id]: generated.content }
      })
      setAiGenerated(null)
      setAiInstruction("")
      setAiOpen(false)
      selectTest(doc.id, doc.name)
    } catch (err) {
      setAiError((err as Error).message)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        step="03 / Testing"
        title="Pipeline Tests"
        description={`Pin exact per-step outputs in *_testing.json files, then run to pinpoint where ${project.name} goes wrong.`}
        actions={
          <>
            {runAllActive ? (
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" className="h-8 bg-transparent" disabled>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Running stale ({runAllDone}/{runAllTotal})…
                </Button>
                <RunStopButton className="h-8" onClick={() => stopAllRunningTests()} />
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-8 bg-transparent"
                onClick={() => void runAllStaleTests()}
                disabled={runBlocked || runBusy || staleTests.length === 0}
                title={
                  staleTests.length === 0
                    ? "no stale tests — all runnable tests have a current verdict"
                    : runBlocked
                      ? typesInvalid
                        ? "fix type errors first"
                        : "fix pipeline errors first"
                      : undefined
                }
              >
                <ListChecks className="mr-1.5 h-3.5 w-3.5" />
                Run all stale
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-8 bg-transparent" onClick={() => setAiOpen((v) => !v)}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Generate with AI
            </Button>
            <Button size="sm" className="h-8" onClick={() => void createBlankTest()} disabled={creatingTest}>
              {creatingTest ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="mr-1.5 h-3.5 w-3.5" />
              )}
              New test file
            </Button>
          </>
        }
      />

      {runBlocked ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="max-w-md rounded-lg border border-destructive/50 bg-destructive/10 px-6 py-8">
            <TriangleAlert className="mx-auto h-10 w-10 text-destructive" />
            <p className="mt-4 text-sm font-medium text-destructive">
              {typesInvalid
                ? "Fix type errors in Structure before running tests."
                : "Fix pipeline errors before running tests."}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setActiveWindow(typesInvalid ? "structure" : "pipeline")}
            >
              {typesInvalid ? (
                <>
                  <Boxes className="h-3.5 w-3.5" />
                  Go to Structure
                </>
              ) : (
                <>
                  <GitBranch className="h-3.5 w-3.5" />
                  Go to Pipeline
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <>
      {actionError && (
        <p className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 font-mono text-[11px] text-destructive">
          {actionError}
        </p>
      )}

      {aiOpen && (
        <AiGeneratePanel
          instruction={aiInstruction}
          setInstruction={setAiInstruction}
          busy={aiBusy}
          error={aiError}
          generated={aiGenerated}
          onGenerate={() => void generateWithAi()}
          onSave={(g) => void saveGenerated(g)}
          onDiscard={() => setAiGenerated(null)}
        />
      )}

      <div className="flex min-h-0 flex-1">
        <div className="flex w-64 shrink-0 flex-col border-r border-border">
          <p className="border-b border-border px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">
            test files ({testDocs.length})
          </p>
          <ScrollArea className="min-h-0 flex-1">
            {testStates.length === 0 && (
              <p className="px-3 py-4 text-xs text-muted-foreground">
                No test files yet. Create one — files ending in <span className="font-mono">_testing.json</span> show
                up here and in Documents.
              </p>
            )}
            <ul className="p-1.5">
              {testStates.map((t) => {
                const status = testStatus(t)
                const isSelected = selected?.doc.id === t.doc.id
                const lastVerdict = resolveLastVerdict(t.doc.name)
                const testRun = runByName.get(t.doc.name) ?? EMPTY_TEST_RUN
                const isRunning = testRun.phase === "running"
                const badge = sidebarTestBadge(status, lastVerdict)
                return (
                  <li key={t.doc.id}>
                    <div
                      className={cn(
                        "flex items-center gap-1 rounded-md px-1 py-1",
                        isSelected && "bg-secondary",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => selectTest(t.doc.id, t.doc.name)}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-accent"
                      >
                        {isRunning ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                        ) : lastVerdict === null ? (
                          <CheckSquare className="h-4 w-4 shrink-0 text-primary" />
                        ) : (
                          <TestLastVerdictIcon passed={lastVerdict} />
                        )}
                        <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{t.doc.name}</span>
                        <Badge variant="outline" className={cn("shrink-0 font-mono text-[9px]", badge.className)}>
                          {badge.label}
                        </Badge>
                      </button>
                      {isRunning && (
                        <RunStopButton
                          onClick={(e) => {
                            e.stopPropagation()
                            stopTest(t.doc.name)
                          }}
                        />
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </ScrollArea>
        </div>

        {/* AI : min-w-0 — without it the flex child grows to fit nowrap truncate spans, pushing the Run button off-screen */}
        <ScrollArea className="min-h-0 min-w-0 flex-1">
          {selected ? (
            <TestDetail
              key={selected.doc.name} // AI : stable test filename — doc id changes on content-hash edits
              state={selected}
              project={project}
              projectDocs={projectDocs}
              onSaveEdit={(draft) => void saveEdit(selected, draft)}
              onRun={(contentToSave) => void saveAndRun(selected, contentToSave)}
              onStop={() => stopTest(selected.doc.name)}
              onRetryLoad={() => loadTestDoc(selected.doc.id)}
              onDirtyContentChange={onDirtyContentChange}
              lastVerdict={resolveLastVerdict(selected.doc.name)}
              runs={runs}
              runDisabled={runBlocked || runBusy}
              runPhase={selectedRun.phase}
              stepStates={selectedRun.stepStates}
              results={selectedRun.results}
              resultRunId={selectedRun.resultRunId}
              runError={selectedRun.runError}
              modules={modules}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center text-xs text-muted-foreground">
              Select or create a test file to describe the exact output of each pipeline step.
            </div>
          )}
        </ScrollArea>
      </div>
        </>
      )}
    </div>
  )
}

function AiGeneratePanel({
  instruction,
  setInstruction,
  busy,
  error,
  generated,
  onGenerate,
  onSave,
  onDiscard,
}: {
  instruction: string
  setInstruction: (v: string) => void
  busy: boolean
  error: string | null
  generated: GeneratedTestFile | null
  onGenerate: () => void
  onSave: (g: GeneratedTestFile) => void
  onDiscard: () => void
}) {
  return (
    <div className="border-b border-border bg-card/50 px-4 py-3">
      <div className="flex items-start gap-2">
        <Textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Describe the test — e.g. “happy-path test using the bundled sample document, cover every step”"
          className="min-h-[56px] flex-1 font-mono text-xs"
          disabled={busy}
        />
        <Button size="sm" className="h-8 shrink-0" onClick={onGenerate} disabled={busy || !instruction.trim()}>
          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
          {busy ? "Generating…" : "Generate"}
        </Button>
      </div>
      {error && <p className="mt-2 font-mono text-[11px] text-destructive">{error}</p>}
      {generated && (
        <div className="mt-3 rounded-md border border-border bg-background p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-mono text-[11px]">
              <CheckSquare className="h-3.5 w-3.5 text-primary" />
              {generated.name}
            </span>
            <span className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-7 bg-transparent" onClick={onDiscard}>
                Discard
              </Button>
              <Button size="sm" className="h-7" onClick={() => onSave(generated)}>
                Save test file
              </Button>
            </span>
          </div>
          <IssueList issues={generated.issues} className="mt-2" />
          <div className="mt-2 max-h-64 overflow-auto rounded border border-border bg-secondary/30 p-2">
            <JsonHighlight json={generated.content} />
          </div>
        </div>
      )}
    </div>
  )
}

function IssueList({ issues, className }: { issues: TestFileIssue[]; className?: string }) {
  if (!issues.length) return null
  return (
    <ul className={cn("space-y-1", className)}>
      {issues.map((issue, i) => (
        <li
          key={i}
          className={cn(
            "flex items-start gap-1.5 font-mono text-[11px]",
            issue.level === "error" ? "text-destructive" : "text-yellow-500",
          )}
        >
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="whitespace-pre-wrap">
            <span className="font-semibold">{issue.where}</span> — {issue.message}
          </span>
        </li>
      ))}
    </ul>
  )
}

function TestRunHistory({
  docName,
  runs,
  onOpenLog,
}: {
  docName: doc_name_string
  runs: PipelineRun[]
  onOpenLog: (runId: string) => void
}) {
  const palette = useStatusPalette()
  const history = useMemo(() => testRunHistoryForDoc(runs, docName), [runs, docName])

  return (
    <section>
      <SectionLabel>run history{history.length ? ` (${history.length})` : ""}</SectionLabel>
      {history.length === 0 ? (
        <p className="mt-1.5 rounded-md border border-dashed border-border px-2.5 py-2 font-mono text-[11px] text-muted-foreground">
          no logs
        </p>
      ) : (
      <ul className="mt-1.5 space-y-1">
        {history.map((run) => {
          const passed = run.test ? testVerdictPassed(run.test.results) : run.status === "ok"
          const verdictColor = passed ? palette.ok : palette.err
          return (
            <li key={run.id}>
              <button
                type="button"
                onClick={() => onOpenLog(run.id)}
                className="flex w-full items-center gap-2 rounded-md border border-border px-2.5 py-2 text-left transition-colors hover:bg-accent"
              >
                {passed ? (
                  <CircleCheck className="h-3.5 w-3.5 shrink-0" style={{ color: verdictColor }} />
                ) : (
                  <CircleX className="h-3.5 w-3.5 shrink-0" style={{ color: verdictColor }} />
                )}
                <span className="min-w-0 flex-1 truncate font-mono text-[11px]">
                  {new Date(run.startedAt).toLocaleString()} · {timeAgo(run.startedAt)}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {formatSecondsShort(runTotalMs(run))} · {formatCostCents(runBilledCents(run))}
                </span>
                <Badge
                  variant="outline"
                  className="shrink-0 font-mono text-[9px]"
                  style={{ color: verdictColor, borderColor: `${verdictColor}66` }}
                >
                  {passed ? "passed" : "failed"}
                </Badge>
                <ScrollText className="h-3 w-3 shrink-0 text-primary" />
              </button>
            </li>
          )
        })}
      </ul>
      )}
    </section>
  )
}

function TestDetail({
  state,
  project,
  projectDocs,
  onSaveEdit,
  onRun,
  onStop,
  onRetryLoad,
  onDirtyContentChange,
  lastVerdict,
  runs,
  runDisabled,
  runPhase,
  stepStates,
  results,
  resultRunId,
  runError,
  modules,
}: {
  state: TestDocState
  project: Project
  projectDocs: DocRef[]
  onSaveEdit: (draft: string) => void
  onRun: (contentToSave: string | null) => void
  onStop: () => void
  onRetryLoad: () => void
  onDirtyContentChange: (docName: doc_name_string, content: string | null) => void
  lastVerdict: boolean | null
  runs: PipelineRun[]
  runDisabled: boolean
  runPhase: RunPhase
  stepStates: Map<ModuleId, StepUiState>
  results: TestStepResult[] | null
  resultRunId: string | null
  runError: string | null
  modules: PipelineModule[]
}) {
  const { openLogging } = useAppShell()
  // AI : the form edits a TestDraft in place — Run auto-saves unsaved edits first, so the
  // AI : primary button is always available. Broken (unparseable) files fall back to a fix-it textarea.
  const [draft, setDraft] = useState<TestDraft | null>(null)
  const [initialSig, setInitialSig] = useState<string | null>(null)
  const [fixDraft, setFixDraft] = useState<string | null>(null)

  // AI : resync form when the underlying file changes (load, save, or content-hash id swap).
  useEffect(() => {
    setDraft(null)
    setInitialSig(null)
    setFixDraft(null)
  }, [state.doc.id])

  useEffect(() => {
    if (state.content === undefined || state.parseError || !state.test) return
    const d = draftFromTest(state.test, project)
    setDraft(d)
    setInitialSig(JSON.stringify(d))
  }, [state.doc.id, state.content, state.parseError])

  const dirty = draft !== null && JSON.stringify(draft) !== initialSig
  const serialized = draft ? draftToContent(draft, project) : null
  const draftBlocked = draft === null || serialized === null || draftHasErrors(draft, project)

  useEffect(() => {
    if (state.parseError) {
      const baseline = state.content ?? ""
      const raw = fixDraft ?? baseline
      const fixDirty = fixDraft !== null && fixDraft !== baseline
      onDirtyContentChange(state.doc.name, fixDirty ? raw : null)
      return
    }
    onDirtyContentChange(state.doc.name, dirty && serialized ? serialized : null)
  }, [state.parseError, state.content, fixDraft, dirty, serialized, state.doc.name, onDirtyContentChange])

  const runTitle =
    serialized === null
      ? "fix invalid JSON values first"
      : draft && draftHasErrors(draft, project)
        ? "fix the errors marked in red first"
        : undefined

  // AI : step key → actual output from the last run so the form can capture it
  const actuals = useMemo(() => {
    const m = new Map<string, unknown>()
    for (const r of results ?? []) if (r.actual !== undefined) m.set(labelAsStateKey(r.label), r.actual)
    return m
  }, [results])

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            {lastVerdict === null ? (
              <CheckSquare className="h-4 w-4 text-primary" />
            ) : (
              <TestLastVerdictIcon passed={lastVerdict} />
            )}
            <span className="truncate font-mono">{state.doc.name}</span>
            {lastVerdict !== null && (
              <span
                className={cn(
                  "shrink-0 font-mono text-[10px] font-normal",
                  lastVerdict ? "text-chart-2" : "text-destructive",
                )}
              >
                {lastVerdict ? "passed last run" : "failed last run"}
              </span>
            )}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {dirty && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-8 bg-transparent"
                onClick={() => initialSig && setDraft(JSON.parse(initialSig) as TestDraft)}
              >
                Discard
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 bg-transparent"
                disabled={serialized === null}
                title={serialized === null ? "fix invalid JSON values first" : undefined}
                onClick={() => serialized && onSaveEdit(serialized)}
              >
                Save
              </Button>
            </>
          )}
          {!state.parseError && !state.loadError && (
            runPhase === "running" ? (
              <div className="flex items-center gap-1">
                <Button size="sm" className="h-8" disabled>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Running…
                </Button>
                <RunStopButton className="h-8" onClick={onStop} />
              </div>
            ) : (
              <Button
                size="sm"
                className="h-8"
                onClick={() => onRun(dirty ? serialized : null)}
                disabled={runDisabled || draftBlocked}
                title={runTitle}
              >
                <Play className="mr-1.5 h-3.5 w-3.5" />
                {dirty ? "Save & run" : "Run test"}
              </Button>
            )
          )}
        </div>
      </div>

      {!state.loadError && !state.parseError && (
        <TestRunHistory docName={state.doc.name} runs={runs} onOpenLog={openLogging} />
      )}

      {state.loadError ? (
        <div className="space-y-2 rounded border border-destructive/30 bg-destructive/10 p-3">
          <p className="font-mono text-[11px] text-destructive">
            Could not load this test file from the server:
            <span className="mt-1 block whitespace-pre-wrap text-destructive/90">{state.loadError}</span>
          </p>
          <Button size="sm" variant="outline" className="h-8 bg-transparent" onClick={onRetryLoad}>
            Retry load
          </Button>
        </div>
      ) : state.parseError ? (
        // AI : recovery path only — a hand-broken file can't render as a form, so let the user fix the text.
        <div className="space-y-2">
          <p className="rounded border border-destructive/30 bg-destructive/10 p-2 font-mono text-[11px] text-destructive">
            {state.parseError} — fix the file below and save.
          </p>
          <Textarea
            value={fixDraft ?? state.content ?? ""}
            onChange={(e) => setFixDraft(e.target.value)}
            className="min-h-[360px] font-mono text-[11px]"
            spellCheck={false}
          />
          <Button size="sm" className="h-8" disabled={fixDraft === null} onClick={() => fixDraft && onSaveEdit(fixDraft)}>
            Save fixed file
          </Button>
        </div>
      ) : (
        <>
          {state.content === undefined && (
            <p className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> loading…
            </p>
          )}

          {draft && (
            <TestFileEditor
              draft={draft}
              setDraft={setDraft}
              project={project}
              projectDocs={projectDocs}
              actuals={actuals}
            />
          )}

          {runPhase === "running" && (
            <section>
              <div className="flex items-center gap-2">
                <SectionLabel>run progress</SectionLabel>
                <RunStopButton onClick={onStop} />
              </div>
              <ul className="mt-1.5 space-y-1">
                {modules.map((m) => {
                  const s = stepStates.get(m.id)?.status ?? "idle"
                  return (
                    <li key={m.id} className="flex items-center gap-2 font-mono text-[11px]">
                      {s === "running" ? (
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      ) : s === "ok" || s === "cached" ? (
                        <CircleCheck className="h-3 w-3 text-chart-2" />
                      ) : s === "error" ? (
                        <CircleX className="h-3 w-3 text-destructive" />
                      ) : (
                        <MinusCircle className="h-3 w-3 text-muted-foreground/50" />
                      )}
                      <span className={cn(s === "idle" && "text-muted-foreground")}>{m.label}</span>
                      {s === "cached" && <span className="text-muted-foreground">(cached)</span>}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {runError && (
            <p className="rounded border border-destructive/30 bg-destructive/10 p-2 font-mono text-[11px] text-destructive">
              {runError}
            </p>
          )}

          {results && (
            <TestResults
              results={results}
              action={
                resultRunId ? (
                  // AI : testing output lands in Logging tagged "test" — link straight to it.
                  <button
                    type="button"
                    onClick={() => openLogging(resultRunId)}
                    className="flex items-center gap-1 font-mono text-[10px] text-primary hover:underline"
                  >
                    <ScrollText className="h-3 w-3" /> view in logging
                  </button>
                ) : undefined
              }
            />
          )}

          {runPhase === "done" && resultRunId && (
            // AI : same call-to-action as the Inference tab once a run lands
            <GoToLoggingButton onClick={() => openLogging(resultRunId)} />
          )}
        </>
      )}
    </div>
  )
}

