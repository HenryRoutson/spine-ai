"use client"

import { useEffect, useRef } from "react"
import { docsForProject } from "@/lib/project-docs"
import { docTextContent, fetchDocText } from "@/lib/doc-text-cache"
import { mergeInferredStructuresForDoc, modelsChanged } from "@/lib/sync-doc-structures"
import { dedupeInferredModelsByShape } from "@/lib/structure-shape"
import { repairOrphanModelRefs } from "@/lib/structure-ref"
import { useStore, uid } from "@/lib/store"
import type { StructureModelId } from "@/lib/types"

// AI : on project load / new uploads — fetch each doc's stored text and merge inferred structures.
export function useSyncProjectDocStructures() {
  const { docs, project, models, setModels, projectLoading } = useStore()
  const syncedRef = useRef(new Set<string>())
  const modelsRef = useRef(models)
  modelsRef.current = models

  useEffect(() => {
    syncedRef.current = new Set()
  }, [project.id])

  // AI : collapse legacy per-doc duplicates (HomeworkStudentAlexRow, …) into numbered Structure N.
  useEffect(() => {
    if (projectLoading) return
    const deduped = repairOrphanModelRefs(
      dedupeInferredModelsByShape(modelsRef.current),
      () => uid<StructureModelId>(),
    )
    if (modelsChanged(modelsRef.current, deduped)) setModels(deduped)
  }, [project.id, projectLoading, setModels])

  useEffect(() => {
    if (projectLoading) return

    const projectDocs = docsForProject(docs, project)
    const pending = projectDocs.filter((d) => !syncedRef.current.has(d.id))
    if (!pending.length) return

    let cancelled = false

    ;(async () => {
      let next = modelsRef.current

      for (const doc of pending) {
        try {
          const data = await fetchDocText(doc.id)
          const content = docTextContent(data)
          const merged = mergeInferredStructuresForDoc(
            next,
            doc,
            content,
            () => uid<StructureModelId>(),
          )
          if (modelsChanged(next, merged)) next = merged
          syncedRef.current.add(doc.id)
        } catch {
          // AI : leave unsynced so a later docs/project change can retry
        }
        if (cancelled) return
      }

      if (!cancelled && modelsChanged(modelsRef.current, next)) {
        setModels(next)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [docs, project.id, project.seedDocNames, projectLoading, setModels])
}
