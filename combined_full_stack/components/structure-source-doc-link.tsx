"use client"

import { OpenInDocumentsLink } from "@/components/open-in-documents"
import type { DocId } from "@/lib/types"

// AI : structure tab — link back to the source document a derived model came from.
export function StructureSourceDocLink({
  sourceDocId,
  className,
}: {
  sourceDocId?: DocId
  className?: string
}) {
  if (!sourceDocId) return null
  return <OpenInDocumentsLink docId={sourceDocId} variant="source" className={className} stopPropagation={false} />
}
