"use client"

import type { MergePolicyRule, PipelineModule, StructureModel } from "@/lib/types"
import { isMergeModuleKind } from "@/lib/module-kinds"
import {
  defaultLayerPolicy,
  EMPTY_MERGE_LAYER_POLICY,
  listOpsGeneratedCode,
  MERGE_DICT_STRATEGY_LABELS,
  MERGE_LIST_STRATEGY_LABELS,
  MERGE_PRESETS,
  MERGE_SCALAR_STRATEGY_LABELS,
  mergeUsesCustomCode,
  resolveMergePolicy,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_CHUNK_TEXT_FIELD,
} from "@/lib/list-ops-steps"
import {
  MergeDictStrategySelect,
  MergeListStrategySelect,
  MergeScalarStrategySelect,
} from "@/components/pipeline-fields/merge-strategy-fields"
import { GeneratedCodePreview, PipelineField, StaticValue } from "@/components/pipeline-fields/shared"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MergeDictStrategy, MergeListStrategy, MergeScalarStrategy } from "@/lib/types"

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
    const rules = policy.rules ?? []

    const patchDefault = (patch: Partial<typeof layer>) => {
      onUpdate?.({
        mergePolicy: {
          ...policy,
          default: { ...layer, ...patch },
        },
        mergeCustom: undefined,
      })
    }

    const setRules = (next: MergePolicyRule[]) => {
      onUpdate?.({
        mergePolicy: { ...policy, rules: next },
        mergeCustom: undefined,
      })
    }

    const patchRule = (index: number, patch: Partial<MergePolicyRule>) => {
      const next = rules.map((r, i) => {
        if (i !== index) return r
        return {
          path: patch.path ?? r.path,
          policy: patch.policy ? { ...r.policy, ...patch.policy } : r.policy,
        }
      })
      setRules(next)
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
            <PipelineField
              label="Default list strategy"
              hint="Fallback for every array — union/zip recurse into matching items"
            >
              {edit ? (
                <MergeListStrategySelect
                  value={layer.list ?? MergeListStrategy.Concat}
                  onValueChange={(v) => patchDefault({ list: v })}
                />
              ) : (
                <StaticValue>{MERGE_LIST_STRATEGY_LABELS[layer.list ?? MergeListStrategy.Concat]}</StaticValue>
              )}
            </PipelineField>

            <PipelineField label="Default dict strategy" hint="Fallback for every object">
              {edit ? (
                <MergeDictStrategySelect
                  value={layer.dict ?? MergeDictStrategy.Deep}
                  onValueChange={(v) => patchDefault({ dict: v })}
                />
              ) : (
                <StaticValue>{MERGE_DICT_STRATEGY_LABELS[layer.dict ?? MergeDictStrategy.Deep]}</StaticValue>
              )}
            </PipelineField>

            <PipelineField label="Default scalar strategy" hint="Conflicting primitives at the same path">
              {edit ? (
                <MergeScalarStrategySelect
                  value={layer.scalar ?? MergeScalarStrategy.Last}
                  onValueChange={(v) => patchDefault({ scalar: v })}
                />
              ) : (
                <StaticValue>
                  {MERGE_SCALAR_STRATEGY_LABELS[layer.scalar ?? MergeScalarStrategy.Last]}
                </StaticValue>
              )}
            </PipelineField>

            <PipelineField
              label="Default list item key"
              hint='For union/intersect/dedupe — e.g. "id" or dotted "meta.id"'
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
              label="Path rules"
              hint="Per-layer overrides — * = one segment, ** = any depth. e.g. users.*.roles, *.*.meta.k"
            >
              <div className="flex flex-col gap-2">
                {rules.length === 0 && !edit && <StaticValue>—</StaticValue>}
                {rules.map((rule, index) => (
                  <MergePathRuleRow
                    key={`${rule.path}-${index}`}
                    rule={rule}
                    edit={edit}
                    onChange={(patch) => patchRule(index, patch)}
                    onRemove={() => setRules(rules.filter((_, i) => i !== index))}
                  />
                ))}
                {edit && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 self-start text-xs"
                    onClick={() =>
                      setRules([...rules, { path: "*", policy: { ...EMPTY_MERGE_LAYER_POLICY } }])
                    }
                  >
                    Add path rule
                  </Button>
                )}
              </div>
            </PipelineField>
          </>
        )}

        <PipelineField
          label="Pipeline state operand"
          hint="Prior step label — merged with spine input (e.g. Normalize Case)"
        >
          {edit ? (
            <Input
              value={selected.mergeStateLabel ?? ""}
              onChange={(e) => onUpdate?.({ mergeStateLabel: e.target.value || undefined, mergeCustom: undefined })}
              placeholder="Normalize Case"
              className="h-8 font-mono text-xs"
            />
          ) : (
            <StaticValue mono>{selected.mergeStateLabel?.trim() || "—"}</StaticValue>
          )}
        </PipelineField>

        <PipelineField
          label="Wrap list field"
          hint="When spine is list[T], wrap as { field: T[] } before merge — must exist on output structure"
        >
          {edit ? (
            <Input
              value={selected.mergeWrapListField ?? ""}
              onChange={(e) => onUpdate?.({ mergeWrapListField: e.target.value || undefined, mergeCustom: undefined })}
              placeholder="selected_examples"
              className="h-8 font-mono text-xs"
            />
          ) : (
            <StaticValue mono>{selected.mergeWrapListField?.trim() || "—"}</StaticValue>
          )}
        </PipelineField>

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

function MergePathRuleRow({
  rule,
  edit,
  onChange,
  onRemove,
}: {
  rule: MergePolicyRule
  edit: boolean
  onChange: (patch: Partial<MergePolicyRule>) => void
  onRemove: () => void
}) {
  const p = rule.policy
  if (!edit) {
    return (
      <pre className="rounded-md border border-border/60 bg-secondary/20 px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
        {rule.path}: list={p.list ?? "—"} dict={p.dict ?? "—"} scalar={p.scalar ?? "—"}
        {p.itemKey ? ` key=${p.itemKey}` : ""}
      </pre>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border/60 bg-secondary/15 p-2">
      <div className="flex items-center gap-1.5">
        <Input
          value={rule.path}
          onChange={(e) => onChange({ path: e.target.value })}
          placeholder="users.*.roles"
          className="h-7 flex-1 font-mono text-[11px]"
        />
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onRemove}>
          Remove
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <MergeListStrategySelect
          value={p.list ?? MergeListStrategy.Concat}
          onValueChange={(v) => onChange({ policy: { list: v } })}
          triggerClassName="h-7 text-[11px]"
          placeholder="List"
        />
        <MergeDictStrategySelect
          value={p.dict ?? MergeDictStrategy.Deep}
          onValueChange={(v) => onChange({ policy: { dict: v } })}
          triggerClassName="h-7 text-[11px]"
          placeholder="Dict"
        />
        <MergeScalarStrategySelect
          value={p.scalar ?? MergeScalarStrategy.Last}
          onValueChange={(v) => onChange({ policy: { scalar: v } })}
          triggerClassName="h-7 text-[11px]"
          placeholder="Scalar"
        />
        <Input
          value={p.itemKey ?? ""}
          onChange={(e) => onChange({ policy: { itemKey: e.target.value.trim() || undefined } })}
          placeholder="itemKey"
          className="h-7 font-mono text-[11px]"
        />
      </div>
    </div>
  )
}

