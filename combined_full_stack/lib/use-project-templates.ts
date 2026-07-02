"use client"

import { useEffect, useState } from "react"
import { apiJson } from "@/lib/api-client"
import { API_ROUTES } from "@/lib/api-routes"
import type { ProjectId } from "@/lib/types"

export type ProjectTemplateSummary = {
  id: ProjectId
  name: string
  kind: string
  moduleCount: number
  inputCount: number
}

// AI : one fetch of /api/project-templates — shared by the Projects manager and NoProjectsPage.
export function useProjectTemplates() {
  const [templates, setTemplates] = useState<ProjectTemplateSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void apiJson<{ templates: ProjectTemplateSummary[] }>(API_ROUTES.projectTemplates)
      .then((data) => {
        if (!cancelled) setTemplates(data.templates)
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { templates, loading }
}
