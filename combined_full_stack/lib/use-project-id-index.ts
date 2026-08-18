"use client"
// AI : fetch project JSON/excel docs and build the typed id catalog for the inspector.

import { useEffect, useMemo, useState } from "react"
import { catalogFromDocs, type Catalog, type CatalogDocInput } from "@/lib/sql-catalog"
import { buildIdIndex, type IdIndex } from "@/lib/sql-id-index"
import { docsForProject } from "@/lib/project-docs"
import { isTabularDocType } from "@/lib/doc-structure-infer"
import { docTextContent, fetchDocText } from "@/lib/doc-text-cache"
import { useStore } from "@/lib/store"
import type { InputType } from "@/lib/types"

export function useProjectIdIndex(): { catalog: Catalog; index: IdIndex; loading: boolean } {
  const { models, typeAliases, docs, project } = useStore()
  const projectDocs = useMemo(() => (project ? docsForProject(docs, project) : []), [docs, project])
  const tabular = useMemo(
    () => projectDocs.filter((d) => isTabularDocType(d.type, d.name)),
    [projectDocs],
  )
  const [loaded, setLoaded] = useState<CatalogDocInput[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!tabular.length) {
      setLoaded([])
      return
    }
    setLoading(true)
    void Promise.all(
      tabular.map(async (doc) => {
        try {
          const data = await fetchDocText(doc.id)
          return {
            name: doc.name,
            type: doc.type as InputType,
            content: docTextContent(data),
            id: doc.id,
          } satisfies CatalogDocInput
        } catch {
          return undefined
        }
      }),
    ).then((rows) => {
      if (cancelled) return
      setLoaded(rows.filter((r): r is CatalogDocInput => !!r && !!r.content.trim()))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [tabular])

  const catalog = useMemo(
    () => catalogFromDocs(loaded, models, typeAliases),
    [loaded, models, typeAliases],
  )
  const index = useMemo(() => buildIdIndex(catalog, models), [catalog, models])
  return { catalog, index, loading }
}
