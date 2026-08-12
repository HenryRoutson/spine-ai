"use client"

import { useEffect, useState } from "react"
import { FETCH_CREDENTIALS, formatApiError, logApiFailure, readApiErrorBody } from "@/lib/api-client"
import { API_ROUTES } from "@/lib/api-routes"
import type { ProjectId } from "@/lib/types"

export type ProjectTemplateSummary = {
  id: ProjectId
  name: string
  kind: string
  moduleCount: number
  inputCount: number
}

const TEMPLATE_EVENT = "template"
const ERROR_EVENT = "error"

// AI : NDJSON stream from /api/project-templates — templates appear as each seed file is parsed.
export function useProjectTemplates() {
  const [templates, setTemplates] = useState<ProjectTemplateSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const ac = new AbortController()

    void (async () => {
      try {
        const res = await fetch(API_ROUTES.projectTemplates, {
          credentials: FETCH_CREDENTIALS,
          signal: ac.signal,
        })
        if (!res.ok) {
          const body = await readApiErrorBody(res)
          logApiFailure(API_ROUTES.projectTemplates, res, body, "GET")
          throw new Error(formatApiError(`GET ${API_ROUTES.projectTemplates}`, res, body))
        }
        const reader = res.body?.getReader()
        if (!reader) throw new Error("Template stream unavailable")

        const decoder = new TextDecoder()
        let buffer = ""
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""
          for (const line of lines) {
            if (!line.trim()) continue
            const evt = JSON.parse(line) as {
              type: string
              template?: ProjectTemplateSummary
              error?: string
            }
            if (evt.type === TEMPLATE_EVENT && evt.template) {
              if (!cancelled) {
                setTemplates((prev) => [...prev, evt.template!])
              }
            }
            if (evt.type === ERROR_EVENT) {
              throw new Error(typeof evt.error === "string" ? evt.error : "Template stream failed")
            }
          }
        }
      } catch (err) {
        if (!cancelled && !(err instanceof DOMException && err.name === "AbortError")) {
          console.error(err)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      ac.abort()
    }
  }, [])

  return { templates, loading }
}
