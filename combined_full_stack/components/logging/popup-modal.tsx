"use client"

import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { JsonPreviewPanel } from "@/components/json-preview-panel"
import { PromptText } from "@/components/highlight"
import { QuoteLinks, quotesFromJson } from "@/components/quote-links"
import { ServerLogLines } from "@/components/server-logs-panel"
import type { DocId, JobLogEntry } from "@/lib/types"

export type PopupPayload = {
  json?: string
  text?: string
  serverLogs?: JobLogEntry[]
  title: string
  sourceDocId?: DocId
}

type PopupModalProps = {
  payload: PopupPayload
  onClose: () => void
}

export function PopupModal({ payload, onClose }: PopupModalProps) {
  const popupQuotes = payload.json ? quotesFromJson(payload.json) : []

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col">
      <button
        aria-label="Close viewer"
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative m-6 flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
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
