"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { uid } from "@/lib/id"
import { API_ROUTES } from "@/lib/api-routes"
import { JSON_HEADERS } from "@/lib/api-client"
import { defaultDiagnosisMessage } from "@/lib/diagnosis-prompt"
import { readDiagnosisStream } from "@/lib/diagnosis-stream-read"
import { runHasErrors } from "@/lib/run-error-log"
import type { DiagnosisAgentSession, DiagnosisSpawnOptions } from "@/lib/diagnosis-types"
import type { ModelId } from "@/lib/types"

type DiagnosisAgentContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  sessions: DiagnosisAgentSession[]
  activeSessionId: string | null
  setActiveSessionId: (id: string | null) => void
  spawnDiagnosis: (opts: DiagnosisSpawnOptions, model: ModelId) => string
  maybeAutoDiagnose: (opts: DiagnosisSpawnOptions, model: ModelId) => void
  totalCostCents: number
  runningCount: number
}

const DiagnosisAgentContext = createContext<DiagnosisAgentContextValue | null>(null)

export function DiagnosisAgentProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [sessions, setSessions] = useState<DiagnosisAgentSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const autoStartedRunIds = useRef(new Set<string>())
  const sessionsRef = useRef(sessions)
  sessionsRef.current = sessions

  const toggle = useCallback(() => setOpen((v) => !v), [])

  const runDiagnosis = useCallback(
    (sessionId: string, opts: DiagnosisSpawnOptions, model: ModelId) => {
      void (async () => {
        const message = opts.message?.trim() || defaultDiagnosisMessage()
        try {
          const res = await fetch(API_ROUTES.diagnosisAssistant, {
            method: "POST",
            headers: JSON_HEADERS,
            body: JSON.stringify({
              projectId: opts.projectId,
              runId: opts.run.id,
              message,
              model,
              stream: true,
            }),
          })
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            throw new Error((data as { error?: string }).error ?? `Diagnosis failed (${res.status})`)
          }
          const result = await readDiagnosisStream(res, (delta) => {
            setSessions((prev) =>
              prev.map((s) =>
                s.id === sessionId ? { ...s, responseText: s.responseText + delta } : s,
              ),
            )
          })
          setSessions((prev) =>
            prev.map((s) =>
              s.id === sessionId
                ? {
                    ...s,
                    status: "done",
                    finishedAt: Date.now(),
                    costCents: result.usageCents,
                    responseText: result.text,
                  }
                : s,
            ),
          )
        } catch (err) {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === sessionId
                ? {
                    ...s,
                    status: "error",
                    finishedAt: Date.now(),
                    errorMessage: (err as Error).message,
                  }
                : s,
            ),
          )
        }
      })()
    },
    [],
  )

  const spawnDiagnosis = useCallback(
    (opts: DiagnosisSpawnOptions, model: ModelId): string => {
      const sessionId = uid()
      const session: DiagnosisAgentSession = {
        id: sessionId,
        runId: opts.run.id,
        runLabel: opts.runLabel,
        projectId: opts.projectId,
        status: "running",
        autoStarted: opts.autoStarted ?? false,
        startedAt: Date.now(),
        costCents: 0,
        responseText: "",
        debugTrace: [],
      }
      setSessions((prev) => [session, ...prev])
      setActiveSessionId(sessionId)
      setOpen(true)
      runDiagnosis(sessionId, opts, model)
      return sessionId
    },
    [runDiagnosis],
  )

  const maybeAutoDiagnose = useCallback(
    (opts: DiagnosisSpawnOptions, model: ModelId) => {
      if (!runHasErrors(opts.run)) return
      if (autoStartedRunIds.current.has(opts.run.id)) return
      autoStartedRunIds.current.add(opts.run.id)
      spawnDiagnosis({ ...opts, autoStarted: true }, model)
    },
    [spawnDiagnosis],
  )

  const totalCostCents = useMemo(
    () => sessions.reduce((sum, s) => sum + s.costCents, 0),
    [sessions],
  )
  const runningCount = useMemo(
    () => sessions.filter((s) => s.status === "running" || s.status === "queued").length,
    [sessions],
  )

  const value = useMemo(
    () => ({
      open,
      setOpen,
      toggle,
      sessions,
      activeSessionId,
      setActiveSessionId,
      spawnDiagnosis,
      maybeAutoDiagnose,
      totalCostCents,
      runningCount,
    }),
    [
      open,
      toggle,
      sessions,
      activeSessionId,
      spawnDiagnosis,
      maybeAutoDiagnose,
      totalCostCents,
      runningCount,
    ],
  )

  return <DiagnosisAgentContext.Provider value={value}>{children}</DiagnosisAgentContext.Provider>
}

export function useDiagnosisAgents() {
  const ctx = useContext(DiagnosisAgentContext)
  if (!ctx) throw new Error("useDiagnosisAgents must be used within DiagnosisAgentProvider")
  return ctx
}

export function useOptionalDiagnosisAgents() {
  return useContext(DiagnosisAgentContext)
}
