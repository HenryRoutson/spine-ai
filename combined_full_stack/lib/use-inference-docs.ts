"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  docsForInputModule,
  buildDefaultInputDocs,
  isMultiDocInputModule,
  orderedInputModules,
  resolveInputDocs,
  moduleInputReady,
  type InputDocsAssignment,
} from "@/lib/inference-input"
import {
  collectInferenceInputIssues,
  inferenceDocNeedsFullContent,
  type InferenceInputIssue,
} from "@/lib/inference-validity"
import { docTextContent, fetchDocText } from "@/lib/doc-text-cache"
import type { DocId, DocRef, ModuleId, PipelineModule, Project, ProjectId } from "@/lib/types"

function inputDocsIdsKey(assignment: InputDocsAssignment, inputModules: PipelineModule[]): string {
  return inputModules
    .map((m) => docsForInputModule(assignment, m.id).map((d) => d.id).join("+"))
    .join(",")
}

function inferenceIssuesEqual(a: InferenceInputIssue[], b: InferenceInputIssue[]): boolean {
  if (a.length !== b.length) return false
  return a.every(
    (issue, i) =>
      issue.moduleId === b[i]?.moduleId &&
      issue.docName === b[i]?.docName &&
      issue.message === b[i]?.message,
  )
}

type UseInferenceDocsArgs = {
  project: Project
  modules: PipelineModule[]
  docs: DocRef[]
  inferenceInputDocIds: Partial<Record<ModuleId, DocId | DocId[]>>
  setInferenceInputDocIds: (docs: Partial<Record<ModuleId, DocId | DocId[]>>) => void
  onProjectSwitch?: () => void
}

export function useInferenceDocs({
  project,
  modules,
  docs,
  inferenceInputDocIds,
  setInferenceInputDocIds,
  onProjectSwitch,
}: UseInferenceDocsArgs) {
  const [inputDocs, setInputDocs] = useState<InputDocsAssignment>({})
  const [inputIssues, setInputIssues] = useState<InferenceInputIssue[]>([])
  const [pickerModuleId, setPickerModuleId] = useState<ModuleId | null>(null)
  const prevProjectIdRef = useRef<ProjectId | null>(null)

  const inputModules = useMemo(() => orderedInputModules(modules), [modules])
  const pickerModule = pickerModuleId ? inputModules.find((m) => m.id === pickerModuleId) : undefined
  const allInputsReady = inputModules.every((m) => moduleInputReady(m, inputDocs))
  const inputsInvalid = inputIssues.length > 0
  const inputIssueByModule = useMemo(
    () => new Map(inputIssues.map((issue) => [issue.moduleId, issue])),
    [inputIssues],
  )

  const inputDocIdsKey = inputDocsIdsKey(inputDocs, inputModules)

  useEffect(() => {
    if (!allInputsReady) {
      setInputIssues((prev) => (prev.length === 0 ? prev : []))
      return
    }
    let cancelled = false
    ;(async () => {
      const contentByDocId: Record<string, string> = {}
      const loads: Promise<void>[] = []
      for (const m of inputModules) {
        for (const doc of docsForInputModule(inputDocs, m.id)) {
          if (!inferenceDocNeedsFullContent(m, doc)) continue
          loads.push(
            fetchDocText(doc.id).then((data) => {
              contentByDocId[doc.id] = docTextContent(data)
            }),
          )
        }
      }
      await Promise.all(loads)
      if (cancelled) return
      const next = collectInferenceInputIssues(inputModules, {}, contentByDocId, inputDocs)
      setInputIssues((prev) => (inferenceIssuesEqual(prev, next) ? prev : next))
    })().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [allInputsReady, inputModules, inputDocIdsKey, inputDocs])

  useEffect(() => {
    if (!allInputsReady) return
    const ids = Object.fromEntries(
      inputModules
        .filter((m) => moduleInputReady(m, inputDocs))
        .map((m) => {
          const moduleDocs = docsForInputModule(inputDocs, m.id)
          const docIds = moduleDocs.map((d) => d.id as DocId)
          return [m.id, isMultiDocInputModule(m) ? docIds : docIds[0]!] as const
        }),
    ) as Partial<Record<ModuleId, DocId | DocId[]>>
    const unchanged = inputModules.every((m) => {
      const saved = inferenceInputDocIds[m.id]
      const moduleDocIds = docsForInputModule(inputDocs, m.id).map((d) => d.id)
      if (Array.isArray(saved)) return saved.length === moduleDocIds.length && saved.every((id, i) => id === moduleDocIds[i])
      return saved === moduleDocIds[0]
    })
    if (unchanged) return
    setInferenceInputDocIds(ids)
  }, [inputDocIdsKey, allInputsReady, inferenceInputDocIds, setInferenceInputDocIds, inputModules, inputDocs])

  useEffect(() => {
    const switched = prevProjectIdRef.current != null && prevProjectIdRef.current !== project.id
    prevProjectIdRef.current = project.id as ProjectId
    setInputDocs((prev) => {
      const next = resolveInputDocs(docs, project, inputModules, inferenceInputDocIds)
      if (!switched && inputDocsIdsKey(prev, inputModules) === inputDocsIdsKey(next, inputModules)) {
        return prev
      }
      return next
    })
    if (switched) {
      setInputIssues([])
      setPickerModuleId(null)
      onProjectSwitch?.()
    }
  }, [project.id, docs, inputModules, inferenceInputDocIds, project, onProjectSwitch])

  function setInputDocForModule(moduleId: ModuleId, doc: DocRef) {
    const mod = inputModules.find((m) => m.id === moduleId)
    setInputDocs((prev) => {
      if (mod && isMultiDocInputModule(mod)) {
        const current = docsForInputModule(prev, moduleId)
        const next = current.some((d) => d.id === doc.id) ? current : [...current, doc]
        return { ...prev, [moduleId]: next }
      }
      return { ...prev, [moduleId]: doc }
    })
    setPickerModuleId(null)
  }

  function removeInputDocForModule(moduleId: ModuleId, docId: DocId) {
    setInputDocs((prev) => {
      const mod = inputModules.find((m) => m.id === moduleId)
      if (!mod || !isMultiDocInputModule(mod)) {
        const next = { ...prev }
        delete next[moduleId]
        return next
      }
      const filtered = docsForInputModule(prev, moduleId).filter((d) => d.id !== docId)
      if (!filtered.length) {
        const next = { ...prev }
        delete next[moduleId]
        return next
      }
      return { ...prev, [moduleId]: filtered }
    })
  }

  function useSamples() {
    setInputDocs(buildDefaultInputDocs(docs, project, inputModules))
  }

  // AI : one-click "pre-selected run" — replace the whole slot assignment (presets pick exact doc sets).
  function applyInputAssignment(assignment: InputDocsAssignment) {
    setInputDocs(assignment)
    setPickerModuleId(null)
  }

  return {
    inputDocs,
    inputDocIdsKey,
    inputIssues,
    pickerModuleId,
    setPickerModuleId,
    pickerModule,
    inputModules,
    allInputsReady,
    inputsInvalid,
    inputIssueByModule,
    setInputDocForModule,
    removeInputDocForModule,
    useSamples,
    applyInputAssignment,
  }
}
