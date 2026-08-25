"use client"

// AI : shared-link inference — mirrors useInferenceRun but uploads docs instead of the store picker.
import { useCallback, useMemo, useRef, useState } from "react"
import {
  docsForInputModule,
  isMultiDocInputModule,
  moduleInputReady,
  orderedInputModules,
  type InputDocsAssignment,
} from "@/lib/inference-input"
import { useRunProgressUi } from "@/lib/use-run-progress-ui"
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
import { sharedLinkPublicPath } from "@/lib/hosted-site"
import { cacheUploadFileText, fetchSharedRunDocText } from "@/lib/shared-run-doc-cache"
import { pipelineFinalOutputSteps } from "@/lib/step-doc"
import { buildChatbotResult } from "@/lib/chatbot-step"

import { RunPhase } from "@/lib/run-phase"

export { RunPhase as SharedInferencePhase } from "@/lib/run-phase"

type SharedRunAuth = {
  isAuthenticated: boolean
  onAuthRequired?: () => void
}

import { sharedLinkRequiresSignIn } from "@/lib/shared-link-funding"

export function useSharedInferenceRun(
  link: SharedLinkPublicView,
  linkId: string,
  auth?: SharedRunAuth,
  onRunComplete?: () => void,
  embedSessionToken?: string,
) {
  const modules = link.modules
  const inputModules = useMemo(() => orderedInputModules(modules), [modules])
  const [inputDocs, setInputDocs] = useState<InputDocsAssignment>({})
  const [uploadingModule, setUploadingModule] = useState<ModuleId | null>(null)
  const [viewerName, setViewerName] = useState("")
  const [phase, setPhase] = useState<RunPhase>(RunPhase.Idle)
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
        void cacheUploadFileText(linkId, doc.id, file)
        void fetchSharedRunDocText(linkId, doc.id).catch(() => {})
        setInputDocs((prev) => {
          const cur = docsForInputModule(prev, moduleId)
          const mod = inputModules.find((m) => m.id === moduleId)
          const next = mod && isMultiDocInputModule(mod) ? [...cur, doc] : [doc]
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
    setPhase(RunPhase.Idle)
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
    if (sharedLinkRequiresSignIn(link.fundingMode) && !auth?.isAuthenticated) {
      if (auth?.onAuthRequired) {
        auth.onAuthRequired()
        return
      }
      window.location.href = `/login?next=${encodeURIComponent(sharedLinkPublicPath(linkId))}`
      return
    }
    const jobGen = ++activeJobGenRef.current
    setPhase(RunPhase.Running)
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
        embedSessionToken,
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
          // AI : shared links — auto-exit chatbot (no turn API on public runs yet).
          onChatbot: (spec) => {
            const prompt =
              spec.input && typeof spec.input === "object" && !Array.isArray(spec.input) && typeof (spec.input as { prompt?: unknown }).prompt === "string"
                ? (spec.input as { prompt: string }).prompt
                : ""
            return Promise.resolve(buildChatbotResult(prompt, [], "exit"))
          },
        },
      )
      if (jobGen !== activeJobGenRef.current) return
      setRun(finished)
      setPhase(RunPhase.Done)
      onRunComplete?.()
    } catch (e) {
      if (jobGen !== activeJobGenRef.current) return
      setError((e as Error).message)
      setPhase(RunPhase.Idle)
    }
  }

  function resolveHumanReview(decision: "approved" | "rejected") {
    humanReviewResolveRef.current?.(decision)
    humanReviewResolveRef.current = null
    setPendingHumanReview(null)
  }

  const {
    progressPct,
    waitPhrase,
    runErr,
    runErrorDisplay,
    runButtonBusy,
    runButtonLabel,
  } = useRunProgressUi({ modules, phase, stepStates, run, pendingHumanReview })

  const outputSteps = useMemo(
    () => (run ? pipelineFinalOutputSteps(run.steps) : []),
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
