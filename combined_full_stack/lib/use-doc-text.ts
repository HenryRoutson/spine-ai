"use client"

import { useEffect, useState } from "react"
import { docTextContent, fetchDocText } from "@/lib/doc-text-cache"
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
    fetchDocText(docId)
      .then((data) => {
        if (!cancelled) setContent(docTextContent(data))
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
