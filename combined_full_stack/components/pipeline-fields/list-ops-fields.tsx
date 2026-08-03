"use client"

import {
  MergeDictStrategy,
  MergeListStrategy,
  MergeScalarStrategy,
} from "@/lib/types"
import type { MergePolicy, PipelineModule, StructureModel } from "@/lib/types"
import {
  defaultLayerPolicy,
  isMergeModuleKind,
  listOpsGeneratedCode,
  MERGE_DICT_STRATEGY_LABELS,
  MERGE_LIST_STRATEGY_LABELS,
  MERGE_PRESETS,
  MERGE_SCALAR_STRATEGY_LABELS,
  mergeUsesCustomCode,
  resolveMergePolicy,
} from "@/lib/list-ops-steps"
import { PipelineField, StaticValue } from "@/components/pipeline-fields/shared"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_CHUNK_TEXT_FIELD,
} from "@/lib/list-ops-steps"

type ListOpsModuleFieldsProps = {
  selected: PipelineModule
  models: StructureModel[]
  edit: boolean
  onUpdate?: (patch: Partial<PipelineModule>) => void
}

export function ListOpsModuleFields({ selected, models, edit, onUpdate }: ListOpsModuleFieldsProps) {
  const generated = listOpsGeneratedCode(selected, models)

  if (selected.kind === "chunk") {
    return (
      <>
        <PipelineField label="Chunk size" hint="Maximum characters per chunk">
          {edit ? (
            <Input
              type="number"
              min={1}
              value={selected.chunkSize ?? DEFAULT_CHUNK_SIZE}
              onChange={(e) =>
                onUpdate?.({ chunkSize: Math.max(1, Number(e.target.value) || DEFAULT_CHUNK_SIZE) })
              }
              className="h-8 font-mono text-xs"
            />
          ) : (
            <StaticValue mono>{selected.chunkSize ?? DEFAULT_CHUNK_SIZE}</StaticValue>
          )}
        </PipelineField>
        <PipelineField label="Overlap" hint="Characters shared between consecutive chunks">
          {edit ? (
            <Input
              type="number"
              min={0}
              value={selected.chunkOverlap ?? 0}
              onChange={(e) =>
                onUpdate?.({ chunkOverlap: Math.max(0, Number(e.target.value) || 0) })
              }
              className="h-8 font-mono text-xs"
            />
          ) : (
            <StaticValue mono>{selected.chunkOverlap ?? 0}</StaticValue>
          )}
        </PipelineField>
        <PipelineField
          label="Text field"
          hint={`Property to split on input objects — default ${DEFAULT_CHUNK_TEXT_FIELD} for Document`}
        >
          {edit ? (
            <Input
              value={selected.chunkTextField ?? DEFAULT_CHUNK_TEXT_FIELD}
              onChange={(e) => onUpdate?.({ chunkTextField: e.target.value })}
              className="h-8 font-mono text-xs"
            />
          ) : (
            <StaticValue mono>{selected.chunkTextField ?? DEFAULT_CHUNK_TEXT_FIELD}</StaticValue>
          )}
        </PipelineField>
        <GeneratedCodePreview code={generated} />
      </>
    )
  }

  if (selected.kind === "merge" || isMergeModuleKind(selected.kind)) {
    const policy = resolveMergePolicy(selected)
    const layer = defaultLayerPolicy(policy)
    const custom = mergeUsesCustomCode(selected)
    const presetId =
      MERGE_PRESETS.find((p) => JSON.stringify(p.policy) === JSON.stringify(policy))?.id ?? "custom"

    const patchDefault = (patch: Partial<typeof layer>) => {
      onUpdate?.({
        mergePolicy: {
          ...policy,
          default: { ...layer, ...patch },
        },
        mergeCustom: undefined,
      })
    }

    return (
      <>
        <PipelineField
          label="Preset"
          hint="Common merge policies — override individual strategies below"
        >
          {edit ? (
            <Select
              value={presetId}
              onValueChange={(v) => {
                const preset = MERGE_PRESETS.find((p) => p.id === v)
                if (preset) onUpdate?.({ mergePolicy: preset.policy, mergeCustom: undefined })
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MERGE_PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.label}
                  </SelectItem>
                ))}
                <SelectItem value="custom" className="text-xs">
                  Custom policy
                </SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <StaticValue>
              {MERGE_PRESETS.find((p) => p.id === presetId)?.label ?? "Custom policy"}
            </StaticValue>
          )}
        </PipelineField>

        {!custom && (
          <>
            <PipelineField label="List strategy" hint="How to merge arrays at each layer">
              {edit ? (
                <Select
                  value={layer.list ?? MergeListStrategy.Concat}
                  onValueChange={(v) => patchDefault({ list: v as MergeListStrategy })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(MergeListStrategy).map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">
                        {MERGE_LIST_STRATEGY_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <StaticValue>{MERGE_LIST_STRATEGY_LABELS[layer.list ?? MergeListStrategy.Concat]}</StaticValue>
              )}
            </PipelineField>

            <PipelineField label="Dict strategy" hint="How to merge objects at each layer">
              {edit ? (
                <Select
                  value={layer.dict ?? MergeDictStrategy.Deep}
                  onValueChange={(v) => patchDefault({ dict: v as MergeDictStrategy })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(MergeDictStrategy).map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">
                        {MERGE_DICT_STRATEGY_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <StaticValue>{MERGE_DICT_STRATEGY_LABELS[layer.dict ?? MergeDictStrategy.Deep]}</StaticValue>
              )}
            </PipelineField>

            <PipelineField label="Scalar strategy" hint="Conflicting primitives at the same path">
              {edit ? (
                <Select
                  value={layer.scalar ?? MergeScalarStrategy.Last}
                  onValueChange={(v) => patchDefault({ scalar: v as MergeScalarStrategy })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(MergeScalarStrategy).map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">
                        {MERGE_SCALAR_STRATEGY_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <StaticValue>
                  {MERGE_SCALAR_STRATEGY_LABELS[layer.scalar ?? MergeScalarStrategy.Last]}
                </StaticValue>
              )}
            </PipelineField>

            <PipelineField
              label="List item key"
              hint='Property for union/intersect/dedupe on object rows — e.g. "id"'
            >
              {edit ? (
                <Input
                  value={layer.itemKey ?? ""}
                  onChange={(e) =>
                    patchDefault({ itemKey: e.target.value.trim() || undefined })
                  }
                  placeholder="id"
                  className="h-8 font-mono text-xs"
                />
              ) : (
                <StaticValue mono>{layer.itemKey ?? "—"}</StaticValue>
              )}
            </PipelineField>

            <PipelineField
              label="Path rules (JSON)"
              hint='Per-path overrides — e.g. [{"path":"tags","policy":{"list":"concat_dedupe"}}]'
            >
              {edit ? (
                <Textarea
                  value={JSON.stringify(policy.rules ?? [], null, 2)}
                  onChange={(e) => {
                    try {
                      const rules = JSON.parse(e.target.value) as MergePolicy["rules"]
                      onUpdate?.({ mergePolicy: { ...policy, rules }, mergeCustom: undefined })
                    } catch {
                      // AI : ignore parse errors while typing
                    }
                  }}
                  className="min-h-24 font-mono text-[11px]"
                  spellCheck={false}
                />
              ) : (
                <pre className="font-mono text-[10px] whitespace-pre-wrap text-muted-foreground">
                  {JSON.stringify(policy.rules ?? [], null, 2)}
                </pre>
              )}
            </PipelineField>
          </>
        )}

        <PipelineField
          label="Custom function"
          hint="Optional — TypeScript (input) => … overrides policy when set"
        >
          {edit ? (
            <Textarea
              value={selected.mergeCustom ?? ""}
              onChange={(e) => onUpdate?.({ mergeCustom: e.target.value || undefined })}
              placeholder="Leave empty to use structural merge policy"
              className="min-h-28 font-mono text-[11px]"
              spellCheck={false}
            />
          ) : (
            <pre className="font-mono text-[10px] whitespace-pre-wrap text-muted-foreground">
              {selected.mergeCustom?.trim() || "—"}
            </pre>
          )}
        </PipelineField>

        <GeneratedCodePreview code={generated} />
      </>
    )
  }

  return null
}

function GeneratedCodePreview({ code }: { code: string }) {
  return (
    <PipelineField label="Generated code" hint="Read-only — updates when parameters change">
      <pre className="max-h-40 overflow-auto rounded-md border border-border/60 bg-secondary/30 p-2 font-mono text-[10px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
        {code}
      </pre>
    </PipelineField>
  )
}
