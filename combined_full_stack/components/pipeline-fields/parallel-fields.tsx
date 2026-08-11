"use client"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { ModelSelector } from "@/components/model-selector"
import { PipelineField, StaticValue, StructureModelSelect } from "@/components/pipeline-fields/shared"
import { makeEmptyParallelBranch } from "@/lib/parallel-branches"
import type { ParallelBranch, PipelineModule, StructureModel, StructureModelId } from "@/lib/types"
import { ModuleKind } from "@/lib/types"

type ParallelModuleFieldsProps = {
  selected: PipelineModule
  models: StructureModel[]
  edit: boolean
  globalModel?: string
  onUpdate?: (patch: Partial<PipelineModule>) => void
}

export function ParallelModuleFields({
  selected,
  models,
  edit,
  globalModel,
  onUpdate,
}: ParallelModuleFieldsProps) {
  const branches = selected.parallelBranches ?? []

  function setBranches(next: ParallelBranch[]) {
    onUpdate?.({ parallelBranches: next })
  }

  function patchBranch(id: string, patch: Partial<ParallelBranch>) {
    setBranches(branches.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  }

  return (
    <PipelineField
      label="Parallel branches"
      hint="Each branch runs an LLM on the same spine input concurrently; fields join into one structure"
    >
      <div className="flex flex-col gap-3">
        {branches.map((b, i) => (
          <div key={b.id} className="rounded-md border border-border/60 bg-secondary/10 p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-muted-foreground">branch {i + 1}</span>
              {edit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[10px]"
                  onClick={() => setBranches(branches.filter((x) => x.id !== b.id))}
                >
                  remove
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <PipelineField label="Field name">
                {edit ? (
                  <Input
                    value={b.field}
                    onChange={(e) => patchBranch(b.id, { field: e.target.value })}
                    className="h-8 font-mono text-xs"
                    placeholder="summary"
                  />
                ) : (
                  <StaticValue mono>{b.field || "—"}</StaticValue>
                )}
              </PipelineField>
              <PipelineField label="Out structure">
                {edit ? (
                  <StructureModelSelect
                    models={models}
                    value={b.outStructureId || undefined}
                    onValueChange={(id) =>
                      patchBranch(b.id, { outStructureId: (id ?? "") as StructureModelId })
                    }
                  />
                ) : (
                  <StaticValue mono>
                    {models.find((m) => m.id === b.outStructureId)?.name ?? b.outStructureId ?? "—"}
                  </StaticValue>
                )}
              </PipelineField>
              <PipelineField label="Model">
                {edit ? (
                  <ModelSelector
                    value={b.model ?? globalModel ?? ""}
                    onChange={(v) => patchBranch(b.id, { model: v || undefined })}
                  />
                ) : (
                  <StaticValue mono>{b.model ?? globalModel ?? "—"}</StaticValue>
                )}
              </PipelineField>
              <PipelineField label="Prompt">
                {edit ? (
                  <Textarea
                    value={b.prompt}
                    onChange={(e) => patchBranch(b.id, { prompt: e.target.value })}
                    className="min-h-20 font-mono text-[11px]"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap font-mono text-[10px] text-muted-foreground">
                    {b.prompt || "—"}
                  </pre>
                )}
              </PipelineField>
            </div>
          </div>
        ))}
        {edit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 self-start text-xs"
            onClick={() => setBranches([...branches, makeEmptyParallelBranch()])}
          >
            Add branch
          </Button>
        )}
      </div>
    </PipelineField>
  )
}

export function isParallelKind(kind: string): boolean {
  return kind === ModuleKind.Parallel
}
