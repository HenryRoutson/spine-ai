"use client"

import { useEffect, useState } from "react"
import { MarkdownView } from "@/components/highlight"
import { fetchSharedLink, uploadSharedDoc } from "@/lib/shared-run-client"
import { cacheUploadFileText, fetchSharedRunDocText } from "@/lib/shared-run-doc-cache"
import { dispatchHostedSiteDocsUploaded } from "@/lib/hosted-site-docs-events"
import { uploadFieldsFromPipeline, type upload_field_spec } from "@/lib/hosted-site-upload-ui"
import type { DocRef, ModuleId } from "@/lib/types"

type uploaded_doc = DocRef & { moduleId: ModuleId }

export function HostedSiteDocsUpload({
  linkId,
  viewerMarkdown = "",
}: {
  linkId: string
  viewerMarkdown?: string
}) {
  const [fields, setFields] = useState<upload_field_spec[]>([])
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState("")
  const [uploaded, setUploaded] = useState<uploaded_doc[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchSharedLink(linkId)
      .then((link) => {
        if (cancelled) return
        setFields(uploadFieldsFromPipeline(link.modules))
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message)
      })
    return () => {
      cancelled = true
    }
  }, [linkId])

  async function onFiles(field: upload_field_spec, files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    setError(null)
    setStatus("Uploading…")
    try {
      const next: uploaded_doc[] = []
      for (const file of Array.from(files)) {
        const doc = await uploadSharedDoc(linkId, field.moduleId, file)
        void cacheUploadFileText(linkId, doc.id, file)
        void fetchSharedRunDocText(linkId, doc.id).catch(() => {})
        next.push({ ...doc, moduleId: field.moduleId })
      }
      setUploaded((prev) => [...prev.filter((d) => d.moduleId !== field.moduleId), ...next])
      dispatchHostedSiteDocsUploaded({ linkId, moduleId: field.moduleId, docs: next })
      setStatus("Ready to quote — run the pipeline to link spans")
    } catch (e) {
      setError((e as Error).message)
      setStatus("")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="hs-docs-upload space-y-3 rounded-lg border border-border bg-background p-4" data-spine-id="share.site-docs-upload">
      {viewerMarkdown.trim() ? (
        <div className="text-sm">
          <MarkdownView md={viewerMarkdown} />
        </div>
      ) : null}
      <p className="text-sm font-medium">Upload files</p>
      <p className="text-xs text-muted-foreground">
        Files become documents for this site. Pipelines quote from every uploaded file when fields use tuple[text,quote].
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {!fields.length && !error ? (
        <p className="text-xs text-muted-foreground">No file inputs on the bound pipeline.</p>
      ) : (
        fields.map((f) => (
          <label key={f.moduleId} className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{f.label}</span>
            <span className="text-xs text-muted-foreground">{f.inputTypes}</span>
            <input
              type="file"
              accept={f.accept}
              multiple={f.multiple}
              disabled={busy}
              onChange={(e) => void onFiles(f, e.target.files)}
            />
          </label>
        ))
      )}
      {uploaded.length ? (
        <ul className="font-mono text-xs text-muted-foreground">
          {uploaded.map((d) => (
            <li key={d.id}>{d.name}</li>
          ))}
        </ul>
      ) : null}
      {status ? <p className="font-mono text-xs text-chart-2">{status}</p> : null}
    </div>
  )
}

export function HostedSiteDocsUploadPreview() {
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
      File upload — visitors add documents the pipeline can quote from.
    </div>
  )
}
