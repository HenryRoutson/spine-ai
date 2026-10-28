"use client"
// AI : SUPERSEDED (n8n-sidecar-S4-ui) — live Slack/Gmail is Connect, not a live mode on this form.
// AI :   Keep auto form for catalog pieces; do not list 400 n8n Cloud nodes here (see n8n-roadmap.ts).

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { PipelineField, StaticValue } from "@/components/pipeline-fields/shared"
import { InvalidKind, type InvalidStep } from "@/lib/validity"
import {
  DEFAULT_N8N_TIMEOUT_MS,
  getN8nNode,
  listN8nNodes,
  piecePropDefaults,
  type PieceProp,
} from "@/lib/n8n-catalog"
import type { PipelineModule } from "@/lib/types"

type N8nModuleFieldsProps = {
  selected: PipelineModule
  edit: boolean
  invalid?: InvalidStep
  onUpdate?: (patch: Partial<PipelineModule>) => void
}

function paramValue(selected: PipelineModule, prop: PieceProp): unknown {
  const params = selected.n8nParameters ?? {}
  if (params[prop.name] !== undefined) return params[prop.name]
  return prop.default
}

function setParam(selected: PipelineModule, name: string, value: unknown, onUpdate?: (patch: Partial<PipelineModule>) => void) {
  onUpdate?.({
    n8nParameters: { ...(selected.n8nParameters ?? {}), [name]: value },
  })
}

function AutoPieceProp({
  selected,
  prop,
  edit,
  onUpdate,
}: {
  selected: PipelineModule
  prop: PieceProp
  edit: boolean
  onUpdate?: (patch: Partial<PipelineModule>) => void
}) {
  const value = paramValue(selected, prop)
  if (!edit) {
    const shown = typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")
    return (
      <PipelineField label={prop.displayName} hint={prop.description}>
        <StaticValue mono>{shown}</StaticValue>
      </PipelineField>
    )
  }
  if (prop.type === "boolean") {
    return (
      <PipelineField label={prop.displayName} hint={prop.description}>
        <div className="flex items-center gap-2.5">
          <Switch
            checked={Boolean(value)}
            onCheckedChange={(checked) => setParam(selected, prop.name, checked, onUpdate)}
          />
          <span className="font-mono text-[10px] text-muted-foreground">{value ? "On" : "Off"}</span>
        </div>
      </PipelineField>
    )
  }
  if (prop.type === "select") {
    return (
      <PipelineField label={prop.displayName} hint={prop.description}>
        <select
          value={String(value ?? "")}
          onChange={(e) => setParam(selected, prop.name, e.target.value, onUpdate)}
          className="h-8 w-full rounded-md border border-input bg-background px-2 font-mono text-xs"
        >
          {(prop.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </PipelineField>
    )
  }
  if (prop.type === "number") {
    return (
      <PipelineField label={prop.displayName} hint={prop.description}>
        <Input
          type="number"
          value={typeof value === "number" ? value : Number(value ?? 0)}
          onChange={(e) => setParam(selected, prop.name, Number(e.target.value), onUpdate)}
          className="h-8 font-mono text-xs"
        />
      </PipelineField>
    )
  }
  if (prop.type === "json") {
    const text = typeof value === "string" ? value : JSON.stringify(value ?? {}, null, 2)
    return (
      <PipelineField label={prop.displayName} hint={prop.description}>
        <Textarea
          value={text}
          onChange={(e) => {
            const raw = e.target.value
            try {
              setParam(selected, prop.name, JSON.parse(raw) as unknown, onUpdate)
            } catch {
              setParam(selected, prop.name, raw, onUpdate)
            }
          }}
          className="min-h-[5rem] font-mono text-xs"
        />
      </PipelineField>
    )
  }
  return (
    <PipelineField label={prop.displayName} hint={prop.description}>
      <Input
        value={String(value ?? "")}
        onChange={(e) => setParam(selected, prop.name, e.target.value, onUpdate)}
        className="h-8 font-mono text-xs"
      />
    </PipelineField>
  )
}

export function N8nModuleFields({ selected, edit, invalid, onUpdate }: N8nModuleFieldsProps) {
  const nodes = listN8nNodes()
  const entry = getN8nNode(selected.n8nNodeType)
  const missingType = invalid?.kind === InvalidKind.MissingN8nNodeType

  function pickNode(type: string) {
    const next = getN8nNode(type)
    onUpdate?.({
      n8nNodeType: type || undefined,
      n8nParameters: next ? piecePropDefaults(next) : {},
      n8nCode: undefined,
    })
  }

  return (
    <>
      <PipelineField
        label="Piece"
        hint="Typed catalog — local n8n-style code, not a live Slack/Gmail call. Share the JSON from list_pieces / export_piece."
        hintTone={missingType ? "error" : undefined}
      >
        {edit ? (
          <select
            value={selected.n8nNodeType ?? ""}
            onChange={(e) => pickNode(e.target.value)}
            className="h-8 w-full rounded-md border border-input bg-background px-2 font-mono text-xs"
          >
            <option value="">Select a piece…</option>
            {nodes.map((n) => (
              <option key={n.n8nNodeType} value={n.n8nNodeType}>
                {n.displayName} ({n.category})
              </option>
            ))}
          </select>
        ) : (
          <StaticValue mono>{entry?.displayName ?? selected.n8nNodeType ?? "—"}</StaticValue>
        )}
      </PipelineField>

      {entry?.description ? (
        <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">{entry.description}</p>
      ) : null}

      {(entry?.props ?? []).map((prop) => (
        <AutoPieceProp key={prop.name} selected={selected} prop={prop} edit={edit} onUpdate={onUpdate} />
      ))}

      <PipelineField label="Timeout (ms)" hint={`default ${DEFAULT_N8N_TIMEOUT_MS}`}>
        {edit ? (
          <Input
            type="number"
            min={1_000}
            max={600_000}
            value={selected.n8nTimeoutMs ?? DEFAULT_N8N_TIMEOUT_MS}
            onChange={(e) => {
              const n = Number(e.target.value)
              onUpdate?.({ n8nTimeoutMs: Number.isFinite(n) ? n : undefined })
            }}
            className="h-8 font-mono text-xs"
          />
        ) : (
          <StaticValue mono>{selected.n8nTimeoutMs ?? DEFAULT_N8N_TIMEOUT_MS}</StaticValue>
        )}
      </PipelineField>

      <PipelineField
        label="n8n code"
        hint="Optional override of the piece's Code-node JavaScript. Empty = bundled piece code. Non-technical users can ignore this."
        defaultOpen={false}
      >
        {edit ? (
          <Textarea
            value={selected.n8nCode ?? ""}
            onChange={(e) => onUpdate?.({ n8nCode: e.target.value || undefined })}
            placeholder={entry?.n8nCode ?? "return items;"}
            className="min-h-[8rem] font-mono text-xs"
          />
        ) : selected.n8nCode?.trim() ? (
          <StaticValue mono>{selected.n8nCode}</StaticValue>
        ) : (
          <StaticValue>bundled piece code</StaticValue>
        )}
      </PipelineField>
    </>
  )
}
