// AI : {{docs}} uploads feed the hosted run so Link Quotes can search every visitor file.
import type { DocRef, ModuleId } from "@/lib/types"

export const HS_DOCS_UPLOADED_EVENT = "hs-docs-uploaded"

export type hs_docs_uploaded_detail = {
  linkId: string
  moduleId: ModuleId
  docs: DocRef[]
}

export function dispatchHostedSiteDocsUploaded(detail: hs_docs_uploaded_detail): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(HS_DOCS_UPLOADED_EVENT, { detail }))
}
