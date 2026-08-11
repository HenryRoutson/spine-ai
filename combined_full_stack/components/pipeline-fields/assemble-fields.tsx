"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { PipelineField, StaticValue, StructureModelSelect } from "@/components/pipeline-fields/shared"
import { formatTypeExpr, stepSpineOutType } from "@/lib/server/type_expr"
import {
  assembleAutoModelId,
  resolveAssembleSourceType,
  usesAssembleAutoOut,
} from "@/lib/assemble-type-expr"
import type { AssembleSource, PipelineModule, StructureModel } from "@/lib/types"
import { ModuleKind } from "@/lib/types"

type AssembleModuleFieldsProps = {
  selected: PipelineModule
  models: StructureModel[]
  modules: PipelineModule[]
  priorLabels: string[]
  edit: boolean
  onUpdate?: (patch: Partial<PipelineModule>) => void
}

function sourceLabel(source: AssembleSource | undefined): string {
  if (!source) return "—"
  if (source.kind === "spine") return "spine"
  return `state["${source.label}"]`
}

export function AssembleModuleFields({
  selected,
  models,
  modules,
  priorLabels,
  edit,
  onUpdate,
}: AssembleModuleFieldsProps) {
  const idx = modules.findIndex((m) => m.id === selected.id)
  const prev = idx > 0 ? modules[idx - 1] : undefined
  const bindings = selected.assembleBindings ?? {}
  const out = models.find((m) => m.id === selected.outStructureId)
  const autoOut = usesAssembleAutoOut(selected, models)
  const fieldNames =
    autoOut && Object.keys(bindings).length
      ? Object.keys(bindings)
      : (out?.fields.map((f) => f.name).filter(Boolean) ?? Object.keys(bindings))

  function setBinding(field: string, source: AssembleSource | undefined) {
    const next = { ...bindings }
    if (!source) delete next[field]
    else next[field] = source
    onUpdate?.({ assembleBindings: next })
  }

  function addBindingField() {
    let i = 1
    let name = `field_${i}`
    while (name in bindings) {
      i += 1
      name = `field_${i}`
    }
    onUpdate?.({
      assembleBindings: { ...bindings, [name]: { kind: "spine" } },
      outStructureId: selected.outStructureId ?? assembleAutoModelId(selected.id),
    })
  }

  const listId = `assemble-labels-${selected.id}`

  return (
    <>
      <PipelineField
        label="Output structure"
        hint={
          autoOut
            ? "auto-derived from bindings (locked) — clear bindings or pick a hand-authored structure to override"
            : "hand-authored — bind every required field; or clear to allow auto-derive"
        }
      >
        {edit ? (
          <StructureModelSelect
            models={models}
            value={selected.outStructureId}
            onValueChange={(id) => onUpdate?.({ outStructureId: id })}
          />
        ) : (
          <StaticValue mono>{out?.name ?? selected.outStructureId ?? "—"}</StaticValue>
        )}
      </PipelineField>

      <PipelineField
        label="Bindings"
        hint="Map each field to spine (previous step) or a prior step label — prefer original labels, not nested Assemble"
      >
        <div className="flex flex-col gap-2">
          {fieldNames.map((name) => {
            const source = bindings[name]
            const sourceType =
              idx >= 0 ? resolveAssembleSourceType(source ?? { kind: "spine" }, prev, modules, idx) : undefined
            return (
              <div key={name} className="rounded-md border border-border/60 bg-secondary/10 px-2 py-1.5">
                <div className="mb-1 flex items-center gap-2">
                  {edit && autoOut ? (
                    <Input
                      value={name}
                      onChange={(e) => {
                        const nextName = e.target.value.trim() || name
                        if (nextName === name) return
                        const next = { ...bindings }
                        const cur = next[name]
                        delete next[name]
                        if (cur) next[nextName] = cur
                        onUpdate?.({ assembleBindings: next })
                      }}
                      className="h-7 flex-1 font-mono text-[11px]"
                    />
                  ) : (
                    <span className="flex-1 font-mono text-[11px]">{name}</span>
                  )}
                  {edit && autoOut && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[10px]"
                      onClick={() => setBinding(name, undefined)}
                    >
                      remove
                    </Button>
                  )}
                </div>
                {edit ? (
                  <select
                    className="h-8 w-full rounded-md border border-input bg-background px-2 font-mono text-xs"
                    value={
                      source?.kind === "state" ? `state:${source.label}` : source?.kind === "spine" ? "spine" : ""
                    }
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === "spine") setBinding(name, { kind: "spine" })
                      else if (v.startsWith("state:")) setBinding(name, { kind: "state", label: v.slice(6) })
                    }}
                  >
                    <option value="">— choose source —</option>
                    <option value="spine">
                      spine
                      {prev ? ` (${formatTypeExpr(stepSpineOutType(prev) ?? { kind: "unknown" }, models)})` : ""}
                    </option>
                    {priorLabels.map((label) => (
                      <option key={label} value={`state:${label}`}>
                        state[&quot;{label}&quot;]
                      </option>
                    ))}
                  </select>
                ) : (
                  <StaticValue mono>{sourceLabel(source)}</StaticValue>
                )}
                {sourceType && (
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {formatTypeExpr(sourceType, models)}
                  </p>
                )}
              </div>
            )
          })}
          {edit && autoOut && (
            <Button type="button" variant="outline" size="sm" className="h-7 self-start text-xs" onClick={addBindingField}>
              Add field binding
            </Button>
          )}
          {edit && !autoOut && out && fieldNames.length === 0 && (
            <p className="font-mono text-[10px] text-muted-foreground">Output structure has no fields</p>
          )}
        </div>
        <datalist id={listId}>
          {priorLabels.map((label) => (
            <option key={label} value={label} />
          ))}
        </datalist>
      </PipelineField>
    </>
  )
}

export function isAssembleKind(kind: string): boolean {
  return kind === ModuleKind.Assemble
}
