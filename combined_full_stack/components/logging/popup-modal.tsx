"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { JsonPreviewPanel } from "@/components/json-preview-panel"
import { InlineDocPreview } from "@/components/inline-doc-preview"
import { IoPager } from "@/components/logging/io-pager"
import { PromptText } from "@/components/highlight"
import { QuoteLinks, quotesFromJson } from "@/components/quote-links"
import { ServerLogLines } from "@/components/server-logs-panel"
import type { DocId, DocRef, JobLogEntry, StructureModel } from "@/lib/types"

export type PopupDocPreviewItem = {
  docId: DocId
  doc?: Pick<DocRef, "id" | "name" | "type">
  label?: string
}

export type PopupPayload = {
  json?: string
  text?: string
  serverLogs?: JobLogEntry[]
  docPreviews?: PopupDocPreviewItem[]
  models?: StructureModel[]
  title: string
  sourceDocId?: DocId
}

type PopupModalProps = {
  payload: PopupPayload
  onClose: () => void
}

export function PopupModal({ payload, onClose }: PopupModalProps) {
  const popupQuotes = payload.json ? quotesFromJson(payload.json) : []

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-[5vh]">
      <button
        aria-label="Close viewer"
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative flex h-[90vh] w-[90vw] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="font-mono text-xs text-muted-foreground">{payload.title}</span>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {payload.json ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {popupQuotes.length > 0 && (
              <QuoteLinks quotes={popupQuotes} className="border-b border-border px-4 py-3" />
            )}
            <JsonPreviewPanel json={payload.json} className="min-h-0 flex-1" />
          </div>
        ) : payload.serverLogs ? (
          <div className="min-h-0 flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed">
            <ServerLogLines logs={payload.serverLogs} />
          </div>
        ) : payload.docPreviews?.length ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
            {payload.docPreviews.length > 1 ? (
              <IoPager
                items={payload.docPreviews.map((item) => ({
                  label: item.label ?? item.doc?.name ?? item.docId,
                  text: item.docId,
                }))}
                renderItem={(_, index) => {
                  const item = payload.docPreviews![index]!
                  return (
                    <InlineDocPreview
                      docId={item.docId}
                      doc={item.doc}
                      models={payload.models}
                      className="flex min-h-0 flex-1 flex-col"
                      maxHeightClass="min-h-0 flex-1"
                    />
                  )
                }}
              />
            ) : (
              <InlineDocPreview
                docId={payload.docPreviews[0]!.docId}
                doc={payload.docPreviews[0]!.doc}
                models={payload.models}
                className="flex min-h-0 flex-1 flex-col"
                maxHeightClass="min-h-0 flex-1"
              />
            )}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground">
            <PromptText text={payload.text ?? ""} sourceDocId={payload.sourceDocId} />
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
