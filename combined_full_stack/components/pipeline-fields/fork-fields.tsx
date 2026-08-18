"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PipelineField, StaticValue } from "@/components/pipeline-fields/shared"
import {
  FORK_MAX_BRANCHES,
  FORK_MIN_BRANCHES,
  forkContainsNestedFork,
  forkJoinOf,
  makeEmptyForkBranch,
  type ForkJoin,
} from "@/lib/fork-pipeline"
import type { PipelineModule } from "@/lib/types"

type ForkModuleFieldsProps = {
  selected: PipelineModule
  edit: boolean
  onUpdate?: (patch: Partial<PipelineModule>) => void
}

const JOIN_HINT: Record<ForkJoin, string> = {
  product: "auto structure with one field per lane (like Parallel)",
  assemble: "zip spine + lane labels into a flat structure (like Assemble)",
  merge: "fold lane outputs with the merge policy",
}

export function ForkModuleFields({ selected, edit, onUpdate }: ForkModuleFieldsProps) {
  const branches = selected.forkBranches ?? []
  const join = forkJoinOf(selected)
  const nested = forkContainsNestedFork(selected)

  function setJoin(next: ForkJoin) {
    onUpdate?.({
      forkJoin: next,
      assembleBindings: next === "assemble" ? (selected.assembleBindings ?? {}) : selected.assembleBindings,
      mergePolicy: next === "merge" ? selected.mergePolicy : selected.mergePolicy,
    })
  }

  function patchBranch(id: string, patch: { label?: string }) {
    onUpdate?.({
      forkBranches: branches.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    })
  }

  return (
    <>
      {nested && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-amber-800 dark:text-amber-200">
          Nested forks are stored but v1 canvas flattens them to a card. Flatten first (move inner steps onto this fork&apos;s lanes).
        </p>
      )}
      <PipelineField label="Join" hint={JOIN_HINT[join]}>
        {edit ? (
          <Select value={join} onValueChange={(v) => setJoin(v as ForkJoin)}>
            <SelectTrigger className="h-8 font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="product">product</SelectItem>
              <SelectItem value="assemble">assemble</SelectItem>
              <SelectItem value="merge">merge</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <StaticValue mono>{join}</StaticValue>
        )}
      </PipelineField>
      <PipelineField
        label="Lanes"
        hint={`2–${FORK_MAX_BRANCHES} linear lanes. Each starts from the previous spine.`}
      >
        <div className="flex flex-col gap-2">
          {branches.map((b, i) => (
            <div key={b.id} className="flex items-center gap-2 rounded-md border border-border/60 bg-secondary/10 p-2">
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">lane {i + 1}</span>
              {edit ? (
                <Input
                  value={b.label}
                  onChange={(e) => patchBranch(b.id, { label: e.target.value })}
                  className="h-8 font-mono text-xs"
                  placeholder="Lane A"
                />
              ) : (
                <StaticValue mono>{b.label || "—"}</StaticValue>
              )}
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                {b.modules.length} step{b.modules.length === 1 ? "" : "s"}
              </span>
              {edit && branches.length > FORK_MIN_BRANCHES && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[10px]"
                  onClick={() =>
                    onUpdate?.({ forkBranches: branches.filter((x) => x.id !== b.id) })
                  }
                >
                  remove
                </Button>
              )}
            </div>
          ))}
          {edit && branches.length < FORK_MAX_BRANCHES && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 self-start text-xs"
              onClick={() =>
                onUpdate?.({
                  forkBranches: [...branches, makeEmptyForkBranch(`Lane ${String.fromCharCode(65 + branches.length)}`)],
                })
              }
            >
              Add lane
            </Button>
          )}
        </div>
      </PipelineField>
    </>
  )
}
