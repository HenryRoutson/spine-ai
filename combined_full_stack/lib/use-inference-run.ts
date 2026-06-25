"use client"

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react"
import { apiJson } from "@/lib/api-client"
import { defaultInferenceDoc } from "@/lib/project-docs"
import {
  buildDefaultInputDocs,
  inputDocIdsForModules,
  orderedInputModules,
  resolveInputDocs,
} from "@/lib/inference-input"
import {
  probeLocalInferenceCache,
  probeServerInferenceCache,
  writeInferenceSessionCache,
} from "@/lib/inference-cache-probe"
import {
  collectInferenceInputIssues,
  inferenceDocNeedsFullContent,
  type InferenceInputIssue,
} from "@/lib/inference-validity"
import { computeRunFingerprint, runConfigStableKey } from "@/lib/run-fingerprint"
import { pipelineRunError } from "@/lib/run-errors"
import { segmentPipeline } from "@/lib/pipeline-layout"
import { useCyclingWaitPhrase } from "@/lib/inference-wait-phrases"
import { useRunNotesFlushOnLeave } from "@/lib/run-notes-flush"
import {
  awaitRun,
  isRunBillingError,
  matchRun,
  mergeStepStates,
  startRun,
  type JobLogEntry,
  type StepUiState,
} from "@/lib/run-engine"
import type { DocId, DocRef, ModelId, ModuleId, PipelineModule, PipelineRun, Project, ProjectId } from "@/lib/types"

export type InferencePhase = "idle" | "running" | "done"

function applyCachedRun(
  matchedRun: PipelineRun,
  matchedId: PipelineRun["id"],
  probeKey: string,
  confirmedProbeKeyRef: MutableRefObject<string | null>,
  storeRuns: PipelineRun[],
  addRun: (r: PipelineRun) => void,
  setters: {
    setRun: (run: PipelineRun) => void
    setCachedRunId: (id: PipelineRun["id"]) => void
    setWasDeduped: (v: boolean) => void
    setPhase: (phase: InferencePhase) => void
    setRunNotes: (notes: string) => void
    savedNotesRef: MutableRefObject<string | undefined>
  },
) {
  confirmedProbeKeyRef.current = probeKey
  if (!storeRuns.some((r) => r.id === matchedId)) addRun(matchedRun)
  setters.setRun(matchedRun)
  setters.setCachedRunId(matchedId)
  setters.setWasDeduped(true)
  setters.setPhase("done")
  const notes = matchedRun.notes ?? ""
  setters.setRunNotes(notes)
  setters.savedNotesRef.current = matchedRun.notes
}

type UseInferenceRunArgs = {
  project: Project
  modules: PipelineModule[]
  model: string
  docs: DocRef[]
  runs: PipelineRun[]
  inferenceInputDocIds: Partial<Record<ModuleId, DocId>>
  setInferenceInputDocIds: (docs: Partial<Record<ModuleId, DocId>>) => void
  addRun: (r: PipelineRun) => void
  updateRunNotes: (runId: PipelineRun["id"], notes: string | undefined) => Promise<void>
  refreshBilling: () => Promise<void>
}

export function useInferenceRun({
  project,
  modules,
  model,
  docs,
  runs,
  inferenceInputDocIds,
  setInferenceInputDocIds,
  addRun,
  updateRunNotes,
  refreshBilling,
}: UseInferenceRunArgs) {
  const [inputDocs, setInputDocs] = useState<Partial<Record<ModuleId, DocRef>>>({})
  const [inputIssues, setInputIssues] = useState<InferenceInputIssue[]>([])
  const [validatingInputs, setValidatingInputs] = useState(false)
  const [probingCache, setProbingCache] = useState(false)
  const [pickerModuleId, setPickerModuleId] = useState<ModuleId | null>(null)
  const [phase, setPhase] = useState<InferencePhase>("idle")
  const [stepStates, setStepStates] = useState<Map<ModuleId, StepUiState>>(new Map())
  const [run, setRun] = useState<PipelineRun | null>(null)
  const [cachedRunId, setCachedRunId] = useState<string | null>(null)
  const [wasDeduped, setWasDeduped] = useState(false)
  const [dbFingerprint, setDbFingerprint] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [debugLogs, setDebugLogs] = useState<JobLogEntry[]>([])
  const [runNotes, setRunNotes] = useState("")
  const runNotesRef = useRef("")
  const savedNotesRef = useRef<string | undefined>(undefined)
  const logEndRef = useRef<HTMLDivElement>(null)
  const prevProjectIdRef = useRef<ProjectId | null>(null)
  const confirmedProbeKeyRef = useRef<string | null>(null)
  const cacheDismissedRef = useRef(false)
  const docTextCacheRef = useRef<Map<string, string>>(new Map())
  const probeGenRef = useRef(0)
  const activeJobGenRef = useRef(0)

  useEffect(() => {
    runNotesRef.current = runNotes
  }, [runNotes])

  const inputModules = useMemo(() => orderedInputModules(modules), [modules])
  const pickerModule = pickerModuleId ? inputModules.find((m) => m.id === pickerModuleId) : undefined
  const allInputsReady = inputModules.every((m) => inputDocs[m.id])
  const inputsInvalid = inputIssues.length > 0
  const inputIssueByModule = useMemo(
    () => new Map(inputIssues.map((issue) => [issue.moduleId, issue])),
    [inputIssues],
  )
  // AI : proactive cache shortcut disabled — was blocking re-runs with "View cached run in Logging".
  const configAlreadyCompleted = false
  const loggingRunId = cachedRunId ?? run?.id

  const inputDocIdsKey = inputModules.map((m) => inputDocs[m.id]?.id ?? "").join(",")
  const configKey = useMemo(
    () => runConfigStableKey(project, model as ModelId),
    [project, model],
  )
  const probeKey = `${project.id}:${configKey}:${inputDocIdsKey}`
  const runsFingerprintKey = useMemo(
    () => runs.map((r) => `${r.id}:${r.fingerprint ?? ""}:${r.status}`).join("|"),
    [runs],
  )

  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const inputModulesRef = useRef(inputModules)
  inputModulesRef.current = inputModules
  const inputDocsRef = useRef(inputDocs)
  inputDocsRef.current = inputDocs
  const runsRef = useRef(runs)
  runsRef.current = runs
  const docsRef = useRef(docs)
  docsRef.current = docs
  const projectRef = useRef(project)
  projectRef.current = project
  const prevProbeKeyRef = useRef(probeKey)

  useEffect(() => {
    // AI : proactive cache probe disabled — let users always hit Run; server dedup still applies on POST.
    return
    if (!allInputsReady || phaseRef.current === "running") return
    if (prevProbeKeyRef.current !== probeKey) {
      prevProbeKeyRef.current = probeKey
      confirmedProbeKeyRef.current = null
      cacheDismissedRef.current = false
    }
    if (confirmedProbeKeyRef.current === probeKey) return
    if (cacheDismissedRef.current) {
      confirmedProbeKeyRef.current = probeKey
      return
    }

    const probeGen = ++probeGenRef.current
    const probeProjectId = project.id as ProjectId
    const cacheSetters = {
      setRun,
      setCachedRunId,
      setWasDeduped,
      setPhase,
      setRunNotes,
      savedNotesRef,
    }
    const probeStillValid = () =>
      probeGen === probeGenRef.current &&
      phaseRef.current === "idle" &&
      projectRef.current.id === probeProjectId
    async function probeDbMatch() {
      const inputMods = inputModulesRef.current
      const docsByModule = inputDocsRef.current
      const storeDocs = docsRef.current
      const storeRuns = runsRef.current
      const storeProject = projectRef.current
      const resolvedModel = model as ModelId
      const projectId = probeProjectId

      try {
        const localOutcome = await probeLocalInferenceCache({
          projectId,
          probeKey,
          project: storeProject,
          model: resolvedModel,
          docs: storeDocs,
          runs: storeRuns,
          inputModules: inputMods,
          inputDocs: docsByModule,
        })
        if (probeGen !== probeGenRef.current) return
        setDbFingerprint(localOutcome.fingerprint)

        if (localOutcome.kind === "session-hint") {
          setProbingCache(true)
          const serverOutcome = await probeServerInferenceCache({
            projectId,
            project: storeProject,
            model: resolvedModel,
            inputModules: inputMods,
            inputDocs: docsByModule,
            fingerprint: localOutcome.fingerprint,
          })
          if (!probeStillValid()) return
          setDbFingerprint(serverOutcome.fingerprint)
          if (serverOutcome.kind === "hit") {
            applyCachedRun(
              serverOutcome.run,
              serverOutcome.runId,
              probeKey,
              confirmedProbeKeyRef,
              storeRuns,
              addRun,
              cacheSetters,
            )
            writeInferenceSessionCache(projectId, probeKey, serverOutcome.runId)
            return
          }
          confirmedProbeKeyRef.current = null
          if (phaseRef.current !== "idle") return
          setCachedRunId(null)
          setWasDeduped(false)
          setPhase("idle")
          setRun(null)
          return
        }

        if (localOutcome.kind === "hit") {
          if (!probeStillValid()) return
          applyCachedRun(
            localOutcome.run,
            localOutcome.runId,
            probeKey,
            confirmedProbeKeyRef,
            storeRuns,
            addRun,
            cacheSetters,
          )
          if (localOutcome.source === "local") {
            writeInferenceSessionCache(projectId, probeKey, localOutcome.runId)
          }
          return
        }

        setProbingCache(true)
        const serverOutcome = await probeServerInferenceCache({
          projectId,
          project: storeProject,
          model: resolvedModel,
          inputModules: inputMods,
          inputDocs: docsByModule,
          fingerprint: localOutcome.fingerprint,
        })
        if (!probeStillValid()) return
        setDbFingerprint(serverOutcome.fingerprint)

        if (serverOutcome.kind === "hit") {
          applyCachedRun(
            serverOutcome.run,
            serverOutcome.runId,
            probeKey,
            confirmedProbeKeyRef,
            storeRuns,
            addRun,
            cacheSetters,
          )
          writeInferenceSessionCache(projectId, probeKey, serverOutcome.runId)
          return
        }

        confirmedProbeKeyRef.current = null
        // AI : keep a run the user just finished or is executing — a stale server miss must not rewind UI.
        if (phaseRef.current !== "idle") return
        setCachedRunId(null)
        setWasDeduped(false)
        setPhase("idle")
        setRun(null)
      } catch (e) {
        console.error(e)
      } finally {
        if (probeGen === probeGenRef.current) setProbingCache(false)
      }
    }
    void probeDbMatch()
  }, [probeKey, allInputsReady, project.id, model, runsFingerprintKey, addRun])

  useEffect(() => {
    if (!allInputsReady) return
    const ids = Object.fromEntries(
      inputModules.filter((m) => inputDocs[m.id]).map((m) => [m.id, inputDocs[m.id]!.id as DocId]),
    ) as Partial<Record<ModuleId, DocId>>
    const unchanged = inputModules.every((m) => inferenceInputDocIds[m.id] === ids[m.id])
    if (unchanged) return
    setInferenceInputDocIds(ids)
  }, [probeKey, allInputsReady, inferenceInputDocIds, setInferenceInputDocIds, inputModules, inputDocs])

  useEffect(() => {
    let cancelled = false
    function contentFromCache(assigned: PipelineModule[]): Partial<Record<string, string>> {
      const contentByDocId: Partial<Record<string, string>> = {}
      for (const m of assigned) {
        const doc = inputDocs[m.id]!
        const cached = docTextCacheRef.current.get(doc.id)
        if (cached) contentByDocId[doc.id] = cached
      }
      return contentByDocId
    }
    async function validateInputs() {
      const assigned = inputModules.filter((m) => inputDocs[m.id])
      if (!assigned.length) {
        setInputIssues([])
        return
      }
      const contentByDocId = contentFromCache(assigned)
      setInputIssues(collectInferenceInputIssues(inputModules, inputDocs, contentByDocId))

      const docIdsToFetch = [
        ...new Set(
          assigned
            .filter((m) => {
              const doc = inputDocs[m.id]!
              return inferenceDocNeedsFullContent(m, doc) && !docTextCacheRef.current.has(doc.id)
            })
            .map((m) => inputDocs[m.id]!.id),
        ),
      ]
      if (!docIdsToFetch.length) return

      setValidatingInputs(true)
      const fetchFailedDocIds = new Set<string>()
      try {
        await Promise.all(
          docIdsToFetch.map(async (docId) => {
            try {
              const { text } = await apiJson<{ text: string }>(`/api/docs/${docId}/text`)
              docTextCacheRef.current.set(docId, text)
            } catch {
              // AI : dev HMR / tab churn can abort fetches — block run until text loads.
              fetchFailedDocIds.add(docId)
            }
          }),
        )
      } finally {
        if (!cancelled) setValidatingInputs(false)
      }
      if (cancelled) return
      const issues = collectInferenceInputIssues(inputModules, inputDocs, contentFromCache(assigned))
      for (const m of assigned) {
        const doc = inputDocs[m.id]!
        if (fetchFailedDocIds.has(doc.id) && inferenceDocNeedsFullContent(m, doc)) {
          issues.push({
            moduleId: m.id,
            docName: doc.name,
            message: "could not load document text for validation",
          })
        }
      }
      setInputIssues(issues)
    }
    void validateInputs()
    return () => {
      cancelled = true
    }
  }, [probeKey, inputModules, inputDocs])

  useEffect(() => {
    const switched = prevProjectIdRef.current != null && prevProjectIdRef.current !== project.id
    prevProjectIdRef.current = project.id as ProjectId
    setInputDocs(
      resolveInputDocs(docs, project, inputModules, inferenceInputDocIds, defaultInferenceDoc(docs, project)),
    )
    if (switched) {
      activeJobGenRef.current++
      probeGenRef.current++
      docTextCacheRef.current.clear()
      confirmedProbeKeyRef.current = null
      setPhase("idle")
      setStepStates(new Map())
      setRun(null)
      setCachedRunId(null)
      setWasDeduped(false)
      setDbFingerprint(null)
      setProbingCache(false)
      setError(null)
      setDebugLogs([])
      setRunNotes("")
      savedNotesRef.current = undefined
      setInputIssues([])
      setPickerModuleId(null)
    }
  }, [project.id, docs, inputModules, inferenceInputDocIds, project])

  // AI : session hint can restore cachedRunId before the run row hydrates from the store.
  useEffect(() => {
    if (!cachedRunId || run?.id === cachedRunId) return
    const matched = runs.find((r) => r.id === cachedRunId)
    if (!matched) return
    setRun(matched)
    const notes = matched.notes ?? ""
    setRunNotes(notes)
    savedNotesRef.current = matched.notes
  }, [cachedRunId, runs, run?.id])

  useEffect(() => {
    return () => {
      activeJobGenRef.current++
    }
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [debugLogs.length])

  useRunNotesFlushOnLeave(
    phase === "done" ? run?.id : undefined,
    runNotes,
    run?.notes,
    updateRunNotes,
    (id, next) => {
      savedNotesRef.current = next
      setRun((r) => (r?.id === id ? { ...r, notes: next } : r))
    },
  )

  function setInputDocForModule(moduleId: ModuleId, doc: DocRef) {
    setInputDocs((prev) => ({ ...prev, [moduleId]: doc }))
    setPickerModuleId(null)
  }

  function useSamples() {
    setInputDocs(buildDefaultInputDocs(docs, project, inputModules, defaultInferenceDoc(docs, project)))
  }

  async function start() {
    if (!allInputsReady || inputsInvalid) return
    probeGenRef.current++
    const jobGen = ++activeJobGenRef.current
    const orderedIds = inputModules.map((m) => inputDocs[m.id]!.id as DocId)
    const [primary, ...rest] = orderedIds
    if (phase === "done") {
      setRunNotes("")
      runNotesRef.current = ""
    }
    cacheDismissedRef.current = false
    confirmedProbeKeyRef.current = null
    setPhase("running")
    setError(null)
    setRun(null)
    setCachedRunId(null)
    setWasDeduped(false)
    setStepStates(new Map())
    setDebugLogs([])
    try {
      const { jobId } = await startRun(project.id as ProjectId, primary, model, rest)
      if (jobGen !== activeJobGenRef.current) return
      refreshBilling().catch(console.error)
      const { run: finished, deduped, cachedRunId: matchedCachedId } = await awaitRun(jobId, {
        onStep: (steps) => {
          if (jobGen !== activeJobGenRef.current) return
          setStepStates((prev) => mergeStepStates(prev, steps))
        },
        onLogs: (logs) => {
          if (jobGen !== activeJobGenRef.current) return
          setDebugLogs(logs)
        },
      })
      if (jobGen !== activeJobGenRef.current) return
      if (deduped) {
        // AI : dedup completion UI disabled until cache/dedup bugs are fixed.
        setPhase("idle")
        setRun(null)
        setCachedRunId(null)
        setWasDeduped(false)
        setStepStates(new Map())
        setDebugLogs([])
        return
      }
      const notes = runNotesRef.current.trim() || undefined
      const withNotes = notes ? { ...finished, notes } : finished
      savedNotesRef.current = notes
      setRun(withNotes)
      const logId = deduped ? (matchedCachedId ?? finished.id) : finished.id
      setCachedRunId(finished.status === "ok" ? logId : null)
      setWasDeduped(deduped ?? false)
      if (finished.status === "ok") {
        confirmedProbeKeyRef.current = probeKey
        writeInferenceSessionCache(project.id as ProjectId, probeKey, logId)
        const ids = inputDocIdsForModules(inputModules, inputDocs)
        const [p, ...r] = ids
        matchRun(project.id as ProjectId, p, model, r)
          .then(({ fingerprint }) => {
            if (jobGen === activeJobGenRef.current) setDbFingerprint(fingerprint)
          })
          .catch(console.error)
      }
      if (!runsRef.current.some((r) => r.id === finished.id)) {
        addRun(withNotes)
      }
      if (!deduped && notes) updateRunNotes(finished.id, notes).catch(console.error)
      const runErr = pipelineRunError(finished)
      if (runErr) setError(runErr)
      setPhase("done")
    } catch (e) {
      if (jobGen !== activeJobGenRef.current) return
      if (isRunBillingError(e)) refreshBilling().catch(console.error)
      setError((e as Error).message)
      setPhase("idle")
    }
  }

  function reset() {
    cacheDismissedRef.current = true
    confirmedProbeKeyRef.current = probeKey
    setPhase("idle")
    setStepStates(new Map())
    setRun(null)
    setCachedRunId(null)
    setWasDeduped(false)
    setDbFingerprint(null)
    setError(null)
    setDebugLogs([])
    setRunNotes("")
    savedNotesRef.current = undefined
  }

  const progressPct = useMemo(() => {
    if (phase === "idle") return 0
    if (phase === "done") return 100
    const done = modules.filter((m) => {
      const s = stepStates.get(m.id)?.status
      return s !== undefined && s !== "idle" && s !== "running"
    }).length
    return Math.round((done / Math.max(1, modules.length)) * 100)
  }, [phase, stepStates, modules])

  const runningHints = useMemo(() => {
    const hints: string[] = []
    for (const seg of segmentPipeline(modules)) {
      if (seg.kind === "combine") {
        const combineUi = stepStates.get(seg.combine.id)
        const inputUi = stepStates.get(seg.input.id)
        if (combineUi?.status === "running") hints.push(combineUi.sub?.label ?? seg.combine.label)
        if (inputUi?.status === "running") hints.push(inputUi.sub?.label ?? seg.input.label)
        continue
      }
      const moduleUi = stepStates.get(seg.module.id)
      if (moduleUi?.status === "running") hints.push(moduleUi.sub?.label ?? seg.module.label)
    }
    return hints
  }, [stepStates, modules])

  const waitPhrase = useCyclingWaitPhrase(phase === "running", runningHints)
  const runErr = useMemo(() => (run ? pipelineRunError(run) : null), [run])
  const runButtonBusy = phase === "running" || validatingInputs || probingCache
  const runButtonLabel =
    phase === "running"
      ? `${waitPhrase}…`
      : validatingInputs
        ? "Validating inputs…"
        : probingCache
          ? "Checking for cached run…"
          : configAlreadyCompleted
            ? "View cached run in Logging"
            : "Run pipeline"

  return {
    inputDocs,
    inputIssues,
    validatingInputs,
    probingCache,
    pickerModuleId,
    setPickerModuleId,
    pickerModule,
    inputModules,
    allInputsReady,
    inputsInvalid,
    inputIssueByModule,
    phase,
    stepStates,
    run,
    cachedRunId,
    wasDeduped,
    dbFingerprint,
    error,
    debugLogs,
    runNotes,
    setRunNotes,
    logEndRef,
    configAlreadyCompleted,
    loggingRunId,
    runErr,
    runButtonBusy,
    runButtonLabel,
    progressPct,
    waitPhrase,
    setInputDocForModule,
    useSamples,
    start,
    reset,
  }
}
