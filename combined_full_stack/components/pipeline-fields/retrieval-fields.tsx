"use client"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PipelineField, StaticValue } from "@/components/pipeline-fields/shared"
import type { PipelineModule } from "@/lib/types"

type RetrievalModuleFieldsProps = {
  selected: PipelineModule
  edit: boolean
  onUpdate?: (patch: Partial<PipelineModule>) => void
}

export function RetrievalModuleFields({ selected, edit, onUpdate }: RetrievalModuleFieldsProps) {
  return (
    <>
      <PipelineField
        label="Retrieval query"
        hint="BM25 search text — or leave blank and set Query field from upstream input"
      >
        {edit && onUpdate ? (
          <Textarea
            value={selected.retrievalQuery ?? selected.prompt ?? ""}
            onChange={(e) =>
              onUpdate({
                retrievalQuery: e.target.value,
                prompt: e.target.value,
              })
            }
            placeholder='e.g. "termination notice period" or "refund policy"'
            className="min-h-[72px] font-mono text-xs"
          />
        ) : (
          <StaticValue mono>{selected.retrievalQuery ?? selected.prompt ?? "—"}</StaticValue>
        )}
      </PipelineField>

      <PipelineField
        label="Query field (upstream)"
        hint="Optional dot path into upstream JSON when query is dynamic — e.g. question"
      >
        {edit && onUpdate ? (
          <Input
            value={selected.retrievalQueryField ?? ""}
            onChange={(e) => onUpdate({ retrievalQueryField: e.target.value || undefined })}
            placeholder="question"
            className="h-8 font-mono text-xs"
          />
        ) : selected.retrievalQueryField ? (
          <StaticValue mono>{selected.retrievalQueryField}</StaticValue>
        ) : null}
      </PipelineField>

      <PipelineField label="Top K" hint="How many chunks to mark retrieved (default 5)">
        {edit && onUpdate ? (
          <Input
            type="number"
            min={1}
            max={50}
            value={selected.retrievalTopK ?? 5}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10)
              onUpdate({ retrievalTopK: Number.isFinite(n) && n > 0 ? n : 5 })
            }}
            className="h-8 w-24 font-mono text-xs"
          />
        ) : (
          <StaticValue mono>{selected.retrievalTopK ?? 5}</StaticValue>
        )}
      </PipelineField>

      <PipelineField
        label="Chunk size"
        hint="Optional character chunk size — auto-scales from source length when unset"
      >
        {edit && onUpdate ? (
          <Input
            type="number"
            min={200}
            value={selected.retrievalChunkSize ?? ""}
            onChange={(e) => {
              const raw = e.target.value.trim()
              if (!raw) {
                onUpdate({ retrievalChunkSize: undefined })
                return
              }
              const n = Number.parseInt(raw, 10)
              onUpdate({ retrievalChunkSize: Number.isFinite(n) && n >= 200 ? n : undefined })
            }}
            placeholder="auto"
            className="h-8 w-28 font-mono text-xs"
          />
        ) : (
          <StaticValue mono>{selected.retrievalChunkSize ?? "auto"}</StaticValue>
        )}
      </PipelineField>

      <PipelineField label="Chunk overlap" hint="Optional overlap in characters — auto when unset">
        {edit && onUpdate ? (
          <Input
            type="number"
            min={0}
            value={selected.retrievalChunkOverlap ?? ""}
            onChange={(e) => {
              const raw = e.target.value.trim()
              if (!raw) {
                onUpdate({ retrievalChunkOverlap: undefined })
                return
              }
              const n = Number.parseInt(raw, 10)
              onUpdate({ retrievalChunkOverlap: Number.isFinite(n) && n >= 0 ? n : undefined })
            }}
            placeholder="auto"
            className="h-8 w-28 font-mono text-xs"
          />
        ) : (
          <StaticValue mono>{selected.retrievalChunkOverlap ?? "auto"}</StaticValue>
        )}
      </PipelineField>
    </>
  )
}
