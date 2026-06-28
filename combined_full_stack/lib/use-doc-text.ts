"use client"

import { useEffect, useState } from "react"
import { API_ROUTES } from "@/lib/api-routes"
import type { DocId } from "@/lib/types"

export function useDocText(docId: DocId | null | undefined) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!docId)

  useEffect(() => {
    if (!docId) {
      setContent(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(API_ROUTES.docText(docId))
      .then((r) => r.json())
      .then((d: { content?: string; text?: string }) => {
        if (!cancelled) setContent(d.text ?? d.content ?? "")
      })
      .catch(() => {
        if (!cancelled) setContent("")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [docId])

  return { content, loading }
}
