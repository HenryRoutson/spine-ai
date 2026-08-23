"use client"

// AI : Testing tab — *_testing.json files pin exact per-step outputs; a run pinpoints the
// AI : first step that diverges. Static checks stay in Structure/Pipeline; this is for full runs.
// AI : TODO (spec) — whole-JSON LLM overview diff alongside per-field deterministic/probabilistic checks.
// AI : TODO (arch-run-chrome) — inference.tsx shares start/stop/job-hub/trace chrome; extract RunWorkspaceChrome.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Boxes,
  CheckSquare,
  CircleCheck,
  CircleX,
  ListChecks,
  Loader2,
  MinusCircle,
  Plus,
  ScrollText,
  Sparkles,
  TriangleAlert,
} from "lucide-react"
import { SpineNavIcon } from "@/components/spine-mark"
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
import { suggestEditDocName, validateNewDocName } from "@/lib/doc-edit"
import { Input } from "@/components/ui/input"
import { GoToLoggingButton } from "@/components/inference/inference-run-chrome"
import { RunStopButton, RunWithStopButton } from "@/components/run-with-stop-button"
import { WindowHeader } from "@/components/window-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { uiContextTargetProps } from "@/lib/ui-context-dom"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { apiJson, JSON_HEADERS } from "@/lib/api-client"
import { API_ROUTES } from "@/lib/api-routes"
import { evaluateTestReport } from "@/lib/testing-evaluate"
import { useAppShell } from "@/lib/app-shell"
import { useRunJobs } from "@/lib/run-jobs-context"
import { RunJobSource } from "@/lib/run-jobs-types"
import { activeStepLabelFromStepStates, progressPctFromStepStates } from "@/lib/run-jobs-progress"
import { computeWorkspaceValidity } from "@/lib/workspace-validity-ui"
import { docTextContent, fetchDocText, invalidateDocText } from "@/lib/doc-text-cache"
import { flattenPipelineModules } from "@/lib/fork-pipeline"
import { labelAsStateKey } from "@/lib/server/pipeline_state"
import { docsForProject } from "@/lib/project-docs"
import { awaitRun, isRunBillingError, mergeStepStates, pollIntervalForParallelJobs, startRunWithRetry, type StepUiState } from "@/lib/run-engine"
import { buildChatbotResult } from "@/lib/chatbot-step"
import { isRunAbortedError, useCancellableRunRegistry } from "@/lib/use-cancellable-run"
import { useStore } from "@/lib/store"
import { formatCostCents, formatSecondsShort } from "@/lib/format"
import { runBilledCents, runTotalMs } from "@/lib/run-metrics"
import { useStatusPalette } from "@/lib/chart-colors"
import { timeAgo } from "@/lib/time-ago"
import {
  isTestingFileName,
  lastTestRunVerdictForDoc,
  latestTestVerdictForDoc,
  nextTestFileName,
  parseTestFile,
  resolveTestRunInputs,
  sanitizeTestFile,
  testFileSkeleton,
  testContentSig,
  testContentStableSig,
  testPipelineSig,
  testPipelineStableSig,
  testRunContextStableSig,
  testRunHistoryForDoc,
  testVerdictForFile,
  testReportPassed,
  validateTestFile,
  type SpineTestFile,
  type TestFileIssue,
  type TestStepResult,
} from "@/lib/testing-files"
import {
  evaluateInputCompatForTest,
  inputCompatBlockedForTest,
  syntheticInputCompatResults,
  testExpectsInputCompatFailure,
  testOutcomePassed,
  testOutcomeMode,
  testOutcomeModeInfo,
} from "@/lib/test-expect-failure"
import { ResizableSplit } from "@/components/resizable-split"
import {
  readTestingSidebarWidth,
  TESTING_SIDEBAR_MAX,
  TESTING_SIDEBAR_MIN,
  useTestingSidebarWidth,
  writeTestingSidebarWidth,
} from "@/lib/testing-settings"
import { cn } from "@/lib/utils"
import { DocLabel, InputType, RunSource, RunTestStepStatus, type PipelineRun, type RunTestReport } from "@/lib/types"
import { isPreviewOnly } from "@/lib/demo-mode"
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
  inputCompatBlocked?: boolean
}

const EMPTY_TEST_RUN: TestRunUiState = {
  phase: "idle",
  stepStates: new Map(),
  results: null,
  resultRunId: null,
  runError: null,
  jobId: null,
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
  return !t.issues.some((i) => i.level === "error")
}

type TestSidebarBadgeInfo = { label: string; className: string; tooltip: string }

function sidebarValidationBadge(status: ReturnType<typeof testStatus>): TestSidebarBadgeInfo | null {
  if (status !== "errors") return null
  return {
    label: "validation failed",
    className: "border-destructive/40 text-destructive",
    tooltip:
      "Validation failed — see the errors below. Usually a removed pipeline step, missing input doc, or type mismatch in expectedOutputs.",
  }
}

function TestSidebarBadge({ badge }: { badge: TestSidebarBadgeInfo }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant="outline"
            className={cn("shrink-0 cursor-help font-mono text-[9px]", badge.className)}
          />
        }
      >
        {badge.label}
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs text-left leading-relaxed">
        {badge.tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

function TestLastVerdictIcon({ passed, stale }: { passed: boolean; stale?: boolean }) {
  const className = cn(
    "h-3.5 w-3.5 shrink-0",
    stale && "opacity-45",
    passed ? "text-chart-2" : "text-destructive",
  )
  return passed ? (
    <CircleCheck className={className} aria-label={stale ? "Passed last run (stale)" : "Passed last run"} />
  ) : (
    <CircleX className={className} aria-label={stale ? "Failed last run (stale)" : "Failed last run"} />
  )
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
  const { setActiveWindow, focusTestDocName, clearFocusTestDoc } = useAppShell()
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
  const cancellable = useCancellableRunRegistry<doc_name_string>()
  const trackIdByDocName = useRef(new Map<doc_name_string, string>())
  const runJobs = useRunJobs()
  const [runAllActive, setRunAllActive] = useState(false)
  const [runAllDone, setRunAllDone] = useState(0)
  const [runAllTotal, setRunAllTotal] = useState(0)
  const [dirtyContentByName, setDirtyContentByName] = useState<Partial<Record<doc_name_string, string>>>({})

  const savedSidebarWidth = useTestingSidebarWidth()
  const [sidebarWidth, setSidebarWidth] = useState(readTestingSidebarWidth)
  useEffect(() => setSidebarWidth(savedSidebarWidth), [savedSidebarWidth])

  // AI panel
  const [aiOpen, setAiOpen] = useState(false)
  const [aiInstruction, setAiInstruction] = useState("")
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiGenerated, setAiGenerated] = useState<GeneratedTestFile | null>(null)

  const loadTestDoc = useCallback((docId: DocId, bustCache = false) => {
    if (loadingIds.current.has(docId)) return
    loadingIds.current.add(docId)
    if (bustCache) invalidateDocText(docId)
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
        const test = sanitizeTestFile(parsed.test, project)
        return { doc, content, test, issues: validateTestFile(test, project, projectDocs) }
      }),
    [testDocs, contents, loadErrors, project, projectDocs],
  )

  const selected =
    testStates.find((t) => t.doc.id === selectedId) ??
    (selectedName ? testStates.find((t) => t.doc.name === selectedName) : undefined) ??
    testStates[0]
  const selectedRun = selected ? (runByName.get(selected.doc.name) ?? EMPTY_TEST_RUN) : EMPTY_TEST_RUN

  const patchRunState = useCallback((docName: doc_name_string, patch: Partial<TestRunUiState>) => {
    setRunByName((prev) => {
      const next = new Map(prev)
      const cur = next.get(docName) ?? EMPTY_TEST_RUN
      next.set(docName, { ...cur, ...patch })
      return next
    })
  }, [])

  const beginTestJob = useCallback(
    (docName: doc_name_string) => {
      const trackId = runJobs.registerJob({
        source: RunJobSource.Testing,
        label: docName,
        projectId: project.id,
        testDocName: docName,
        modules,
        cancel: () => cancellable.stop(docName),
      })
      trackIdByDocName.current.set(docName, trackId)
      return trackId
    },
    [cancellable, modules, project.id, runJobs],
  )

  const updateTestJobProgress = useCallback(
    (docName: doc_name_string, stepStates: Map<ModuleId, StepUiState>) => {
      const trackId = trackIdByDocName.current.get(docName)
      if (!trackId) return
      runJobs.updateJobProgress(trackId, {
        stepStates,
        progressPct: progressPctFromStepStates(modules, stepStates),
        activeStepLabel: activeStepLabelFromStepStates(modules, stepStates),
      })
    },
    [modules, runJobs],
  )

  const finishTestJob = useCallback(
    (docName: doc_name_string, outcome: { runId?: string } | { error: string } | "stopped") => {
      const trackId = trackIdByDocName.current.get(docName)
      if (!trackId) return
      trackIdByDocName.current.delete(docName)
      if (outcome === "stopped") runJobs.stopJob(trackId)
      else if ("error" in outcome) runJobs.failJob(trackId, outcome.error)
      else runJobs.completeJob(trackId, outcome)
    },
    [runJobs],
  )

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

  const resolveLastRunVerdict = useCallback(
    (docName: doc_name_string, test?: SpineTestFile): boolean | null => {
      const live = runByName.get(docName)
      if (live?.phase === "done" && live.results) {
        if (test) {
          return testVerdictForFile(test, live.results, null, live.inputCompatBlocked ?? false)
        }
        return live.results.every(
          (r) => r.status !== RunTestStepStatus.Fail && r.status !== RunTestStepStatus.NotReached,
        )
      }
      return lastTestRunVerdictForDoc(runs, docName)
    },
    [runByName, runs],
  )

  const testsNeedingRun = useMemo(
    () => testStates.filter((t) => resolveLastVerdict(t.doc.name) === null),
    [testStates, resolveLastVerdict],
  )
  const staleTests = useMemo(
    () => testsNeedingRun.filter(isRunnableTest),
    [testsNeedingRun],
  )
  const staleBlockedCount = useMemo(
    () => testsNeedingRun.filter((t) => !isRunnableTest(t) && t.content !== undefined).length,
    [testsNeedingRun],
  )
  const runAllStaleTitle = useMemo(() => {
    if (runBlocked) {
      return typesInvalid ? "fix type errors first" : "fix pipeline errors first"
    }
    if (runAllActive) return undefined
    if (staleTests.length > 0) {
      return `Run ${staleTests.length} stale test(s) in parallel — test or pipeline changed, or not run yet for the current configuration`
    }
    if (staleBlockedCount > 0) {
      return `${staleBlockedCount} test(s) failed validation — fix them before running`
    }
    if (testsNeedingRun.some((t) => t.content === undefined)) {
      return "waiting for test files to finish loading"
    }
    return "all runnable tests have a current pass/fail verdict"
  }, [runBlocked, typesInvalid, runAllActive, staleTests.length, staleBlockedCount, testsNeedingRun])

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

  useEffect(() => {
    if (!focusTestDocName) return
    const match = testStates.find((t) => t.doc.name === focusTestDocName)
    if (match) selectTest(match.doc.id, match.doc.name)
    clearFocusTestDoc()
  }, [focusTestDocName, testStates, clearFocusTestDoc, selectTest])

  useEffect(() => {
    const running = runJobs.runningTestsForProject(project.id)
    if (!running.length) return
    setRunByName((prev) => {
      const next = new Map(prev)
      for (const job of running) {
        if (!job.testDocName) continue
        trackIdByDocName.current.set(job.testDocName, job.id)
        next.set(job.testDocName, {
          ...(next.get(job.testDocName) ?? EMPTY_TEST_RUN),
          phase: "running",
          stepStates: new Map(job.stepStates),
          jobId: job.jobId,
        })
      }
      return next
    })
  }, [project.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const stopTest = useCallback(
    (docName: doc_name_string) => {
      cancellable.stop(docName)
      finishTestJob(docName, "stopped")
      setRunByName((prev) => {
        const next = new Map(prev)
        const cur = next.get(docName) ?? EMPTY_TEST_RUN
        next.set(docName, { ...cur, phase: "idle", runError: "Stopped" })
        return next
      })
    },
    [cancellable, finishTestJob],
  )

  const stopAllRunningTests = useCallback(() => {
    cancellable.stopAll()
    for (const docName of trackIdByDocName.current.keys()) {
      finishTestJob(docName, "stopped")
    }
    setRunByName((prev) => {
      const next = new Map(prev)
      for (const [docName, rs] of prev) {
        if (rs.phase !== "running") continue
        next.set(docName, { ...rs, phase: "idle", runError: "Stopped" })
      }
      return next
    })
    setRunAllActive(false)
    setRunAllDone(0)
    setRunAllTotal(0)
  }, [cancellable, finishTestJob])

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

  // AI : files are immutable — edits fork under a new name (never replaceDocId).
  async function saveEdit(state: TestDocState, draft: string, newName: string): Promise<DocId | null> {
    setActionError(null)
    const nameErr = validateNewDocName(newName, state.doc.name, projectDocs)
    if (nameErr) {
      setActionError(nameErr)
      return null
    }
    const parsed = parseTestFile(draft)
    if (!parsed.ok) {
      setActionError(parsed.error)
      return null
    }
    try {
      const doc = await addDocContent(
        newName.trim(),
        InputType.Json,
        draft,
        DocLabel.Training,
        project.id,
      )
      setDirtyContentByName((prev) => {
        const { [state.doc.name]: _gone, ...rest } = prev
        return rest
      })
      setContents((prev) => {
        const { [state.doc.id]: _old, ...rest } = prev
        return { ...rest, [doc.id]: draft }
      })
      selectTest(doc.id, doc.name)
      return doc.id
    } catch (err) {
      setActionError((err as Error).message)
      return null
    }
  }

  // AI : one-click Run — unsaved form edits are saved as a new file first, then the run targets that id.
  async function saveAndRun(state: TestDocState, contentToSave: string | null, newName: string | null) {
    let target = state
    if (contentToSave !== null) {
      if (!newName) {
        setActionError("Choose a new file name before saving")
        return
      }
      const parsed = parseTestFile(contentToSave)
      if (!parsed.ok) {
        setActionError(parsed.error)
        return
      }
      const newId = await saveEdit(state, contentToSave, newName)
      if (!newId) return
      target = { ...state, doc: { ...state.doc, id: newId, name: newName.trim() }, content: contentToSave, test: parsed.test }
    }
    await runTest(target)
  }

  async function runTest(state: TestDocState, pollIntervalMs = 700): Promise<RunTestOutcome> {
    if (isPreviewOnly()) return "error"
    if (!state.test) return "error"
    const docName = state.doc.name

    if (testExpectsInputCompatFailure(state.test)) {
      const resolved = resolveTestRunInputs(state.test, modules, projectDocs)
      if (!resolved.ok) {
        patchRunState(docName, { runError: resolved.error, phase: "idle" })
        return "error"
      }
      const signal = cancellable.begin(docName)
      beginTestJob(docName)
      patchRunState(docName, {
        phase: "running",
        stepStates: new Map(),
        results: null,
        resultRunId: null,
        runError: null,
        jobId: null,
        inputCompatBlocked: undefined,
      })
      try {
        const contentByDocId: Record<string, string> = {}
        const docIds = new Set<string>()
        for (const docs of Object.values(resolved.assignment)) {
          const list = Array.isArray(docs) ? docs : [docs]
          for (const doc of list) {
            if (doc) docIds.add(doc.id)
          }
        }
        await Promise.all(
          [...docIds].map((id) =>
            fetchDocText(id).then((data) => {
              contentByDocId[id] = docTextContent(data)
            }),
          ),
        )
        if (signal.aborted) {
          finishTestJob(docName, "stopped")
          return "stopped"
        }
        const pairs = evaluateInputCompatForTest(state.test, modules, projectDocs, contentByDocId)
        const blocked = inputCompatBlockedForTest(state.test, modules, projectDocs, contentByDocId)
        const report = syntheticInputCompatResults(pairs, blocked)
        finishTestJob(docName, {})
        patchRunState(docName, {
          results: report,
          phase: "done",
          inputCompatBlocked: blocked,
          resultRunId: null,
        })
        return testOutcomePassed(state.test, report, null, blocked) ? "ok" : "error"
      } catch (err) {
        if (isRunAbortedError(err)) {
          finishTestJob(docName, "stopped")
          patchRunState(docName, { phase: "idle", runError: "Stopped" })
          return "stopped"
        }
        finishTestJob(docName, { error: (err as Error).message })
        patchRunState(docName, { runError: (err as Error).message, phase: "idle" })
        return "error"
      } finally {
        cancellable.clear(docName)
      }
    }

    const resolved = resolveTestRunInputs(state.test, modules, projectDocs)
    if (!resolved.ok) {
      patchRunState(docName, { runError: resolved.error, phase: "idle" })
      return "error"
    }
    const signal = cancellable.begin(docName)
    const trackId = beginTestJob(docName)
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
      cancellable.trackJobId(docName, jobId)
      runJobs.bindJobId(trackId, jobId)
      patchRunState(docName, { jobId })
      refreshBilling().catch(console.error)
      const { run } = await awaitRun(jobId, {
        signal,
        onStep: (steps) => {
          // AI : compute merged in updater, but sync RunJobsProvider outside it — setState updaters must stay pure.
          let merged: Map<ModuleId, StepUiState> = new Map()
          setRunByName((prev) => {
            const cur = prev.get(docName) ?? EMPTY_TEST_RUN
            merged = mergeStepStates(cur.stepStates, steps)
            const next = new Map(prev)
            next.set(docName, { ...cur, stepStates: merged })
            return next
          })
          updateTestJobProgress(docName, merged)
        },
        // AI : tests are unattended — auto-approve human-review gates.
        onHumanReview: () => Promise.resolve("approved" as const),
        // AI : tests are unattended — exit chatbot with empty transcript.
        onChatbot: (spec) => {
          const prompt =
            spec.input && typeof spec.input === "object" && !Array.isArray(spec.input) && typeof (spec.input as { prompt?: unknown }).prompt === "string"
              ? (spec.input as { prompt: string }).prompt
              : ""
          return Promise.resolve(buildChatbotResult(prompt, [], "exit"))
        },
        projectLlmProviders: project.llmProviders,
      }, pollIntervalMs)
      const report = await evaluateTestReport(run, state.test, project, model)
      refreshBilling().catch(console.error)
      const content = state.content ?? ""
      const persistedTest: RunTestReport = {
        testDocName: docName,
        results: report,
        testContentSig: testContentSig(content),
        pipelineSig,
        expectFailure: state.test.expectFailure,
      }
      // AI : upsert locally with verdict immediately so run history updates before PATCH returns.
      addRun({ ...run, source: run.source ?? RunSource.Testing, test: persistedTest })
      finishTestJob(docName, { runId: run.id })
      patchRunState(docName, { results: report, resultRunId: run.id, phase: "done" })
      // AI : pin verdict + content/pipeline hashes onto the run row (Supabase via PATCH /api/runs).
      updateRunTest(run.id, persistedTest).catch(console.error)
      return testOutcomePassed(state.test, report, run, false) ? "ok" : "error"
    } catch (err) {
      if (isRunAbortedError(err)) {
        finishTestJob(docName, "stopped")
        patchRunState(docName, { phase: "idle", runError: "Stopped" })
        return "stopped"
      }
      if (isRunBillingError(err)) {
        finishTestJob(docName, { error: (err as Error).message })
        refreshBilling().catch(console.error)
        patchRunState(docName, { runError: (err as Error).message, phase: "idle" })
        return "billing"
      }
      finishTestJob(docName, { error: (err as Error).message })
      patchRunState(docName, { runError: (err as Error).message, phase: "idle" })
      return "error"
    } finally {
      cancellable.clear(docName)
    }
  }

  async function runAllStaleTests() {
    if (!staleTests.length) {
      setActionError("No stale tests — every runnable test already has a current pass/fail for this configuration.")
      return
    }
    setActionError(null)
    setRunAllActive(true)
    setRunAllTotal(staleTests.length)
    setRunAllDone(0)
    let billingHit = false
    try {
      const pollIntervalMs = pollIntervalForParallelJobs(staleTests.length)
      await Promise.all(
        staleTests.map(async (t) => {
          const outcome = await runTest(t, pollIntervalMs)
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
        actions={
          <>
            <RunWithStopButton
              variant="outline"
              running={runAllActive}
              onRun={() => void runAllStaleTests()}
              onStop={() => stopAllRunningTests()}
              disabled={runBlocked || staleTests.length === 0}
              title={runAllStaleTitle}
              label={`Run all stale${staleTests.length > 0 ? ` (${staleTests.length})` : ""}`}
              runningLabel={`Running stale (${runAllDone}/${runAllTotal})…`}
              stopLabel="Stop all"
              stopTitle="Stop all running tests"
              idleIcon={<ListChecks className="mr-1.5 h-3.5 w-3.5" />}
              spineId="testing.run"
              stopSpineId="testing.stop"
            />
            <Button size="sm" variant="outline" className="h-8 bg-transparent" onClick={() => setAiOpen((v) => !v)}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Generate with AI
            </Button>
            <Button size="sm" className="h-8" onClick={() => void createBlankTest()} disabled={creatingTest} spineId="testing.new-file">
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
                  <SpineNavIcon className="h-3.5 w-3.5" />
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

      <ResizableSplit
        className="min-h-0 flex-1"
        leadingWidth={sidebarWidth}
        onLeadingWidthChange={setSidebarWidth}
        onLeadingWidthCommit={writeTestingSidebarWidth}
        minLeading={TESTING_SIDEBAR_MIN}
        maxLeading={TESTING_SIDEBAR_MAX}
        leading={
          <>
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
              <TooltipProvider delay={200}>
                <ul className="p-1.5">
                  {testStates.map((t) => {
                    const status = testStatus(t)
                    const isSelected = selected?.doc.id === t.doc.id
                    const currentVerdict = resolveLastVerdict(t.doc.name)
                    const lastRunVerdict = resolveLastRunVerdict(t.doc.name, t.test)
                    const verdictStale = lastRunVerdict !== null && currentVerdict === null
                    const testRun = runByName.get(t.doc.name) ?? EMPTY_TEST_RUN
                    const isRunning = testRun.phase === "running"
                    const validationBadge = sidebarValidationBadge(status)
                    const verdictTooltip =
                      lastRunVerdict === null
                        ? "Not run yet"
                        : verdictStale
                          ? lastRunVerdict
                            ? "Passed last run — test or pipeline changed since then"
                            : "Failed last run — test or pipeline changed since then"
                          : lastRunVerdict
                            ? "Passed last run for current configuration"
                            : "Failed last run for current configuration"
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
                            className="flex min-w-0 flex-1 items-start gap-2 rounded-md px-1 py-1 text-left hover:bg-accent"
                            {...uiContextTargetProps({
                              kind: "project_doc",
                              id: `doc:${t.doc.id}`,
                              label: `Test · ${t.doc.name}`,
                              snippet: [
                                verdictTooltip,
                                validationBadge ? `validation: ${validationBadge}` : null,
                                isRunning ? "running" : null,
                              ]
                                .filter(Boolean)
                                .join(" · "),
                            })}
                          >
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <span className="mt-0.5 inline-flex shrink-0">
                                    {isRunning ? (
                                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                    ) : lastRunVerdict === null ? (
                                      <CheckSquare className="h-4 w-4 text-primary" />
                                    ) : (
                                      <TestLastVerdictIcon passed={lastRunVerdict} stale={verdictStale} />
                                    )}
                                  </span>
                                }
                              />
                              <TooltipContent side="right" className="max-w-xs text-left font-mono text-[10px]">
                                {verdictTooltip}
                              </TooltipContent>
                            </Tooltip>
                            <span
                              className="min-w-0 flex-1 break-all font-mono text-[11px] leading-snug"
                              title={t.doc.name}
                            >
                              {t.doc.name}
                            </span>
                            {validationBadge && <TestSidebarBadge badge={validationBadge} />}
                          </button>
                          {isRunning && (
                            <RunStopButton
                              onClick={(e) => {
                                e.stopPropagation()
                                stopTest(t.doc.name)
                              }}
                              spineId="testing.stop"
                            />
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </TooltipProvider>
            </ScrollArea>
          </>
        }
        trailing={
          /* AI : single native scroll for the whole test editor — no nested ScrollArea inside the pipeline block */
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
            {selected ? (
              <TestDetail
                key={selected.doc.name} // AI : stable until Save-as renames; remount resets draft
                state={selected}
                project={project}
                projectDocs={projectDocs}
                onSaveEdit={(draft, newName) => void saveEdit(selected, draft, newName)}
                onRun={(contentToSave, newName) => void saveAndRun(selected, contentToSave, newName)}
                onStop={() => stopTest(selected.doc.name)}
                onRetryLoad={() => loadTestDoc(selected.doc.id, true)}
                onDirtyContentChange={onDirtyContentChange}
                lastRunVerdict={resolveLastRunVerdict(selected.doc.name, selected.test)}
                verdictStale={
                  resolveLastRunVerdict(selected.doc.name, selected.test) !== null &&
                  resolveLastVerdict(selected.doc.name) === null
                }
                runs={runs}
                runDisabled={runBlocked || runAllActive || selectedRun.phase === "running" || isPreviewOnly()}
                runPhase={selectedRun.phase}
                stepStates={selectedRun.stepStates}
                results={selectedRun.results}
                resultRunId={selectedRun.resultRunId}
                runError={selectedRun.runError}
                inputCompatBlocked={selectedRun.inputCompatBlocked}
                modules={modules}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center text-xs text-muted-foreground">
                Select or create a test file to describe the exact output of each pipeline step.
              </div>
            )}
          </div>
        }
      />
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
          const passed = run.test ? testReportPassed(run.test, run) : run.status === "ok"
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
  lastRunVerdict,
  verdictStale,
  runs,
  runDisabled,
  runPhase,
  stepStates,
  results,
  resultRunId,
  runError,
  inputCompatBlocked,
  modules,
}: {
  state: TestDocState
  project: Project
  projectDocs: DocRef[]
  onSaveEdit: (draft: string, newName: string) => void
  onRun: (contentToSave: string | null, newName: string | null) => void
  onStop: () => void
  onRetryLoad: () => void
  onDirtyContentChange: (docName: doc_name_string, content: string | null) => void
  lastRunVerdict: boolean | null
  verdictStale: boolean
  runs: PipelineRun[]
  runDisabled: boolean
  runPhase: RunPhase
  stepStates: Map<ModuleId, StepUiState>
  results: TestStepResult[] | null
  resultRunId: string | null
  runError: string | null
  inputCompatBlocked?: boolean
  modules: PipelineModule[]
}) {
  const { openLogging } = useAppShell()
  // AI : form edits a TestDraft — Save forks under a new name (files stay immutable).
  const [draft, setDraft] = useState<TestDraft | null>(null)
  const [initialSig, setInitialSig] = useState<string | null>(null)
  const [fixDraft, setFixDraft] = useState<string | null>(null)
  const [saveAsName, setSaveAsName] = useState(() => suggestEditDocName(state.doc.name, projectDocs))

  // AI : resync form when the underlying file changes (load, save-as, or content-hash id swap).
  useEffect(() => {
    setDraft(null)
    setInitialSig(null)
    setFixDraft(null)
    setSaveAsName(suggestEditDocName(state.doc.name, projectDocs))
  }, [state.doc.id, state.doc.name, projectDocs])

  useEffect(() => {
    if (state.content === undefined || state.parseError || !state.test) return
    const d = draftFromTest(state.test, project)
    setDraft(d)
    setInitialSig(JSON.stringify(d))
  }, [state.doc.id, state.content, state.parseError])

  const dirty = draft !== null && JSON.stringify(draft) !== initialSig
  const serialized = draft ? draftToContent(draft, project) : null
  const nameError = dirty || state.parseError ? validateNewDocName(saveAsName, state.doc.name, projectDocs) : null
  const draftBlocked = draft === null || serialized === null || draftHasErrors(draft, project, projectDocs)
  const expectFailure = state.test?.expectFailure
  const resultsVerdict =
    results && state.test
      ? testVerdictForFile(state.test, results, null, inputCompatBlocked ?? false)
      : undefined

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
      : draft && draftHasErrors(draft, project, projectDocs)
        ? "fix the errors marked in red first"
        : dirty && nameError
          ? nameError
          : undefined

  // AI : step key → actual output from the last run so the form can capture it
  const actuals = useMemo(() => {
    const m = new Map<string, unknown>()
    for (const r of results ?? []) if (r.actual !== undefined) m.set(labelAsStateKey(r.label), r.actual)
    return m
  }, [results])

  // AI : persisted inputDescription checks — survives after stepStates clears post-run
  const inputChecksByModuleId = useMemo(() => {
    const m = new Map<ModuleId, NonNullable<TestStepResult["inputDescriptionCheck"]>>()
    for (const r of results ?? []) {
      if (!r.inputDescriptionCheck) continue
      const mod = flattenPipelineModules(modules).find((x) => labelAsStateKey(x.label) === labelAsStateKey(r.label))
      if (mod) m.set(mod.id, r.inputDescriptionCheck)
    }
    return m
  }, [results, modules])

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            {lastRunVerdict === null ? (
              <CheckSquare className="h-4 w-4 text-primary" />
            ) : (
              <TestLastVerdictIcon passed={lastRunVerdict} stale={verdictStale} />
            )}
            <span className="break-all font-mono">{state.doc.name}</span>
            {expectFailure && (
              <Badge variant="outline" className="shrink-0 font-mono text-[9px] text-yellow-700 dark:text-yellow-500">
                {testOutcomeModeInfo(testOutcomeMode(expectFailure)).label}
              </Badge>
            )}
            {lastRunVerdict !== null && (
              <span
                className={cn(
                  "shrink-0 font-mono text-[10px] font-normal",
                  lastRunVerdict ? "text-chart-2" : "text-destructive",
                  verdictStale && "opacity-60",
                )}
              >
                {lastRunVerdict ? "passed last run" : "failed last run"}
                {verdictStale ? " · stale" : ""}
              </span>
            )}
          </h3>
          {dirty && (
            <div className="mt-2 max-w-md space-y-1">
              <p className="font-mono text-[10px] text-muted-foreground">
                Files are immutable — save as a new name
              </p>
              <Input
                value={saveAsName}
                onChange={(e) => setSaveAsName(e.target.value)}
                className="h-7 font-mono text-[11px]"
                spellCheck={false}
              />
              {nameError && <p className="font-mono text-[10px] text-destructive">{nameError}</p>}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {dirty && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-8 bg-transparent"
                onClick={() => {
                  if (initialSig) setDraft(JSON.parse(initialSig) as TestDraft)
                  setSaveAsName(suggestEditDocName(state.doc.name, projectDocs))
                }}
              >
                Discard
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 bg-transparent"
                disabled={serialized === null || !!nameError}
                title={nameError ?? (serialized === null ? "fix invalid JSON values first" : undefined)}
                onClick={() => serialized && onSaveEdit(serialized, saveAsName)}
              >
                Save as
              </Button>
            </>
          )}
          {!state.parseError && !state.loadError && (
            <RunWithStopButton
              running={runPhase === "running"}
              onRun={() => onRun(dirty ? serialized : null, dirty ? saveAsName : null)}
              onStop={() => onStop()}
              disabled={runDisabled || draftBlocked || (!!dirty && !!nameError)}
              title={runTitle}
              label={dirty ? "Save as & run" : "Run test"}
              stopTitle="Stop this test run"
              spineId="testing.run"
              stopSpineId="testing.stop"
            />
          )}
        </div>
      </div>

      {!state.loadError && !state.parseError && (
        <TestRunHistory docName={state.doc.name} runs={runs} onOpenLog={openLogging} />
      )}

      {!state.loadError && !state.parseError && state.issues.some((i) => i.level === "error") && (
        <IssueList issues={state.issues.filter((i) => i.level === "error")} />
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
            {state.parseError} — fix the file below and save as a new name.
          </p>
          <Input
            value={saveAsName}
            onChange={(e) => setSaveAsName(e.target.value)}
            className="h-7 font-mono text-[11px]"
            spellCheck={false}
            placeholder="new_file_testing.json"
          />
          {nameError && <p className="font-mono text-[10px] text-destructive">{nameError}</p>}
          <Textarea
            value={fixDraft ?? state.content ?? ""}
            onChange={(e) => setFixDraft(e.target.value)}
            className="min-h-[360px] font-mono text-[11px]"
            spellCheck={false}
          />
          <Button
            size="sm"
            className="h-8"
            disabled={fixDraft === null || !!nameError}
            onClick={() => fixDraft && onSaveEdit(fixDraft, saveAsName)}
          >
            Save as new file
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
              stepStates={stepStates}
              inputChecksByModuleId={inputChecksByModuleId}
            />
          )}

          {runPhase === "running" && (
            <section>
              <div className="flex items-center gap-2">
                <SectionLabel>run progress</SectionLabel>
                <RunStopButton onClick={onStop} spineId="testing.stop" />
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
              verdictPassed={resultsVerdict}
              expectFailure={expectFailure}
              testDocName={state.doc.name}
              run={resultRunId ? (runs.find((r) => r.id === resultRunId) ?? null) : null}
              runError={runError}
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

