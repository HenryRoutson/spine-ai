// AI : list chunk + merge step codegen and legacy list-merge migration.
import { isMergeModuleKind } from "@/lib/module-kinds"
import { makeCustomCodeEntry } from "@/lib/custom_code_entries"
import { buildMergeTypeScript, DEFAULT_MERGE_POLICY } from "@/lib/merger"
import { patchSpineOutList } from "@/lib/server/spine_types"
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

export { isMergeModuleKind } from "@/lib/module-kinds"

export const DEFAULT_CHUNK_SIZE = 2000
export const DEFAULT_CHUNK_OVERLAP = 0
export const DEFAULT_CHUNK_TEXT_FIELD = "content"

export const MERGE_LIST_STRATEGY_LABELS: Record<MergeListStrategy, string> = {
  [MergeListStrategy.Concat]: "Concatenate lists",
  [MergeListStrategy.ConcatDedupe]: "Concatenate + dedupe",
  [MergeListStrategy.ConcatAssertNoDuplicates]: "Concatenate — fail on duplicates",
  [MergeListStrategy.Union]: "Union (by item key when set)",
  [MergeListStrategy.Intersect]: "Intersect (by item key when set)",
  [MergeListStrategy.Replace]: "Replace — right wins",
  [MergeListStrategy.Prepend]: "Prepend — right then left",
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
    label: "Union list records by id",
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
    id: "dedupe-tags",
    label: "Dedupe tags at path",
    policy: {
      default: DEFAULT_MERGE_POLICY.default,
      rules: [{ path: "tags", policy: { list: MergeListStrategy.ConcatDedupe } }],
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
    return buildMergeTypeScript(resolveMergePolicy(m), m.mergeCustom)
  }
  return "(input) => input"
}

export function syncListOpsStepModule(m: PipelineModule, models: StructureModel[]): PipelineModule {
  if (!isListOpsModule(m)) return m
  const code = listOpsGeneratedCode(m, models)
  let next: PipelineModule = {
    ...m,
    fallbackList: [makeCustomCodeEntry(CustomCodeLanguage.TypeScript, code)],
  }
  if (next.outStructureId) {
    const emitsList = m.kind === ModuleKind.Chunk
    next = { ...next, ...patchSpineOutList(next, emitsList) }
  }
  return next
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
