// AI : list chunk + merge step codegen and legacy list-merge migration.
import { isNestedLaneKind } from "@/lib/fork-pipeline"
import { isMergeModuleKind } from "@/lib/module-kinds"
import { makeCustomCodeEntry } from "@/lib/custom_code_entries"
import { buildMergeTypeScript, DEFAULT_MERGE_POLICY, EMPTY_MERGE_LAYER_POLICY } from "@/lib/merger"
import { patchSpineOutList } from "@/lib/server/spine_types"
import { deriveMergeStepTypes } from "@/lib/merge-type-expr"
import {
  CustomCodeLanguage,
  LegacyModuleKind,
  MergeDictStrategy,
  MergeListStrategy,
  MergeScalarStrategy,
  ModuleKind,
  type MergeLayerPolicy,
  type MergePolicy,
  type PipelineModule,
  type StructureModel,
  type StructureModelId,
} from "@/lib/types"

export { DEFAULT_MERGE_POLICY, EMPTY_MERGE_LAYER_POLICY } from "@/lib/merger"

export const DEFAULT_CHUNK_SIZE = 2000
export const DEFAULT_CHUNK_OVERLAP = 0
export const DEFAULT_CHUNK_TEXT_FIELD = "content"

export const MERGE_LIST_STRATEGY_LABELS: Record<MergeListStrategy, string> = {
  [MergeListStrategy.Concat]: "Concatenate lists",
  [MergeListStrategy.ConcatDedupe]: "Concatenate + merge duplicates",
  [MergeListStrategy.ConcatAssertNoDuplicates]: "Concatenate — fail on duplicates",
  [MergeListStrategy.Union]: "Union by key — deep-merge matches",
  [MergeListStrategy.UnionAssert]: "Union — fail on key overlap",
  [MergeListStrategy.Intersect]: "Intersect by key — deep-merge matches",
  [MergeListStrategy.IntersectAssert]: "Intersect — fail if left not in right",
  [MergeListStrategy.Replace]: "Replace — right wins",
  [MergeListStrategy.ReplaceAssert]: "Replace — fail if left is non-empty",
  [MergeListStrategy.Prepend]: "Prepend — right then left",
  [MergeListStrategy.PrependAssert]: "Prepend — fail if right is non-empty",
  [MergeListStrategy.Zip]: "Zip — deep-merge by index",
}

export const MERGE_DICT_STRATEGY_LABELS: Record<MergeDictStrategy, string> = {
  [MergeDictStrategy.Deep]: "Deep merge keys",
  [MergeDictStrategy.Shallow]: "Shallow merge",
  [MergeDictStrategy.Replace]: "Replace — right wins",
}

export const MERGE_SCALAR_STRATEGY_LABELS: Record<MergeScalarStrategy, string> = {
  [MergeScalarStrategy.Last]: "Last value wins",
  [MergeScalarStrategy.First]: "First value wins",
  [MergeScalarStrategy.Error]: "Error on conflict",
}

export const MERGE_PRESETS: { id: string; label: string; policy: MergePolicy }[] = [
  {
    id: "deep-concat",
    label: "Deep merge — concat lists (default)",
    policy: DEFAULT_MERGE_POLICY,
  },
  {
    id: "dedupe-lists",
    label: "Deep merge — dedupe lists",
    policy: {
      default: {
        list: MergeListStrategy.ConcatDedupe,
        dict: MergeDictStrategy.Deep,
        scalar: MergeScalarStrategy.Last,
      },
    },
  },
  {
    id: "union-by-id",
    label: "Union list records by id (deep-merge)",
    policy: {
      default: {
        list: MergeListStrategy.Union,
        dict: MergeDictStrategy.Deep,
        scalar: MergeScalarStrategy.Last,
        itemKey: "id",
      },
    },
  },
  {
    id: "zip-lists",
    label: "Zip lists by index (deep-merge)",
    policy: {
      default: {
        list: MergeListStrategy.Zip,
        dict: MergeDictStrategy.Deep,
        scalar: MergeScalarStrategy.Last,
      },
    },
  },
  {
    id: "dedupe-tags",
    label: "Dedupe tags at path",
    policy: {
      default: DEFAULT_MERGE_POLICY.default,
      rules: [{ path: "tags", policy: { list: MergeListStrategy.ConcatDedupe } }],
    },
  },
  {
    id: "nested-keyed",
    label: "Nested: union by id + dedupe *.*.roles",
    policy: {
      default: {
        list: MergeListStrategy.Concat,
        dict: MergeDictStrategy.Deep,
        scalar: MergeScalarStrategy.Last,
      },
      rules: [
        { path: "*", policy: { list: MergeListStrategy.Union, itemKey: "id" } },
        { path: "**.roles", policy: { list: MergeListStrategy.ConcatDedupe } },
      ],
    },
  },
]

export function isListOpsModule(m: PipelineModule): boolean {
  return m.kind === ModuleKind.Chunk || isMergeModuleKind(m.kind)
}

export function resolveMergePolicy(m: PipelineModule): MergePolicy {
  return m.mergePolicy ?? DEFAULT_MERGE_POLICY
}

export function mergeUsesCustomCode(m: PipelineModule): boolean {
  return !!m.mergeCustom?.trim()
}

function chunkFieldNames(models: StructureModel[], outStructureId?: StructureModelId): {
  idField: string
  textField: string
} {
  const model = models.find((m) => m.id === outStructureId)
  if (!model?.fields.length) return { idField: "id", textField: "text" }
  const idField = model.fields.find((f) => f.name === "id")?.name ?? model.fields[0]!.name
  const textCandidates = model.fields.filter((f) => f.type === "text")
  const textField =
    textCandidates.find((f) => f.name !== idField)?.name ??
    textCandidates[0]?.name ??
    model.fields[1]?.name ??
    "text"
  return { idField, textField }
}

export function buildChunkTypeScript(
  m: PipelineModule,
  models: StructureModel[],
): string {
  const size = Math.max(1, m.chunkSize ?? DEFAULT_CHUNK_SIZE)
  const overlap = Math.max(0, m.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP)
  const sourceField = (m.chunkTextField?.trim() || DEFAULT_CHUNK_TEXT_FIELD).replace(/"/g, '\\"')
  const { idField, textField } = chunkFieldNames(models, m.outStructureId)
  const step = Math.max(1, size - overlap)
  return `(input) => {
  const SIZE = ${size};
  const STEP = ${step};
  const SRC = "${sourceField}";
  const raw = Array.isArray(input)
    ? input.map((row) => row?.[SRC] ?? row?.content ?? "").join("\\n")
    : (input?.[SRC] ?? input?.content ?? (typeof input === "string" ? input : JSON.stringify(input ?? "")));
  const text = String(raw ?? "");
  const out = [];
  for (let i = 0, n = 0; i < text.length; i += STEP, n++) {
    out.push({ ${JSON.stringify(idField)}: String(n + 1), ${JSON.stringify(textField)}: text.slice(i, i + SIZE) });
  }
  return out;
}`
}

export function listOpsGeneratedCode(m: PipelineModule, models: StructureModel[]): string {
  if (m.kind === ModuleKind.Chunk) return buildChunkTypeScript(m, models)
  if (isMergeModuleKind(m.kind)) {
    return buildMergeTypeScript(resolveMergePolicy(m), m.mergeCustom, {
      stateLabel: m.mergeStateLabel,
      wrapListField: m.mergeWrapListField,
    })
  }
  return "(input) => input"
}

export function syncListOpsStepModule(
  m: PipelineModule,
  models: StructureModel[],
  prev?: PipelineModule,
  modules?: PipelineModule[],
): { module: PipelineModule; models: StructureModel[] } {
  if (!isListOpsModule(m)) return { module: m, models }

  const code = listOpsGeneratedCode(m, models)
  const existingTs = m.fallbackList?.[0]?.typescript
  if (existingTs === code && m.inType && m.outType) {
    return { module: m, models }
  }

  let next: PipelineModule = {
    ...m,
    fallbackList: [makeCustomCodeEntry(CustomCodeLanguage.TypeScript, code)],
  }

  if (m.kind === ModuleKind.Chunk && next.outStructureId) {
    next = { ...next, ...patchSpineOutList(next, true) }
    return { module: next, models }
  }

  if (isMergeModuleKind(m.kind)) {
    return deriveMergeStepTypes(next, prev, models, resolveMergePolicy(m), modules)
  }

  return { module: next, models }
}

export function syncListOpsModules(
  modules: PipelineModule[],
  models: StructureModel[],
): { modules: PipelineModule[]; models: StructureModel[] } {
  let scratchModels = models
  const nextModules = modules.map((m, i) => {
    const prev = i > 0 ? modules[i - 1] : undefined
    if (isNestedLaneKind(m.kind)) {
      const nested = (m.forkBranches ?? []).map((b) => {
        const syncedLane = syncListOpsModules(b.modules, scratchModels)
        scratchModels = syncedLane.models
        return { ...b, modules: syncedLane.modules }
      })
      return { ...m, forkBranches: nested }
    }
    const synced = syncListOpsStepModule(m, scratchModels, prev, modules)
    scratchModels = synced.models
    return synced.module
  })
  return { modules: nextModules, models: scratchModels }
}

export function defaultLayerPolicy(policy?: MergePolicy): MergeLayerPolicy {
  return {
    list: policy?.default?.list ?? MergeListStrategy.Concat,
    dict: policy?.default?.dict ?? MergeDictStrategy.Deep,
    scalar: policy?.default?.scalar ?? MergeScalarStrategy.Last,
    itemKey: policy?.default?.itemKey,
  }
}

// AI : legacy list-merge modules → merge kind + equivalent policy.
export function migrateListMergeModule(m: PipelineModule): PipelineModule {
  if ((m.kind as string) !== LegacyModuleKind.ListMerge) return m
  const legacy = m as PipelineModule & {
    listMergeMethod?: string
    listMergeCustom?: string
  }
  let mergePolicy: MergePolicy = DEFAULT_MERGE_POLICY
  let mergeCustom = legacy.listMergeCustom
  switch (legacy.listMergeMethod) {
    case "unique":
      mergePolicy = {
        default: {
          list: MergeListStrategy.ConcatDedupe,
          dict: MergeDictStrategy.Deep,
          scalar: MergeScalarStrategy.Last,
        },
      }
      break
    case "dict-keys":
    case "dict-values":
    case "custom":
      mergeCustom = mergeCustom ?? legacy.listMergeCustom
      break
    default:
      break
  }
  const { listMergeMethod: _lm, listMergeCustom: _lc, ...rest } = legacy
  return { ...rest, kind: ModuleKind.Merge, mergePolicy, mergeCustom }
}
