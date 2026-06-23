"use client"

import {
  inputDocIdsForModules,
  runInputDocIdsMatch,
} from "@/lib/inference-input"
import { computeRunFingerprint } from "@/lib/run-fingerprint"
import { matchRun } from "@/lib/run-engine"
import type {
  DocRef,
  ModelId,
  ModuleId,
  PipelineModule,
  PipelineRun,
  Project,
  ProjectId,
} from "@/lib/types"

export type InferenceCacheProbeHit = {
  kind: "hit"
  fingerprint: string
  run: PipelineRun
  runId: PipelineRun["id"]
  source: "session" | "local" | "server"
}

export type InferenceCacheLocalOutcome =
  | InferenceCacheProbeHit
  | { kind: "session-hint"; fingerprint: string; runId: PipelineRun["id"] }
  | { kind: "continue"; fingerprint: string }

const inferenceSessionKey = (projectId: ProjectId, probeKey: string) =>
  `inference-cache:${projectId}:${probeKey}`

export function readInferenceSessionCache(
  projectId: ProjectId,
  probeKey: string,
): PipelineRun["id"] | null {
  try {
    const id = sessionStorage.getItem(inferenceSessionKey(projectId, probeKey))
    return id ? (id as PipelineRun["id"]) : null
  } catch {
    return null
  }
}

export function writeInferenceSessionCache(
  projectId: ProjectId,
  probeKey: string,
  runId: PipelineRun["id"],
) {
  try {
    sessionStorage.setItem(inferenceSessionKey(projectId, probeKey), runId)
  } catch {
    // AI : private mode / quota — session hint is optional.
  }
}

function findLocalCachedRunByFingerprint(
  runs: PipelineRun[],
  fingerprint: string,
): PipelineRun | undefined {
  return runs.find((r) => r.status === "ok" && r.fingerprint === fingerprint)
}

export async function probeLocalInferenceCache(args: {
  projectId: ProjectId
  probeKey: string
  project: Project
  model: ModelId
  docs: DocRef[]
  runs: PipelineRun[]
  inputModules: PipelineModule[]
  inputDocs: Partial<Record<ModuleId, DocRef>>
}): Promise<InferenceCacheLocalOutcome> {
  const { projectId, probeKey, project, model, docs, runs, inputModules, inputDocs } = args
  const orderedIds = inputDocIdsForModules(inputModules, inputDocs)
  const fingerprint = await computeRunFingerprint(project, model, orderedIds)

  const sessionRunId = readInferenceSessionCache(projectId, probeKey)
  const sessionRun =
    sessionRunId != null ? runs.find((r) => r.id === sessionRunId && r.status === "ok") : undefined

  if (sessionRunId && !sessionRun) {
    return { kind: "session-hint", fingerprint, runId: sessionRunId }
  }

  if (
    sessionRun &&
    sessionRun.fingerprint === fingerprint &&
    runInputDocIdsMatch(docs, project, sessionRun, orderedIds)
  ) {
    return { kind: "hit", fingerprint, run: sessionRun, runId: sessionRun.id, source: "session" }
  }

  const local = findLocalCachedRunByFingerprint(runs, fingerprint)
  if (local) {
    return { kind: "hit", fingerprint, run: local, runId: local.id, source: "local" }
  }

  return { kind: "continue", fingerprint }
}

export async function probeServerInferenceCache(args: {
  projectId: ProjectId
  project: Project
  model: ModelId
  inputModules: PipelineModule[]
  inputDocs: Partial<Record<ModuleId, DocRef>>
  fingerprint: string
}): Promise<InferenceCacheProbeHit | { kind: "miss"; fingerprint: string }> {
  const { projectId, project, model, inputModules, inputDocs, fingerprint } = args
  const orderedIds = inputDocIdsForModules(inputModules, inputDocs)
  const [primary, ...rest] = orderedIds

  const { fingerprint: serverFp, cachedRunId: matchedId, run: matchedRun } = await matchRun(
    projectId,
    primary,
    model,
    rest,
  )
  if (matchedId && matchedRun?.status === "ok" && serverFp === fingerprint) {
    return { kind: "hit", fingerprint: serverFp, run: matchedRun, runId: matchedId, source: "server" }
  }
  return { kind: "miss", fingerprint: serverFp }
}
