"use client"

// AI : Testing tab — *_testing.json files pin exact per-step outputs; a run pinpoints the
// AI : first step that diverges. Static checks stay in Structure/Pipeline; this is for full runs.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  CheckSquare,
  CircleCheck,
  CircleX,
  ListChecks,
  Loader2,
  MinusCircle,
  Play,
  Plus,
  ScrollText,
  Sparkles,
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
import { computeInvalidForUi } from "@/lib/pipeline-validity-ui"
import { docTextContent, fetchDocText, invalidateDocText } from "@/lib/doc-text-cache"
import { labelAsStateKey } from "@/lib/server/pipeline_state"
import { docsForProject } from "@/lib/project-docs"
import { awaitRun, isRunBillingError, mergeStepStates, startRun, type StepUiState } from "@/lib/run-engine"
import { useStore } from "@/lib/store"
import {
  isTestingFileName,
  latestTestVerdictForDoc,
  nextTestFileName,
  parseTestFile,
  resolveTestRunInputs,
  testFileSkeleton,
  testContentSig,
  testPipelineSig,
  testRunContextSig,
  validateTestFile,
  type SpineTestFile,
  type TestFileIssue,
  type TestStepResult,
} from "@/lib/testing-files"
import { cn } from "@/lib/utils"
import { DocLabel, InputType, RunSource, type RunTestReport } from "@/lib/types"
import type { DocId, DocRef, ModuleId, PipelineModule, Project } from "@/lib/types"

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
type RunTestOutcome = "ok" | "error" | "billing"

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
  const pipelineInvalid = computeInvalidForUi(modules, models, typeAliases).size > 0

  const [contents, setContents] = useState<Record<DocId, string>>({})
  const [loadErrors, setLoadErrors] = useState<Record<DocId, string>>({})
  const loadingIds = useRef<Set<DocId>>(new Set())
  const [selectedId, setSelectedId] = useState<DocId | null>(null)
  const [selectedName, setSelectedName] = useState<doc_name_string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [creatingTest, setCreatingTest] = useState(false)

  // run state (one test at a time)
  const [runPhase, setRunPhase] = useState<RunPhase>("idle")
  const [runningTestId, setRunningTestId] = useState<DocId | null>(null)
  const [stepStates, setStepStates] = useState<Map<ModuleId, StepUiState>>(new Map())
  const [results, setResults] = useState<TestStepResult[] | null>(null)
  const [resultRunId, setResultRunId] = useState<string | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [runAllActive, setRunAllActive] = useState(false)
  const [runAllIndex, setRunAllIndex] = useState(0)
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
  const runBusy = runPhase === "running" || runAllActive

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
      { testContentSig: string; pipelineSig: string; legacyCombined: string }
    >()
    for (const t of testStates) {
      const content = dirtyContentByName[t.doc.name] ?? t.content ?? ""
      m.set(t.doc.name, {
        testContentSig: testContentSig(content),
        pipelineSig,
        legacyCombined: testRunContextSig(content, project, model, pipelineSnapshot),
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
        sigs.legacyCombined,
      )
    },
    [testSigSets, runs],
  )

  // AI : hide stale run results when test/pipeline no longer matches the persisted verdict.
  useEffect(() => {
    if (!selected || !results || runningTestId !== selected.doc.id) return
    if (resolveLastVerdict(selected.doc.name) !== null) return
    setResults(null)
    setResultRunId(null)
    setRunPhase("idle")
  }, [selected, results, runningTestId, resolveLastVerdict, testSigSets, dirtyContentByName])

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
    setResults(null)
    setResultRunId(null)
    setRunError(null)
    setActionError(null)
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
    const resolved = resolveTestRunInputs(state.test, modules, projectDocs)
    if (!resolved.ok) {
      setRunError(resolved.error)
      return "error"
    }
    setRunPhase("running")
    setRunningTestId(state.doc.id)
    setStepStates(new Map())
    setResults(null)
    setResultRunId(null)
    setRunError(null)
    try {
      await flushPendingSave()
      const { jobId } = await startRun(
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
      refreshBilling().catch(console.error)
      const { run } = await awaitRun(jobId, {
        onStep: (steps) => setStepStates((prev) => mergeStepStates(prev, steps)),
        // AI : tests are unattended — auto-approve human-review gates.
        onHumanReview: () => Promise.resolve("approved" as const),
      })
      if (!runs.some((r) => r.id === run.id)) addRun(run)
      const report = await evaluateTestReport(run, state.test, project, model)
      refreshBilling().catch(console.error)
      const content = state.content ?? ""
      const persistedTest: RunTestReport = {
        testDocName: state.doc.name,
        results: report,
        testContentSig: testContentSig(content),
        pipelineSig,
      }
      setResults(report)
      setResultRunId(run.id)
      setRunPhase("done")
      // AI : pin verdict + content/pipeline hashes onto the run row (Supabase via PATCH /api/runs).
      updateRunTest(run.id, persistedTest).catch(console.error)
      return "ok"
    } catch (err) {
      if (isRunBillingError(err)) {
        refreshBilling().catch(console.error)
        setRunError((err as Error).message)
        setRunPhase("idle")
        return "billing"
      }
      setRunError((err as Error).message)
      setRunPhase("idle")
      return "error"
    }
  }

  async function runAllTests() {
    if (!runnableTests.length) {
      setActionError("No runnable test files — wait for loads to finish or fix parse errors first.")
      return
    }
    setActionError(null)
    setRunAllActive(true)
    setRunAllTotal(runnableTests.length)
    try {
      for (let i = 0; i < runnableTests.length; i++) {
        setRunAllIndex(i + 1)
        selectTest(runnableTests[i].doc.id, runnableTests[i].doc.name)
        const outcome = await runTest(runnableTests[i])
        if (outcome === "billing") break
      }
    } finally {
      setRunAllActive(false)
      setRunAllIndex(0)
      setRunAllTotal(0)
    }
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
            <Button
              size="sm"
              variant="outline"
              className="h-8 bg-transparent"
              onClick={() => void runAllTests()}
              disabled={pipelineInvalid || runBusy || runnableTests.length === 0}
              title={
                runnableTests.length === 0
                  ? "no runnable test files yet"
                  : pipelineInvalid
                    ? "fix pipeline errors first"
                    : undefined
              }
            >
              {runAllActive ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <ListChecks className="mr-1.5 h-3.5 w-3.5" />
              )}
              {runAllActive ? `Running all (${runAllIndex}/${runAllTotal})…` : "Run all tests"}
            </Button>
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

      {pipelineInvalid && (
        <p className="flex items-center gap-1.5 border-b border-destructive/30 bg-destructive/10 px-4 py-2 font-mono text-[11px] text-destructive">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
          The pipeline has validation errors — fix them in the Pipeline tab before running tests.
        </p>
      )}
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
                const badge = sidebarTestBadge(status, lastVerdict)
                return (
                  <li key={t.doc.id}>
                    <button
                      type="button"
                      onClick={() => selectTest(t.doc.id, t.doc.name)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-accent",
                        isSelected && "bg-secondary",
                      )}
                    >
                      {lastVerdict === null ? (
                        <CheckSquare className="h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <TestLastVerdictIcon passed={lastVerdict} />
                      )}
                      <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{t.doc.name}</span>
                      <Badge variant="outline" className={cn("shrink-0 font-mono text-[9px]", badge.className)}>
                        {badge.label}
                      </Badge>
                    </button>
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
              onRetryLoad={() => loadTestDoc(selected.doc.id)}
              onDirtyContentChange={onDirtyContentChange}
              lastVerdict={resolveLastVerdict(selected.doc.name)}
              runDisabled={pipelineInvalid || runBusy}
              runPhase={runningTestId === selected.doc.id ? runPhase : "idle"}
              stepStates={stepStates}
              results={runningTestId === selected.doc.id ? results : null}
              resultRunId={runningTestId === selected.doc.id ? resultRunId : null}
              runError={runningTestId === selected.doc.id ? runError : null}
              modules={modules}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center text-xs text-muted-foreground">
              Select or create a test file to describe the exact output of each pipeline step.
            </div>
          )}
        </ScrollArea>
      </div>
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

function TestDetail({
  state,
  project,
  projectDocs,
  onSaveEdit,
  onRun,
  onRetryLoad,
  onDirtyContentChange,
  lastVerdict,
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
  onRetryLoad: () => void
  onDirtyContentChange: (docName: doc_name_string, content: string | null) => void
  lastVerdict: boolean | null
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
  const serialized = draft ? draftToContent(draft, project.modules) : null
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
            <Button
              size="sm"
              className="h-8"
              onClick={() => onRun(dirty ? serialized : null)}
              disabled={runDisabled || draftBlocked}
              title={runTitle}
            >
              {runPhase === "running" ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="mr-1.5 h-3.5 w-3.5" />
              )}
              {runPhase === "running" ? "Running…" : dirty ? "Save & run" : "Run test"}
            </Button>
          )}
        </div>
      </div>

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
              <SectionLabel>run progress</SectionLabel>
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

