"use client"

import { useMemo } from "react"
import { API_ROUTES } from "@/lib/api-routes"
import { useSharedRunDocScope } from "@/lib/shared-run-doc-scope"
import { sharedRunDocFileUrl } from "@/lib/shared-run-doc-cache"

// AI : route doc preview/file fetches through shared-link public APIs when on /run/[id].
export function useDocFetchScope() {
  const linkId = useSharedRunDocScope()
  const docTextOpts = useMemo(() => (linkId ? ({ linkId } as const) : undefined), [linkId])
  const docFileUrl = useMemo(
    () => (docId: string) => (linkId ? sharedRunDocFileUrl(linkId, docId) : API_ROUTES.docFile(docId)),
    [linkId],
  )
  return { linkId, docTextOpts, docFileUrl }
}
