"use client"

// AI : shared-link inference — mirrors useInferenceRun but uploads docs instead of the store picker.
import { useCallback, useMemo, useRef, useState } from "react"
import {
  docsForInputModule,
  moduleInputReady,
  orderedInputModules,
  type InputDocsAssignment,
} from "@/lib/inference-input"
import { segmentPipeline } from "@/lib/pipeline-layout"
import { formatRunErrorForDisplay, pipelineRunError } from "@/lib/run-errors"
import { useCyclingWaitPhrase } from "@/lib/inference-wait-phrases"
import { mergeStepStates, type StepUiState } from "@/lib/run-engine"
import { modelName } from "@/lib/validity"
import type { DocId, DocRef, ModuleId, PipelineModule, PipelineRun, RunJobId } from "@/lib/types"
import type { SharedLinkPublicView } from "@/lib/shared-link-types"
import type { ClientStepSpec } from "@/lib/run-types"
import {
  awaitSharedRun,
  startSharedRun,
  uploadSharedDoc,
} from "@/lib/shared-run-client"

export type SharedInferencePhase = "idle" | "running" | "done"

export function useSharedInferenceRun(link: SharedLinkPublicView, linkId: string) {
  const modules = link.modules
  const inputModules = useMemo(() => orderedInputModules(modules), [modules])
  const [inputDocs, setInputDocs] = useState<InputDocsAssignment>({})
  const [uploadingModule, setUploadingModule] = useState<ModuleId | null>(null)
  const [viewerName, setViewerName] = useState("")
  const [phase, setPhase] = useState<SharedInferencePhase>("idle")
  const [stepStates, setStepStates] = useState<Map<ModuleId, StepUiState>>(new Map())
  const [run, setRun] = useState<PipelineRun | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingHumanReview, setPendingHumanReview] = useState<ClientStepSpec | null>(null)
  const [jobId, setJobId] = useState<RunJobId | null>(null)
  const [progressToken, setProgressToken] = useState<string | null>(null)
  const humanReviewResolveRef = useRef<((decision: "approved" | "rejected") => void) | null>(null)
  const activeJobGenRef = useRef(0)

  const defaultForModule = useCallback(
    (moduleId: ModuleId) => link.defaultDocs.find((d) => d.moduleId === moduleId)?.filename,
    [link.defaultDocs],
  )

  const moduleReady = useCallback(
    (m: PipelineModule) => {
      const docs = docsForInputModule(inputDocs, m.id)
      if (moduleInputReady(m, { [m.id]: docs } as InputDocsAssignment)) return true
      return !!link.defaultDocs.find((d) => d.moduleId === m.id)
    },
    [inputDocs, link.defaultDocs],
  )

  const allInputsReady = inputModules.every(moduleReady)

  const handleUpload = useCallback(
    async (moduleId: ModuleId, file: File) => {
      setUploadingModule(moduleId)
      try {
        const doc = await uploadSharedDoc(linkId, moduleId, file)
        setInputDocs((prev) => {
          const cur = docsForInputModule(prev, moduleId)
          const multi = inputModules.find((m) => m.id === moduleId)?.inputMinCount ?? 1
          const next = multi > 1 ? [...cur, doc] : [doc]
          return { ...prev, [moduleId]: next }
        })
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setUploadingModule(null)
      }
    },
    [linkId, inputModules],
  )

  const removeInputDocForModule = useCallback((moduleId: ModuleId, docId: DocId) => {
    setInputDocs((prev) => {
      const cur = docsForInputModule(prev, moduleId)
      const next = cur.filter((d) => d.id !== docId)
      if (!next.length) {
        const copy = { ...prev }
        delete copy[moduleId]
        return copy
      }
      return { ...prev, [moduleId]: next }
    })
  }, [])

  function reset() {
    activeJobGenRef.current++
    setPhase("idle")
    setStepStates(new Map())
    setRun(null)
    setError(null)
    setPendingHumanReview(null)
    humanReviewResolveRef.current = null
    setJobId(null)
    setProgressToken(null)
  }

  async function start() {
    if (!allInputsReady) return
    if (link.viewerNameRequired && !viewerName.trim()) {
      setError("Please enter your name")
      return
    }
    if (link.fundingMode === "viewer_signs_in") {
      window.location.href = `/login?next=${encodeURIComponent(`/run/${linkId}`)}`
      return
    }
    const jobGen = ++activeJobGenRef.current
    setPhase("running")
    setError(null)
    setRun(null)
    setStepStates(new Map())
    try {
      const byModule: Partial<Record<ModuleId, DocId[]>> = {}
      for (const m of inputModules) {
        const docs = docsForInputModule(inputDocs, m.id)
        if (docs.length) byModule[m.id] = docs.map((d) => d.id)
      }
      const { jobId: jid, progressToken: tok } = await startSharedRun(
        linkId,
        byModule,
        viewerName.trim() || undefined,
      )
      if (jobGen !== activeJobGenRef.current) return
      setJobId(jid)
      setProgressToken(tok)
      const finished = await awaitSharedRun(
        linkId,
        jid,
        tok,
        {
          onStep: (steps) => {
            if (jobGen !== activeJobGenRef.current) return
            setStepStates((prev) => mergeStepStates(prev, steps))
          },
          onHumanReview: (spec) => {
            if (jobGen !== activeJobGenRef.current) return Promise.resolve("rejected" as const)
            setPendingHumanReview(spec)
            return new Promise<"approved" | "rejected">((resolve) => {
              humanReviewResolveRef.current = resolve
            })
          },
        },
      )
      if (jobGen !== activeJobGenRef.current) return
      setRun(finished)
      const runErr = pipelineRunError(finished)
      if (runErr) setError(runErr)
      setPhase("done")
    } catch (e) {
      if (jobGen !== activeJobGenRef.current) return
      setError((e as Error).message)
      setPhase("idle")
    }
  }

  function resolveHumanReview(decision: "approved" | "rejected") {
    humanReviewResolveRef.current?.(decision)
    humanReviewResolveRef.current = null
    setPendingHumanReview(null)
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
  const runErrorDisplay = useMemo(() => (run ? formatRunErrorForDisplay(run) : null), [run])
  const runButtonBusy = phase === "running" && !pendingHumanReview
  const runButtonLabel =
    pendingHumanReview != null
      ? "Waiting for your review…"
      : phase === "running"
        ? `${waitPhrase}…`
        : "Run pipeline"

  const outputSteps = useMemo(
    () => run?.steps.filter((s) => s.outputJson || s.outputPreview.trim()) ?? [],
    [run],
  )

  const outModelFor = useCallback(
    (m: PipelineModule) => modelName(link.models, m.outStructureId),
    [link.models],
  )

  return {
    modules,
    inputModules,
    inputDocs,
    uploadingModule,
    viewerName,
    setViewerName,
    defaultForModule,
    handleUpload,
    removeInputDocForModule,
    allInputsReady,
    phase,
    stepStates,
    run,
    error,
    pendingHumanReview,
    resolveHumanReview,
    jobId,
    progressToken,
    progressPct,
    waitPhrase,
    runErr,
    runErrorDisplay,
    runButtonBusy,
    runButtonLabel,
    outputSteps,
    outModelFor,
    start,
    reset,
  }
}
