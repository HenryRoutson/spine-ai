"use client"

import { useMemo } from "react"
import { API_ROUTES } from "@/lib/api-routes"
import { useSharedRunDocScope } from "@/lib/shared-run-doc-scope"
import { sharedRunDocFileUrl } from "@/lib/shared-run-doc-cache"

export type SharedRunDocFetchOpts = {
  linkId: string
  sessionId?: string
}

// AI : route doc preview/file fetches through shared-link public APIs when on /run/[id] or logging shared runs.
export function useDocFetchScope() {
  const scope = useSharedRunDocScope()
  const docTextOpts = useMemo(
    () => (scope ? ({ linkId: scope.linkId, sessionId: scope.sessionId } as const) : undefined),
    [scope],
  )
  const docFileUrl = useMemo(
    () => (docId: string) =>
      scope ? sharedRunDocFileUrl(scope.linkId, docId, scope.sessionId) : API_ROUTES.docFile(docId),
    [scope],
  )
  return { linkId: scope?.linkId ?? null, docTextOpts, docFileUrl }
}
