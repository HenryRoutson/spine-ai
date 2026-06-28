"use client"

import { useEffect, useRef } from "react"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson } from "@/lib/api-client"
import { docsForProject } from "@/lib/project-docs"
import { mergeInferredStructuresForDoc, modelsChanged } from "@/lib/sync-doc-structures"
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
          const data = await apiJson<{ text?: string; content?: string }>(API_ROUTES.docText(doc.id))
          const content = data.text ?? data.content ?? ""
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
