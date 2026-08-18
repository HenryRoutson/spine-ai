import { exampleSelectAcceptsWrapper } from "@/lib/example-select";
import { orderedInputModules } from "@/lib/inference-input";
import { buildCustomFnSource } from "@/lib/custom_code";
import { customCodeEntriesForModule } from "@/lib/custom_code_entries";
import { DEFAULT_MERGE_POLICY } from "@/lib/merger";
import { usesPassthroughStructure } from "@/lib/module-kinds";
import { modelExportIdentifierGo, modelExportIdentifierRust, rustFieldIdent } from "@/lib/structure-shape";
import { webhookStepUsesPipelineState } from "@/lib/webhook-step";
import { BUILTIN_DOCUMENT_ID, withSharedModels } from "./builtin_models";
import { labelAsStateKey } from "./pipeline_state";
import { migrateProjectModules } from "./validity";
import {
  fieldToTypeExpr,
  labelToPyKey,
  stepEmitsList,
  stepSpineInType,
  stepSpineOutType,
  typeExprToGo,
  typeExprToPy,
  typeExprToRust,
  typeExprToTs,
} from "./type_expr";
import { FieldType, ModuleKind } from "./types";
import type { StepLabel } from "../run-types";
import type { PipelineModule, Project, StructureModelId, TypeExpr } from "./types";
import { assemblePolymorphicTsSignature } from "@/lib/type-expr-polymorph";
import { llmSchema } from "./structure";
import { z } from "zod";

export type PipelineSetupFile = {
  filename: string;
  content: string;
  mime: string;
};

export type ExportCustomCode = { language: string; code: string };

// AI : normalize project models before codegen so built-in Document resolves everywhere.
// AI : migrate like the UI run engine — assert placement + managed steps must match hosted order.
export function prepareExportProject(project: Project): Project {
  const migrated = migrateProjectModules(project);
  return { ...migrated, models: withSharedModels(migrated.models) };
}

export function exportLlmSchemaJson(
  project: Project,
  structureId: string | undefined,
  isList: boolean,
): string {
  const model = project.models.find((x) => x.id === structureId);
  if (!model) return "{}";
  return JSON.stringify(z.toJSONSchema(llmSchema(model, project.models, isList, project.typeAliases ?? [])));
}

export function exportStepLlmSchemaJson(project: Project, m: PipelineModule): string {
  const itemSchema = m.kind === ModuleKind.LlmBatch;
  return exportLlmSchemaJson(project, m.outStructureId, itemSchema ? false : stepEmitsList(m));
}

export function exportSchemaExprTs(json: string): string {
  return json;
}

export function exportSchemaExprPy(json: string): string {
  return `json.loads(${JSON.stringify(json)})`;
}

export function exportSchemaExprRust(json: string): string {
  return `serde_json::from_str(${JSON.stringify(json)}).unwrap_or_else(|_| serde_json::json!({}))`;
}

export function exportSchemaExprGo(json: string): string {
  return `json.RawMessage([]byte(${JSON.stringify(json)}))`;
}

// AI : shared by py / ts / rust / go / baml pipeline exporters — keep step bodies DRY across languages.
// AI : TODO (arch-export-orchestrator) — generateOrchestrator* still walk the same spine;
// AI :   dispatch owns kind × lang bodies (pipeline_export_dispatch.ts). IR printers next, leave BAML.
export function indentExportBlock(code: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return code
    .split("\n")
    .map((line) => (line ? `${pad}${line}` : line))
    .join("\n");
}

export function exportStringLiteral(s: string): string {
  return JSON.stringify(s);
}

export function primaryExportCustomCode(m: PipelineModule): ExportCustomCode | null {
  const entries = customCodeEntriesForModule(m);
  const primary = entries[0];
  if (!primary?.code.trim()) return null;
  return { language: primary.language, code: primary.code.trim() };
}

// AI : shared export comments — body helpers + style prefix so ts/py/rs/go stay DRY.
export type ExportCommentStyle = "//" | "#";

export function exportComment(style: ExportCommentStyle, body: string): string {
  return `${style} ${body}`;
}

// AI : comment a source line once — avoid // // / # # when the line is already commented.
export function asExportCommentLine(style: ExportCommentStyle, line: string): string {
  const t = line.trimStart();
  if (style === "//" && t.startsWith("//")) return t;
  if (style === "#" && t.startsWith("#")) return t;
  return exportComment(style, line);
}

export function commentForeignCode(
  style: ExportCommentStyle,
  langLabel: string,
  code: string,
  via?: string,
): string {
  const header = via
    ? `${langLabel} (not inlined — ${via}):`
    : `${langLabel} (not inlined):`;
  return [exportComment(style, header), ...code.split("\n").map((l) => asExportCommentLine(style, l))].join(
    "\n",
  );
}

// AI : detect real state reads — strip comment lines so foreign code comments don't force a live state param.
export function stepBodyUsesPipelineState(
  style: ExportCommentStyle,
  body: string,
  m?: PipelineModule,
): boolean {
  if (m?.kind === ModuleKind.Webhook && webhookStepUsesPipelineState(m)) return true;
  return body
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(style))
    .some((line) =>
      /\bstate\s*\[|\bstate\.(get|insert)\b|__assert\(input,\s*state\)|__compiled\.length >= 2|\btransform\(input,\s*state\)/.test(
        line,
      ),
    );
}

export function reshapeStepComment(
  m: PipelineModule,
  inName: string | undefined,
  outName: string | undefined,
  outFallback: string,
): string {
  return `Reshape ${inName ?? "input"} → ${outName ?? outFallback}${stepEmitsList(m) ? " (list)" : ""}`;
}

export function passthroughCustomComment(): string {
  return "Passthrough — no custom code configured";
}

export function structuredLlmComment(outLabel: string, emitsList: boolean): string {
  return `Structured LLM call → ${outLabel}${emitsList ? "[]" : ""}`;
}

export function llmBatchComment(outLabel: string): string {
  return `One structured LLM call per list item → ${outLabel}`;
}

export function exampleSelectComment(outLabel: string): string {
  return `Per-item relevance filter — ${outLabel} with selection_reason`;
}

export function quoteLinkComment(): string {
  return "Match LLM quote strings against source document byte offsets (no LLM cost)";
}

export function parallelBranchesComment(): string {
  return "Parallel LLM branches — run concurrently then join (see runtime)";
}

export function assertValidateComment(): string {
  return "Validate pipeline state — passthrough on success";
}

export function assertPassthroughComment(): string {
  return "Assert passthrough";
}

export function humanReviewComment(): string {
  return "Pause for operator approval in Inference tab";
}

export function chatbotComment(): string {
  return "Prompted chatbot — input is ChatbotPrompt; returns ChatbotResult";
}

export function snapshotComment(outName: string | undefined, inName: string | undefined): string {
  return `Snapshot ${outName ?? inName ?? "pipeline output"}`;
}

export function fallbacksFirstComment(count: number): string {
  return `${count} fallback implementations — first shown`;
}

export function parseUploadedComment(): string {
  return "Parse uploaded file — built-in parser or vision OCR when enabled";
}

export function inputGuardComment(description: string, checkDisabled: boolean): string {
  return `Input guard: ${JSON.stringify(description)}${checkDisabled ? " (disabled)" : ""}`;
}

export function filenameContainsComment(needle: string): string {
  return `Filename must contain: ${JSON.stringify(needle)}`;
}

export function visionOcrEnabledComment(): string {
  return "Vision OCR enabled for PDF/image uploads";
}

export function assembleZipComment(): string {
  return "Zip spine + pipeline state labels into one flat structure (Assemble)";
}

export function mergeUpstreamComment(inName: string | undefined): string {
  return `Merge uploaded document with upstream ${inName ?? "pipeline data"} from pipeline state`;
}

export function inputStepCommentLines(style: ExportCommentStyle, m: PipelineModule): string[] {
  return [
    exportComment(style, parseUploadedComment()),
    ...(m.inputDescription
      ? [exportComment(style, inputGuardComment(m.inputDescription, m.checkInputDescription === false))]
      : []),
    ...(m.inputNameContains ? [exportComment(style, filenameContainsComment(m.inputNameContains))] : []),
  ];
}

export function exportFileMetaComments(
  style: ExportCommentStyle,
  project: Project,
  extras: string[] = [],
): string[] {
  return [
    exportComment(style, `Project: ${project.name}`),
    exportComment(style, `${project.modules.length} steps · ${project.models.length} structures`),
    exportComment(style, "Setup: export also includes .env.example and README.md — copy .env.example → .env"),
    ...extras.map((body) => exportComment(style, body)),
  ];
}

export function exportSectionComment(
  style: ExportCommentStyle,
  section: "structures" | "pipeline state" | "steps" | "orchestrator",
): string {
  return exportComment(style, `=== ${section} ===`);
}

export function stepFnNameFromLabel(m: PipelineModule, index: number): string {
  const key = labelToPyKey(m.label);
  return key !== "_empty" ? `step_${key}` : `step_${index}`;
}

// AI : rustc non_snake_case — "✓ Wrap → List" → step_wrap_list; index disambiguates collisions.
export function makeUniqueStepFnName(): (m: PipelineModule, index: number) => string {
  const byIndex = new Map<number, string>();
  const used = new Set<string>();
  return (m, index) => {
    const cached = byIndex.get(index);
    if (cached) return cached;
    const key = labelToPyKey(m.label)
      .toLowerCase()
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
    let name = key ? `step_${key}` : `step_${index}`;
    if (used.has(name)) name = `step_${index}_${key || "step"}`;
    used.add(name);
    byIndex.set(index, name);
    return name;
  };
}

export function withExportLineCountMeta(
  content: string,
  prepared: Project,
  commentPrefix: "#" | "//",
): string {
  const base = `${commentPrefix} ${prepared.modules.length} steps · ${prepared.models.length} structures`;
  const lineCount = content.split("\n").length;
  const withMeta = content.replace(base, `${base} · ${lineCount} lines`);
  assertNoEnvKeysInExport(withMeta);
  return withMeta;
}

export function exportSpineInType(
  m: PipelineModule,
  project: Project,
  index: number,
): TypeExpr | undefined {
  const prev = index > 0 ? project.modules[index - 1] : undefined;
  if (m.kind === ModuleKind.Input) return { kind: "document" };
  if (m.kind === ModuleKind.Combine || usesPassthroughStructure(m.kind)) {
    return prev ? stepSpineOutType(prev) : undefined;
  }
  // AI : example-select unwraps the sole list[T] field — generated input type is the wrapper, not list[item].
  if (m.kind === ModuleKind.ExampleSelect) {
    const expected = stepSpineInType(m);
    const actual = prev ? stepSpineOutType(prev) : undefined;
    if (expected && actual && exampleSelectAcceptsWrapper(expected, actual, project.models)) return actual;
  }
  return stepSpineInType(m);
}

export function exportSpineInTs(m: PipelineModule, project: Project, index: number): string {
  const t = exportSpineInType(m, project, index);
  return t ? typeExprToTs(t, project.models) : "unknown";
}

export function exportSpineInPy(m: PipelineModule, project: Project, index: number): string {
  const t = exportSpineInType(m, project, index);
  return t ? typeExprToPy(t, project.models) : "Any";
}

export function exportSpineInRust(m: PipelineModule, project: Project, index: number): string {
  const t = exportSpineInType(m, project, index);
  return t ? typeExprToRust(t, project.models) : "Value";
}

export function exportSpineInGo(m: PipelineModule, project: Project, index: number): string {
  const t = exportSpineInType(m, project, index);
  return t ? typeExprToGo(t, project.models) : "json.RawMessage";
}

// AI : passthrough out follows the spine (prev), not a stale inStructureId on the module.
export function exportSpineOutType(
  m: PipelineModule,
  project: Project,
  index: number,
): TypeExpr | undefined {
  // AI : TODO (allow-pipeline-non-linear-fork) — passthrough prev is lane predecessor, not project.modules[index-1].
  if (usesPassthroughStructure(m.kind)) {
    const prev = index > 0 ? project.modules[index - 1] : undefined;
    return prev ? stepSpineOutType(prev) : stepSpineOutType(m);
  }
  return stepSpineOutType(m);
}

export function exportSpineOutTs(m: PipelineModule, project: Project, index: number): string {
  const t = exportSpineOutType(m, project, index);
  return t ? typeExprToTs(t, project.models) : "unknown";
}

export function exportSpineOutPy(m: PipelineModule, project: Project, index: number): string {
  const t = exportSpineOutType(m, project, index);
  return t ? typeExprToPy(t, project.models) : "Any";
}

export function exportSpineOutRust(m: PipelineModule, project: Project, index: number): string {
  const t = exportSpineOutType(m, project, index);
  return t ? typeExprToRust(t, project.models) : "Value";
}

export function exportSpineOutGo(m: PipelineModule, project: Project, index: number): string {
  const t = exportSpineOutType(m, project, index);
  return t ? typeExprToGo(t, project.models) : "json.RawMessage";
}

// AI : zero value for Go return-on-error paths.
export function goZeroValue(goType: string): string {
  if (
    goType.startsWith("[]") ||
    goType.startsWith("*") ||
    goType.startsWith("map[") ||
    goType === "json.RawMessage" ||
    goType === "any"
  ) {
    return "nil";
  }
  if (goType === "string") return `""`;
  if (goType === "bool") return "false";
  if (goType === "int64" || goType === "float64") return "0";
  return `${goType}{}`;
}

// AI : export PipelineState keys use the same spine-out types as step signatures.
export function pipelineStateTsInterfaceForExport(project: Project): string {
  const lines: string[] = [];
  for (let i = 0; i < project.modules.length; i++) {
    const m = project.modules[i]!;
    const label = labelAsStateKey(m.label);
    if (!label) continue;
    lines.push(`  ${JSON.stringify(label)}: ${exportSpineOutTs(m, project, i)};`);
  }
  if (!lines.length) return "export type PipelineState = Record<string, never>;";
  return `export type PipelineState = {\n${lines.join("\n")}\n};`;
}

export function pipelineStatePyTypedDictForExport(project: Project): string {
  const entries: string[] = [];
  for (let i = 0; i < project.modules.length; i++) {
    const m = project.modules[i]!;
    const label = labelAsStateKey(m.label);
    if (!label) continue;
    // AI : functional TypedDict — keys must match runtime state["Human Label"] strings.
    entries.push(`    ${JSON.stringify(label)}: ${exportSpineOutPy(m, project, i)},`);
  }
  if (!entries.length) {
    return 'PipelineState = TypedDict("PipelineState", {})\n';
  }
  // AI : total=True (default) matches TS PipelineState — empty init uses cast(object, {}).
  return [
    'PipelineState = TypedDict(',
    '    "PipelineState",',
    "    {",
    ...entries,
    "    },",
    ")",
    "",
  ].join("\n");
}

export function modelName(project: Project, id: StructureModelId | undefined): string | undefined {
  if (!id) return undefined;
  return project.models.find((m) => m.id === id)?.name;
}

export function upstreamLabelForCombine(m: PipelineModule, project: Project): StepLabel | undefined {
  const id = m.inStructureId;
  if (!id) return undefined;
  for (const mod of project.modules) {
    if (mod.outStructureId === id) return labelAsStateKey(mod.label);
  }
  return undefined;
}

// AI : mirror execExampleSelectStep formatExampleContext — field path picks {description} text.
export function generateExampleContextExprTs(ctxLabel: string, fieldPath?: string): string {
  const key = JSON.stringify(ctxLabel);
  const base = `state[${key}]`;
  if (!fieldPath?.trim()) {
    return `(typeof ${base} === "string" ? ${base} : JSON.stringify(${base}, null, 2)) as string`;
  }
  let accessor = base;
  for (const part of fieldPath.trim().split(".").filter(Boolean)) {
    accessor = `(${accessor} as Record<string, unknown>)[${JSON.stringify(part)}]`;
  }
  return `(typeof ${accessor} === "string" ? ${accessor} : JSON.stringify(${accessor}, null, 2)) as string`;
}

export function generateExampleContextLinesPy(ctxLabel: string, fieldPath?: string): string[] {
  const key = exportStringLiteral(ctxLabel);
  if (!fieldPath?.trim()) {
    return [
      `_ctx = state[${key}]`,
      `description = _ctx if isinstance(_ctx, str) else json.dumps(_ctx, indent=2, default=str)`,
    ];
  }
  const lines = [`_ctx = state[${key}]`];
  for (const part of fieldPath.trim().split(".").filter(Boolean)) {
    lines.push(
      `_ctx = (_ctx.get(${exportStringLiteral(part)}) if isinstance(_ctx, dict) else getattr(_ctx, ${exportStringLiteral(part)}, None))`,
    );
  }
  lines.push(
    `description = _ctx if isinstance(_ctx, str) else json.dumps(_ctx, indent=2, default=str)`,
  );
  return lines;
}

function inputOutputsDocument(m: PipelineModule): boolean {
  return m.outStructureId === BUILTIN_DOCUMENT_ID;
}

function tsCustomCodeParamCount(code: string): number {
  const trimmed = code.trim();
  const parenArrow = trimmed.match(/^\(\s*([^)]*)\s*\)\s*=>/);
  if (parenArrow) {
    const params = parenArrow[1]!.trim();
    if (!params) return 0;
    return params.split(",").filter((p) => p.trim()).length;
  }
  if (/^[\w$]+\s*=>/.test(trimmed)) return 1;
  return 1;
}

function generateCustomCodeStepBodyTs(code: string, inTs: string, outTs: string): string {
  const fnSrc = buildCustomFnSource(code);
  return [
    `const __compiled = new Function("return " + ${JSON.stringify(fnSrc)})() as (input: ${inTs}, state?: PipelineState) => ${outTs};`,
    `return (__compiled.length >= 2 ? __compiled(input, state) : __compiled(input)) as ${outTs};`,
  ].join("\n");
}

export function generateMergeStepBodyTs(m: PipelineModule, outTs: string): string {
  const policyJson = JSON.stringify(m.mergePolicy ?? DEFAULT_MERGE_POLICY);
  const wrapField = m.mergeWrapListField?.trim();
  const stateLabel = m.mergeStateLabel?.trim();
  const lines = [exportComment("//", "Deep-merge via shared mergeFold")];
  if (!stateLabel && !wrapField) {
    lines.push(
      "const values = Array.isArray(input) ? (input as unknown[]).filter((v) => v != null) : input != null ? [input] : [];",
      `return mergeFold(values, ${policyJson}) as ${outTs};`,
    );
    return lines.join("\n");
  }
  lines.push("let spine: unknown = input;");
  if (wrapField) {
    const wrapKey = JSON.stringify(wrapField);
    lines.push(`if (Array.isArray(spine)) spine = { [${wrapKey}]: spine };`);
  }
  lines.push("const values: unknown[] = [];");
  if (stateLabel) {
    const stateKey = JSON.stringify(stateLabel);
    lines.push(`const fromState = state[${stateKey}];`, "if (fromState != null) values.push(fromState);");
  }
  lines.push("if (spine != null) values.push(spine);", `return mergeFold(values, ${policyJson}) as ${outTs};`);
  return lines.join("\n");
}

export function generateMergeStepBodyPy(m: PipelineModule, outPy: string): string {
  const policyJson = JSON.stringify(m.mergePolicy ?? DEFAULT_MERGE_POLICY);
  const wrapField = m.mergeWrapListField?.trim();
  const stateLabel = m.mergeStateLabel?.trim();
  const lines = [exportComment("#", "Deep-merge via shared merge_fold")];
  const cast = `return cast(${outPy}, cast(object, merge_fold(values, ${policyJson})))`;
  if (!stateLabel && !wrapField) {
    lines.push(
      "values = input if isinstance(input, list) else ([input] if input is not None else [])",
      cast,
    );
    return lines.join("\n");
  }
  lines.push("spine = input");
  if (wrapField) {
    const wrapKey = JSON.stringify(wrapField);
    lines.push(`if isinstance(spine, list): spine = {${wrapKey}: spine}`);
  }
  lines.push("values: list[Any] = []");
  if (stateLabel) {
    const stateKey = JSON.stringify(stateLabel);
    lines.push(`from_state = state[${stateKey}]`, "if from_state is not None: values.append(from_state)");
  }
  lines.push("if spine is not None: values.append(spine)", cast);
  return lines.join("\n");
}

export function generateMergeStepBodyGo(m: PipelineModule, outGo: string): string {
  const policyJson = JSON.stringify(m.mergePolicy ?? DEFAULT_MERGE_POLICY);
  const wrapField = m.mergeWrapListField?.trim();
  const stateLabel = m.mergeStateLabel?.trim();
  const zero = goZeroValue(outGo);
  const lines = [
    exportComment("//", "Deep-merge via shared mergeFold"),
    `var policy any`,
    `if err := json.Unmarshal([]byte(${JSON.stringify(policyJson)}), &policy); err != nil {`,
    `\treturn ${zero}, err`,
    `}`,
    `inJSON, err := json.Marshal(input)`,
    `if err != nil {`,
    `\treturn ${zero}, err`,
    `}`,
    `var spine any`,
    `if err := json.Unmarshal(inJSON, &spine); err != nil {`,
    `\treturn ${zero}, err`,
    `}`,
  ];
  if (wrapField) {
    lines.push(
      `if _, isArr := spine.([]any); isArr {`,
      `\tspine = map[string]any{${JSON.stringify(wrapField)}: spine}`,
      `}`,
    );
  }
  lines.push(`var values []any`);
  if (stateLabel) {
    lines.push(
      `if fromState, ok := state[${JSON.stringify(stateLabel)}]; ok && len(fromState) > 0 {`,
      `\tvar v any`,
      `\tif err := json.Unmarshal(fromState, &v); err != nil {`,
      `\t\treturn ${zero}, err`,
      `\t}`,
      `\tvalues = append(values, v)`,
      `}`,
    );
  }
  if (!stateLabel && !wrapField) {
    lines.push(
      `if arr, ok := spine.([]any); ok {`,
      `\tfor _, v := range arr {`,
      `\t\tif v != nil { values = append(values, v) }`,
      `\t}`,
      `} else if spine != nil {`,
      `\tvalues = append(values, spine)`,
      `}`,
    );
  } else {
    lines.push(`if spine != nil { values = append(values, spine) }`);
  }
  lines.push(
    `merged := mergeFold(values, policy)`,
    `b, err := json.Marshal(merged)`,
    `if err != nil {`,
    `\treturn ${zero}, err`,
    `}`,
    `var out ${outGo}`,
    `if err := json.Unmarshal(b, &out); err != nil {`,
    `\treturn ${zero}, err`,
    `}`,
    `return out, nil`,
  );
  return lines.join("\n");
}

export function generateMergeStepBodyRust(m: PipelineModule, outRust: string): string {
  const policyJson = JSON.stringify(m.mergePolicy ?? DEFAULT_MERGE_POLICY);
  const wrapField = m.mergeWrapListField?.trim();
  const stateLabel = m.mergeStateLabel?.trim();
  const lines = [
    exportComment("//", "Deep-merge via shared merge_fold"),
    `let policy: Value = serde_json::from_str(${JSON.stringify(policyJson)})?;`,
    `let mut spine = serde_json::to_value(&input)?;`,
  ];
  if (wrapField) {
    lines.push(
      `if spine.is_array() {`,
      `    spine = serde_json::json!({ ${JSON.stringify(wrapField)}: spine });`,
      `}`,
    );
  }
  lines.push(`let mut values: Vec<Value> = Vec::new();`);
  if (stateLabel) {
    lines.push(
      `if let Some(from_state) = state.get(${JSON.stringify(stateLabel)}) {`,
      `    if !from_state.is_null() { values.push(from_state.clone()); }`,
      `}`,
    );
  }
  if (!stateLabel && !wrapField) {
    lines.push(
      `match spine {`,
      `    Value::Array(arr) => values.extend(arr.into_iter().filter(|v| !v.is_null())),`,
      `    Value::Null => {}`,
      `    other => values.push(other),`,
      `}`,
    );
  } else {
    lines.push(`if !spine.is_null() { values.push(spine); }`);
  }
  lines.push(
    `let merged = merge_fold(values, &policy);`,
    `let out: ${outRust} = serde_json::from_value(merged)?;`,
    `Ok(out)`,
  );
  return lines.join("\n");
}

function tsCustomCodeCall(code: string, outTs: string): string {
  return tsCustomCodeParamCount(code) <= 1
    ? `return __fn(input) as ${outTs};`
    : `return __fn(input, state) as ${outTs};`;
}

function tsCustomCodeFnDecl(code: string, inTs: string, outTs: string): string {
  const fnType =
    tsCustomCodeParamCount(code) <= 1
      ? `(input: ${inTs}) => ${outTs}`
      : `(input: ${inTs}, state: PipelineState) => ${outTs}`;
  return `const __fn: ${fnType} = ${code};`;
}

function pyCustomCodeCall(code: string, outPy: string): string {
  if (/^\s*def\s+\w+\s*\(/.test(code)) {
    return `return cast(${outPy}, cast(object, transform(input, state)))  # type: ignore[name-defined]`;
  }
  const unary = /^\(\s*input\s*\)\s*=>/.test(code) || /^\s*input\s*=>/.test(code);
  return unary
    ? `return cast(${outPy}, cast(object, __fn(input)))`
    : `return cast(${outPy}, cast(object, __fn(input, state)))`;
}

export function generateInputStepBodyTs(m: PipelineModule, outTs: string): string {
  // AI : TODO export — emit input-description LLM guard when checkInputDescription is enabled.
  const lines = [
    ...inputStepCommentLines("//", m),
    "const doc = input as Document;",
  ];
  if (inputOutputsDocument(m)) {
    const docObj = "{ content: doc.content ?? null, filename: doc.filename }";
    lines.push(stepEmitsList(m) ? `return [${docObj}];` : `return ${docObj};`);
    return lines.join("\n");
  }
  lines.push("const content = doc.content ?? \"\";");
  if (stepEmitsList(m)) {
    lines.push(`const parsed = JSON.parse(content) as unknown;`);
    lines.push(`return (Array.isArray(parsed) ? parsed : [parsed]) as ${outTs};`);
  } else {
    lines.push(`return JSON.parse(content) as ${outTs};`);
  }
  return lines.join("\n");
}

export function generateInputStepBodyPy(m: PipelineModule, outPy: string): string {
  const lines = [
    ...inputStepCommentLines("#", m),
    "doc = input",
  ];
  if (inputOutputsDocument(m)) {
    lines.push(
      stepEmitsList(m)
        ? "return [Document(content=getattr(doc, \"content\", None), filename=doc.filename)]"
        : "return Document(content=getattr(doc, \"content\", None), filename=doc.filename)",
    );
    return lines.join("\n");
  }
  lines.push("content = doc.content or \"\"");
  if (stepEmitsList(m)) {
    lines.push("parsed = json.loads(content)");
    lines.push(`return cast(${outPy}, cast(object, parsed if isinstance(parsed, list) else [parsed]))`);
  } else {
    lines.push(`return cast(${outPy}, cast(object, json.loads(content)))`);
  }
  return lines.join("\n");
}

export function generateDocToTextStepBodyTs(m: PipelineModule): string {
  const purpose = m.note?.trim() || m.label || "general transcription";
  const ocr = !!m.useOcr;
  const lines = [
    exportComment("//", "Convert to text — instantiate Document.content from docsDir (no encoded copies on Document)"),
    ...(ocr ? [exportComment("//", "DeepSeek OCR when DEEPSEEK_OCR_BASE_URL is set; OpenRouter vision fallback")] : []),
    `const convertOne = (doc: Document) => convertDocToText(doc, { ocr: ${ocr ? "true" : "false"}, purpose: ${JSON.stringify(purpose)} });`,
  ];
  if (stepEmitsList(m)) {
    lines.push("const items = Array.isArray(input) ? input : [input];");
    lines.push("return Promise.all(items.map(convertOne));");
  } else {
    lines.push("return convertOne(input as Document);");
  }
  return lines.join("\n");
}

export function generateDocToTextStepBodyPy(m: PipelineModule): string {
  const purpose = m.note?.trim() || m.label || "general transcription";
  const ocr = m.useOcr ? "True" : "False";
  const lines = [
    exportComment("#", "Convert to text — instantiate Document.content from docs_dir (no encoded copies on Document)"),
    ...(m.useOcr ? [exportComment("#", "DeepSeek OCR when deepseek_ocr_base_url is set; OpenRouter vision fallback")] : []),
  ];
  if (stepEmitsList(m)) {
    lines.push("items = input if isinstance(input, list) else [input]");
    lines.push(`return [await convert_doc_to_text(doc, ocr=${ocr}, purpose=${JSON.stringify(purpose)}) for doc in items]`);
  } else {
    lines.push(`return await convert_doc_to_text(input, ocr=${ocr}, purpose=${JSON.stringify(purpose)})`);
  }
  return lines.join("\n");
}

export function generateDocToTextStepBodyGo(m: PipelineModule, outGo: string): string {
  const zero = goZeroValue(outGo);
  return [
    exportComment("//", "Convert to text — port convertDocToText from the TS/Python runtime (read docsDir/filename; DeepSeek OCR). Do not store base64 on Document."),
    `return ${zero}, fmt.Errorf("convert to text: port convertDocToText from pipeline_runtime.ts")`,
  ].join("\n");
}

export function generateDocToTextStepBodyRust(m: PipelineModule): string {
  return [
    exportComment("//", "Convert to text — port convertDocToText from the TS/Python runtime (read docsDir/filename; DeepSeek OCR). Do not store base64 on Document."),
    "Err(anyhow::anyhow!(\"convert to text: port convertDocToText from pipeline_runtime.ts\"))",
  ].join("\n");
}

export function generateInputStepBodyRust(m: PipelineModule, outRust: string): string {
  const lines = [...inputStepCommentLines("//", m)];
  if (inputOutputsDocument(m)) {
    if (stepEmitsList(m)) {
      lines.push("Ok(vec![input])");
    } else {
      lines.push("Ok(input)");
    }
    return lines.join("\n");
  }
  lines.push("let content = input.content.as_deref().unwrap_or(\"\");");
  lines.push("let parsed: Value = serde_json::from_str(content)?;");
  if (stepEmitsList(m)) {
    lines.push(`let out: ${outRust} = if parsed.is_array() {`);
    lines.push("    serde_json::from_value(parsed)?");
    lines.push("} else {");
    lines.push("    serde_json::from_value(Value::Array(vec![parsed]))?");
    lines.push("};");
    lines.push("Ok(out)");
  } else {
    lines.push(`let out: ${outRust} = serde_json::from_value(parsed)?;`);
    lines.push("Ok(out)");
  }
  return lines.join("\n");
}

export function generateInputStepBodyGo(m: PipelineModule, outGo: string): string {
  const zero = goZeroValue(outGo);
  const lines = [...inputStepCommentLines("//", m)];
  if (inputOutputsDocument(m)) {
    if (stepEmitsList(m)) {
      lines.push("return []Document{input}, nil");
    } else {
      lines.push("return input, nil");
    }
    return lines.join("\n");
  }
  lines.push("if input.Content == nil || *input.Content == \"\" {");
  lines.push(`\treturn ${zero}, fmt.Errorf("input content is empty")`);
  lines.push("}");
  lines.push("var parsed any");
  lines.push("if err := json.Unmarshal([]byte(*input.Content), &parsed); err != nil {");
  lines.push(`\treturn ${zero}, err`);
  lines.push("}");
  if (stepEmitsList(m)) {
    lines.push("arr, ok := parsed.([]any)");
    lines.push("if !ok {");
    lines.push("\tarr = []any{parsed}");
    lines.push("}");
    lines.push("b, err := json.Marshal(arr)");
    lines.push("if err != nil {");
    lines.push(`\treturn ${zero}, err`);
    lines.push("}");
  } else {
    lines.push("b, err := json.Marshal(parsed)");
    lines.push("if err != nil {");
    lines.push(`\treturn ${zero}, err`);
    lines.push("}");
  }
  lines.push(`var out ${outGo}`);
  lines.push("if err := json.Unmarshal(b, &out); err != nil {");
  lines.push(`\treturn ${zero}, err`);
  lines.push("}");
  lines.push("return out, nil");
  return lines.join("\n");
}

// AI : the side input (or its auto parse llm) directly precedes the combine — its emitted
// AI : structure lands in matching ref fields, mirroring execCombineStep.
function combineSideStructId(m: PipelineModule, project: Project): StructureModelId | undefined {
  const i = project.modules.findIndex((x) => x.id === m.id);
  const id = i > 0 ? project.modules[i - 1]?.outStructureId : undefined;
  return id && id !== BUILTIN_DOCUMENT_ID && id !== m.inStructureId ? id : undefined;
}

function combineSideIsList(
  f: { type: FieldType; ref?: StructureModelId; typeExpr?: import("./types").TypeExpr },
  sideId: StructureModelId | undefined,
): boolean {
  if (!sideId) return false;
  const expr = fieldToTypeExpr(f);
  return expr.kind === "list" && expr.item.kind === "ref" && expr.item.modelId === sideId;
}

export function generateCombineStepBodyTs(m: PipelineModule, project: Project, outTs: string): string {
  const out = project.models.find((x) => x.id === m.outStructureId);
  const inName = modelName(project, m.inStructureId);
  const sideId = combineSideStructId(m, project);
  const upstreamLabel = upstreamLabelForCombine(m, project);
  // AI : always a string literal — comment placeholders are invalid as index expressions.
  const upstreamKey = JSON.stringify(upstreamLabel ?? "upstream");
  const fieldExprs =
    out?.fields.map((f) => {
      if (f.type === FieldType.Document) return `${f.name}: newDoc as Document`;
      if (sideId && f.ref === sideId) {
        const name = modelName(project, sideId);
        // AI : list side-inputs stay arrays — runtime combine does not unwrap ListModel fields.
        if (combineSideIsList(f, sideId)) {
          return `${f.name}: (Array.isArray(input) ? input : [newDoc]) as ${name}[]`;
        }
        return `${f.name}: newDoc as ${name}`;
      }
      // AI : missing upstream label → index via Record so tsc still accepts the fallback key.
      return upstreamLabel
        ? `${f.name}: state[${upstreamKey}]`
        : `${f.name}: (state as Record<string, unknown>)[${upstreamKey}]`;
    }) ?? [];
  return [
    exportComment("//", mergeUpstreamComment(inName)),
    "const newDoc = Array.isArray(input) ? input[0] : input;",
    `const merged = { ${fieldExprs.join(", ")} };`,
    `return merged as ${outTs};`,
  ].join("\n");
}

function assembleFieldExprTs(source: import("./types").AssembleSource): string {
  if (source.kind === "spine") return "input";
  if (source.kind === "state") return `state[${JSON.stringify(source.label.trim())}]`;
  const root =
    source.from === "spine" ? "input" : `state[${JSON.stringify(source.from.label.trim())}]`;
  const parts = source.path.split(".").map((p) => p.trim()).filter(Boolean);
  return parts.reduce((acc, part) => `(${acc} as Record<string, unknown>)[${JSON.stringify(part)}]`, root);
}

export function generateAssembleStepBodyTs(m: PipelineModule, project: Project, outTs: string): string {
  const bindings = m.assembleBindings ?? {};
  const fieldExprs = Object.entries(bindings).map(
    ([name, source]) => `${name}: ${assembleFieldExprTs(source)}`,
  );
  const poly = assemblePolymorphicTsSignature(m.outType, bindings, project.typeAliases ?? []);
  const lines = [
    exportComment("//", assembleZipComment()),
    ...(poly ? [`// polymorphic shape ${poly}`] : []),
    `const assembled = { ${fieldExprs.join(", ")} };`,
    `return assembled as ${outTs};`,
  ];
  return lines.join("\n");
}

export function generateAssembleStepBodyPy(m: PipelineModule, _project: Project, outPy: string): string {
  const bindings = m.assembleBindings ?? {};
  const fieldExprs = Object.entries(bindings).map(([name, source]) => {
    let rhs: string
    if (source.kind === "spine") rhs = "input"
    else if (source.kind === "state") rhs = `state[${JSON.stringify(source.label.trim())}]`
    else {
      const root =
        source.from === "spine" ? "input" : `state[${JSON.stringify(source.from.label.trim())}]`
      const parts = source.path.split(".").map((p) => p.trim()).filter(Boolean)
      rhs = root
      for (const part of parts) {
        rhs = `(${rhs}.get(${JSON.stringify(part)}) if isinstance(${rhs}, dict) else getattr(${rhs}, ${JSON.stringify(part)}, None))`
      }
    }
    return `"${name}": ${rhs}`;
  });
  return [
    exportComment("#", assembleZipComment()),
    `return cast(${outPy}, cast(object, {${fieldExprs.join(", ")}}))`,
  ].join("\n");
}

export function generateParallelStepBodyTs(m: PipelineModule, project: Project, outTs: string): string {
  const branches = (m.parallelBranches ?? []).filter((b) => b.field.trim());
  const calls = branches.map((b) => {
    const schema = exportSchemaExprTs(exportLlmSchemaJson(project, b.outStructureId, false));
    return `${JSON.stringify(b.field.trim())}: await llmStructured(${JSON.stringify(b.prompt || "Process the input.")} + "\\n\\nINPUT DATA:\\n" + JSON.stringify(input), ${schema} as never)`;
  });
  return [
    exportComment("//", parallelBranchesComment()),
    `const assembled = { ${calls.join(", ")} };`,
    `return assembled as ${outTs};`,
  ].join("\n");
}

export function generateParallelStepBodyPy(m: PipelineModule, project: Project, outPy: string): string {
  const branches = (m.parallelBranches ?? []).filter((b) => b.field.trim());
  const entries = branches.map((b) => {
    const prompt = JSON.stringify(b.prompt || "Process the input.");
    const schema = exportSchemaExprPy(exportLlmSchemaJson(project, b.outStructureId, false));
    return `    ${JSON.stringify(b.field.trim())}: await llm_structured(${prompt} + "\\n\\nINPUT DATA:\\n" + json.dumps(input, default=str), ${schema}),`;
  });
  return [
    exportComment("#", parallelBranchesComment()),
    "assembled = {",
    ...entries,
    "}",
    `return cast(${outPy}, cast(object, assembled))`,
  ].join("\n");
}

export function generateParallelStepBodyRust(m: PipelineModule, project: Project, outRust: string): string {
  const branches = (m.parallelBranches ?? []).filter((b) => b.field.trim());
  const inserts = branches.map((b) => {
    const prompt = exportStringLiteral(b.prompt || "Process the input.");
    const schema = exportSchemaExprRust(exportLlmSchemaJson(project, b.outStructureId, false));
    return [
      `{`,
      `    let prompt = format!("{}\\n\\nINPUT DATA:\\n{}", ${prompt}, serde_json::to_string_pretty(&input)?);`,
      `    let schema = ${schema};`,
      `    let value = llm_structured(&prompt, &schema).await?;`,
      `    map.insert(${JSON.stringify(b.field.trim())}.to_string(), value);`,
      `}`,
    ].join("\n");
  });
  return [
    exportComment("//", parallelBranchesComment()),
    "let mut map = serde_json::Map::new();",
    ...inserts,
    `let out: ${outRust} = serde_json::from_value(Value::Object(map))?;`,
    "Ok(out)",
  ].join("\n");
}

export function generateParallelStepBodyGo(m: PipelineModule, project: Project, outGo: string): string {
  const branches = (m.parallelBranches ?? []).filter((b) => b.field.trim());
  const zero = `*new(${outGo})`;
  const assigns = branches.flatMap((b) => {
    const prompt = exportStringLiteral(b.prompt || "Process the input.");
    const field = JSON.stringify(b.field.trim());
    const schema = exportSchemaExprGo(exportLlmSchemaJson(project, b.outStructureId, false));
    return [
      `{`,
      `\tinJSON, err := json.MarshalIndent(input, "", "  ")`,
      `\tif err != nil {`,
      `\t\treturn ${zero}, err`,
      `\t}`,
      `\tuserPrompt := ${prompt} + "\\n\\nINPUT DATA:\\n" + string(inJSON)`,
      `\tschema := ${schema}`,
      `\tvalue, err := llmStructured(userPrompt, schema)`,
      `\tif err != nil {`,
      `\t\treturn ${zero}, err`,
      `\t}`,
      `\tvar decoded any`,
      `\tif err := json.Unmarshal(value, &decoded); err != nil {`,
      `\t\treturn ${zero}, err`,
      `\t}`,
      `\tpayload[${field}] = decoded`,
      `}`,
    ];
  });
  return [
    exportComment("//", parallelBranchesComment()),
    "payload := map[string]any{}",
    ...assigns,
    "b, err := json.Marshal(payload)",
    "if err != nil {",
    `\treturn ${zero}, err`,
    "}",
    `var merged ${outGo}`,
    "if err := json.Unmarshal(b, &merged); err != nil {",
    `\treturn ${zero}, err`,
    "}",
    "return merged, nil",
  ].join("\n");
}

export function generateAssembleStepBodyRust(m: PipelineModule, project: Project, outRust: string): string {
  const bindings = m.assembleBindings ?? {};
  const rawOutName = modelName(project, m.outStructureId);
  const outName = rawOutName ? modelExportIdentifierRust(rawOutName) : outRust;
  const inserts = Object.entries(bindings).map(([name, source]) => {
    let rhs: string;
    if (source.kind === "spine") rhs = "serde_json::to_value(&input)?";
    else if (source.kind === "state") {
      rhs = `state.get(${JSON.stringify(source.label.trim())}).cloned().unwrap_or(Value::Null)`;
    } else {
      const root =
        source.from === "spine"
          ? "serde_json::to_value(&input)?"
          : `state.get(${JSON.stringify(source.from.label.trim())}).cloned().unwrap_or(Value::Null)`;
      const parts = source.path.split(".").map((p) => p.trim()).filter(Boolean);
      rhs = root;
      for (const part of parts) {
        rhs = `(${rhs}).get(${JSON.stringify(part)}).cloned().unwrap_or(Value::Null)`;
      }
    }
    return `map.insert(${JSON.stringify(name)}.to_string(), ${rhs});`;
  });
  return [
    exportComment("//", assembleZipComment()),
    "let mut map = serde_json::Map::new();",
    ...inserts,
    `let out: ${outName} = serde_json::from_value(Value::Object(map))?;`,
    "Ok(out)",
  ].join("\n");
}

export function generateAssembleStepBodyGo(m: PipelineModule, project: Project, outGo: string): string {
  const bindings = m.assembleBindings ?? {};
  const zero = `*new(${outGo})`;
  const preambles: string[] = [];
  const assigns = Object.entries(bindings).map(([name, source], i) => {
    const tmp = `__asm${i}`;
    if (source.kind === "spine") {
      preambles.push(`${tmp} := any(input)`);
    } else if (source.kind === "state") {
      preambles.push(`${tmp} := state[${JSON.stringify(source.label.trim())}]`);
    } else {
      const root =
        source.from === "spine" ? "any(input)" : `state[${JSON.stringify(source.from.label.trim())}]`;
      preambles.push(`${tmp} := ${root}`);
      const parts = source.path.split(".").map((p) => p.trim()).filter(Boolean);
      for (const part of parts) {
        preambles.push(
          `if __m, ok := ${tmp}.(map[string]any); ok { ${tmp} = __m[${JSON.stringify(part)}] } else { ${tmp} = nil }`,
        );
      }
    }
    return `\t${JSON.stringify(name)}: ${tmp},`;
  });
  return [
    exportComment("//", assembleZipComment()),
    ...preambles,
    "payload := map[string]any{",
    ...assigns,
    "}",
    "b, err := json.Marshal(payload)",
    "if err != nil {",
    `\treturn ${zero}, err`,
    "}",
    `var merged ${outGo}`,
    "if err := json.Unmarshal(b, &merged); err != nil {",
    `\treturn ${zero}, err`,
    "}",
    "return merged, nil",
  ].join("\n");
}

export function generateCombineStepBodyPy(
  m: PipelineModule,
  project: Project,
  outPy: string,
  inPy: string,
): string {
  const out = project.models.find((x) => x.id === m.outStructureId);
  const inName = modelName(project, m.inStructureId);
  const sideId = combineSideStructId(m, project);
  const upstreamLabel = upstreamLabelForCombine(m, project);
  // AI : always a string literal — comment placeholders are invalid as index expressions.
  const upstreamKey = JSON.stringify(upstreamLabel ?? "upstream");
  const fieldExprs =
    out?.fields.map((f) => {
      if (f.type === FieldType.Document) return `"${f.name}": new_doc`;
      if (sideId && f.ref === sideId) {
        if (combineSideIsList(f, sideId)) {
          return `"${f.name}": input if isinstance(input, list) else [new_doc]`;
        }
        return `"${f.name}": new_doc`;
      }
      return `"${f.name}": state[${upstreamKey}]`;
    }) ?? [];
  // AI : skip isinstance when the spine type is already a list.
  const unwrap = inPy.startsWith("list[") ? "new_doc = input[0]" : "new_doc = input";
  // AI : cast via object — dict literals are not TypedDict/BaseModel-compatible under strict pyright.
  return [
    exportComment("#", mergeUpstreamComment(inName)),
    unwrap,
    `return cast(${outPy}, cast(object, {${fieldExprs.join(", ")}}))`,
  ].join("\n");
}

export function generateCombineStepBodyRust(m: PipelineModule, project: Project, outRust: string, inRust: string): string {
  const out = project.models.find((x) => x.id === m.outStructureId);
  const inName = modelName(project, m.inStructureId);
  const sideId = combineSideStructId(m, project);
  const upstreamLabel = upstreamLabelForCombine(m, project);
  const upstreamKey = upstreamLabel ? JSON.stringify(upstreamLabel) : '"upstream"';
  const rawOutName = modelName(project, m.outStructureId);
  const outName = rawOutName ? modelExportIdentifierRust(rawOutName) : outRust;
  const hasListSide = !!out?.fields.some((f) => combineSideIsList(f, sideId));
  const fieldExprs =
    out?.fields.map((f) => {
      const fname = rustFieldIdent(f.name).ident;
      if (f.type === FieldType.Document) return `        ${fname}: new_doc.clone(),`;
      if (sideId && f.ref === sideId) {
        if (combineSideIsList(f, sideId)) {
          const listExpr = inRust.startsWith("Vec<") ? "&input" : "&vec![new_doc.clone()]";
          return `        ${fname}: serde_json::from_value(serde_json::to_value(${listExpr})?)?,`;
        }
        return `        ${fname}: serde_json::from_value(serde_json::to_value(&new_doc)?)?,`;
      }
      return `        ${fname}: serde_json::from_value(state.get(${upstreamKey}).cloned().unwrap_or(Value::Null))?,`;
    }) ?? [];
  // AI : clone the first item when a list side-field still needs the full Vec.
  const unwrap = inRust.startsWith("Vec<")
    ? hasListSide
      ? 'let new_doc = input.first().cloned().ok_or_else(|| anyhow::anyhow!("combine expects at least one document"))?;'
      : 'let new_doc = input.into_iter().next().ok_or_else(|| anyhow::anyhow!("combine expects at least one document"))?;'
    : "let new_doc = input;";
  return [
    exportComment("//", mergeUpstreamComment(inName)),
    unwrap,
    `let merged = ${outName} {`,
    ...fieldExprs,
    "};",
    "Ok(merged)",
  ].join("\n");
}

export function generateCombineStepBodyGo(
  m: PipelineModule,
  project: Project,
  outGo: string,
  inGo: string,
): string {
  const out = project.models.find((x) => x.id === m.outStructureId);
  const inName = modelName(project, m.inStructureId);
  const sideId = combineSideStructId(m, project);
  const upstreamLabel = upstreamLabelForCombine(m, project);
  const upstreamKey = upstreamLabel ? JSON.stringify(upstreamLabel) : '"upstream"';
  const rawOutName = modelName(project, m.outStructureId);
  const outName = rawOutName ? modelExportIdentifierGo(rawOutName) : outGo;
  const zero = goZeroValue(outGo);
  const fieldEntries =
    out?.fields.map((f) => {
      if (f.type === FieldType.Document) {
        return `\t\t${JSON.stringify(f.name)}: newDoc,`;
      }
      if (sideId && f.ref === sideId) {
        if (combineSideIsList(f, sideId)) {
          return `\t\t${JSON.stringify(f.name)}: input,`;
        }
        return `\t\t${JSON.stringify(f.name)}: newDoc,`;
      }
      return `\t\t${JSON.stringify(f.name)}: state[${upstreamKey}],`;
    }) ?? [];
  const unwrap = inGo.startsWith("[]")
    ? [
        "if len(input) == 0 {",
        `\treturn ${zero}, fmt.Errorf("combine expects at least one document")`,
        "}",
        "newDoc := input[0]",
      ].join("\n")
    : "newDoc := input";
  return [
    exportComment("//", mergeUpstreamComment(inName)),
    unwrap,
    "payload := map[string]any{",
    ...fieldEntries,
    "}",
    "b, err := json.Marshal(payload)",
    "if err != nil {",
    `\treturn ${zero}, err`,
    "}",
    `var merged ${outName}`,
    "if err := json.Unmarshal(b, &merged); err != nil {",
    `\treturn ${zero}, err`,
    "}",
    "return merged, nil",
  ].join("\n");
}

export type OrchestratorLang = "ts" | "py" | "rs" | "go";

function orchestratorInputMods(project: Project): PipelineModule[] {
  return orderedInputModules(project.modules);
}

function orchestratorInvokeLine(
  m: PipelineModule,
  fn: string,
  lang: OrchestratorLang,
  singleInput: boolean,
  inTs: string,
): string {
  const label = labelAsStateKey(m.label);
  if (lang === "go") {
    if (m.kind !== ModuleKind.Input) {
      return [
        `    var _in_${fn} ${inTs}`,
        `    if err := json.Unmarshal(spine, &_in_${fn}); err != nil {`,
        "        return nil, err",
        "    }",
        `    _out_${fn}, err := ${fn}(_in_${fn}, state)`,
        "    if err != nil {",
        "        return nil, err",
        "    }",
        `    spine, err = json.Marshal(_out_${fn})`,
        "    if err != nil {",
        "        return nil, err",
        "    }",
      ].join("\n");
    }
    const inputExpr = singleInput
      ? "initialInput"
      : `inputs[${JSON.stringify(label)}]`;
    return [
      `    _out_${fn}, err := ${fn}(${inputExpr}, state)`,
      "    if err != nil {",
      "        return nil, err",
      "    }",
      `    spine, err = json.Marshal(_out_${fn})`,
      "    if err != nil {",
      "        return nil, err",
      "    }",
    ].join("\n");
  }
  if (lang === "rs") {
    if (m.kind !== ModuleKind.Input) {
      return `    spine = serde_json::to_value(${fn}(serde_json::from_value(spine)?, &mut state).await?)?;`;
    }
    if (singleInput) {
      return `    spine = serde_json::to_value(${fn}(initial_input, &mut state).await?)?;`;
    }
    return `    spine = serde_json::to_value(${fn}(inputs.get(${JSON.stringify(label)}).cloned().ok_or_else(|| anyhow::anyhow!("missing input"))?, &mut state).await?)?;`;
  }
  if (m.kind !== ModuleKind.Input) {
    return lang === "ts"
      ? `  spine = await ${fn}(spine as ${inTs}, state);`
      : `    spine = await ${fn}(spine, state)`;
  }
  if (singleInput) {
    return lang === "ts" ? `  spine = await ${fn}(initialInput, state);` : `    spine = await ${fn}(initial_input, state)`;
  }
  const key = JSON.stringify(label);
  return lang === "ts"
    ? `  spine = await ${fn}(inputs[${key}], state);`
    : `    spine = await ${fn}(inputs[${key}], state)`;
}

// AI : TODO (arch-export-orchestrator) — Ts/Py/Rust/Go walk the same spine; one IR then printers.
// AI : TODO (allow-pipeline-non-linear-fork) — Fork → Promise.all of lane IIFEs then join (ts/py/go/rs).
export function generateOrchestratorTs(project: Project, stepFnName: (m: PipelineModule, i: number) => string): string {
  const inputMods = orchestratorInputMods(project);
  const multi = inputMods.length > 1;
  const lines: string[] = [
    "export type PipelineStepTraceEntry = { label: string; output: unknown };",
    "",
    "let lastRunTrace: PipelineStepTraceEntry[] = [];",
    "",
    "export function getLastRunTrace(): PipelineStepTraceEntry[] {",
    "  return lastRunTrace;",
    "}",
    "",
    "function snapshotTraceOutput(value: unknown): unknown {",
    "  return JSON.parse(JSON.stringify(value));",
    "}",
    "",
  ];

  if (multi) {
    lines.push("export type PipelineRunInputs = {");
    for (const m of inputMods) {
      lines.push(`  ${JSON.stringify(labelAsStateKey(m.label))}: Document;`);
    }
    lines.push("};", "");
    lines.push("export async function runPipeline(inputs: PipelineRunInputs): Promise<unknown> {");
  } else {
    lines.push("export async function runPipeline(initialInput: Document): Promise<unknown> {");
  }

  lines.push(
    "  lastRunTrace = [];",
    "  const state = {} as PipelineState;",
    "  let spine: unknown;",
    "",
  );

  for (let i = 0; i < project.modules.length; i++) {
    const m = project.modules[i]!;
    const fn = stepFnName(m, i);
    const label = labelAsStateKey(m.label);
    const outTs = exportSpineOutTs(m, project, i);
    const inTs = exportSpineInTs(m, project, i);
    lines.push(`  // ${i + 1}. ${m.label}`);
    lines.push(orchestratorInvokeLine(m, fn, "ts", !multi, inTs));
    if (label) {
      lines.push(`  state[${JSON.stringify(label)}] = spine as ${outTs};`);
      lines.push(
        `  lastRunTrace.push({ label: ${JSON.stringify(label)}, output: snapshotTraceOutput(spine) });`,
      );
    }
    lines.push("");
  }

  lines.push("  return spine;", "}", "");
  return lines.join("\n");
}

export function generateOrchestratorPy(project: Project, stepFnName: (m: PipelineModule, i: number) => string): string {
  // AI : TODO (allow-pipeline-non-linear-fork) — same Promise.all + join as generateOrchestratorTs.
  const inputMods = orchestratorInputMods(project);
  const multi = inputMods.length > 1;
  const lines: string[] = [
    "last_run_trace: list[dict[str, Any]] = []",
    "",
    "def get_last_run_trace() -> list[dict[str, Any]]:",
    "    return last_run_trace",
    "",
  ];

  if (multi) {
    lines.push("async def run_pipeline(inputs: dict[str, Document]) -> Any:");
  } else {
    lines.push("async def run_pipeline(initial_input: Document) -> Any:");
  }

  lines.push(
    "    global last_run_trace",
    "    last_run_trace = []",
    "    state = cast(PipelineState, cast(object, {}))",
    "    spine: Any = None",
    "",
  );

  for (let i = 0; i < project.modules.length; i++) {
    const m = project.modules[i]!;
    const fn = stepFnName(m, i);
    const label = labelAsStateKey(m.label);
    const inTs = exportSpineInPy(m, project, i);
    lines.push(`    # ${i + 1}. ${m.label}`);
    lines.push(orchestratorInvokeLine(m, fn, "py", !multi, inTs));
    if (label) {
      lines.push(`    state[${JSON.stringify(label)}] = spine`);
      lines.push(
        `    last_run_trace.append({"label": ${JSON.stringify(label)}, "output": json.loads(json.dumps(spine, default=str))})`,
      );
    }
    lines.push("");
  }

  lines.push("    return spine", "");
  return lines.join("\n");
}

// AI : async Rust orchestrator — spine as Value between steps for open typing.
// AI : TODO (allow-pipeline-non-linear-fork) — tokio::join! / futures per lane then join (same as TS Promise.all).
export function generateOrchestratorRust(project: Project, stepFnName: (m: PipelineModule, i: number) => string): string {
  const inputMods = orchestratorInputMods(project);
  const multi = inputMods.length > 1;
  const lines: string[] = [];

  if (multi) {
    lines.push("pub async fn run_pipeline(inputs: HashMap<String, Document>) -> anyhow::Result<Value> {");
  } else {
    lines.push("pub async fn run_pipeline(initial_input: Document) -> anyhow::Result<Value> {");
  }

  lines.push("    let mut state: PipelineState = HashMap::new();", "    let mut spine: Value;", "");

  for (let i = 0; i < project.modules.length; i++) {
    const m = project.modules[i]!;
    const fn = stepFnName(m, i);
    const label = labelAsStateKey(m.label);
    const inRust = exportSpineInRust(m, project, i);
    lines.push(`    // ${i + 1}. ${m.label}`);
    lines.push(orchestratorInvokeLine(m, fn, "rs", !multi, inRust));
    if (label) {
      if (m.kind === ModuleKind.Input) {
        lines.push(`    state.insert(${JSON.stringify(label)}.to_string(), spine.clone());`);
      } else {
        lines.push(`    state.insert(${JSON.stringify(label)}.to_string(), spine.clone());`);
      }
    }
    lines.push("");
  }

  lines.push("    Ok(spine)", "}", "");
  return lines.join("\n");
}

// AI : Go orchestrator — spine as json.RawMessage between steps for open typing.
// AI : TODO (allow-pipeline-non-linear-fork) — errgroup per lane then join (same as TS Promise.all).
export function generateOrchestratorGo(project: Project, stepFnName: (m: PipelineModule, i: number) => string): string {
  const inputMods = orchestratorInputMods(project);
  const multi = inputMods.length > 1;
  const lines: string[] = [];

  if (multi) {
    lines.push("func RunPipeline(inputs map[string]Document) (json.RawMessage, error) {");
  } else {
    lines.push("func RunPipeline(initialInput Document) (json.RawMessage, error) {");
  }

  lines.push("    state := make(PipelineState)", "    var spine json.RawMessage", "    var err error", "");

  for (let i = 0; i < project.modules.length; i++) {
    const m = project.modules[i]!;
    const fn = stepFnName(m, i);
    const label = labelAsStateKey(m.label);
    const inGo = exportSpineInGo(m, project, i);
    lines.push(`    // ${i + 1}. ${m.label}`);
    lines.push(orchestratorInvokeLine(m, fn, "go", !multi, inGo));
    if (label) {
      lines.push(`    state[${JSON.stringify(label)}] = append(json.RawMessage(nil), spine...)`);
    }
    lines.push("");
  }

  lines.push("    return spine, nil", "}", "");
  return lines.join("\n");
}

export { generateCustomCodeStepBodyTs, tsCustomCodeCall, tsCustomCodeFnDecl, pyCustomCodeCall };

// AI : block exports that reference runtime secrets or env wiring.
// AI : TODO export — optional Supabase hooks in orchestrator (persist run metadata + per-step spine snapshots).
// AI : TODO export — emit cache lookup/store around LLM steps when module.cached or runtime.enableCache is set.
const ENV_ACCESS_PATTERNS: RegExp[] = [
  /\bprocess\.env\b/,
  /\bprocess\[["']env["']\]/,
  /\bos\.environ\b/,
  /\bos\.getenv\s*\(/,
  /\bos\.Getenv\b/,
  /\bgetenv\s*\(/,
  /\bDeno\.env\b/,
  /\bimport\.meta\.env\b/,
  /\bstd::env::/,
  /\benv::var\b/,
];

const ENV_KEY_NAME_PATTERNS: RegExp[] = [
  /\bSUPABASE_[A-Z0-9_]+\b/,
  /\bNEXT_PUBLIC_SUPABASE_[A-Z0-9_]+\b/,
  /\bOPENROUTER_[A-Z0-9_]+\b/,
  /\bSTRIPE_[A-Z0-9_]+\b/,
  /\bOPENROUTER_API_KEY\b/,
  /\bSUPABASE_SERVICE_ROLE_KEY\b/,
  /\bSTRIPE_SECRET_KEY\b/,
  /\bSTRIPE_WEBHOOK_SECRET\b/,
  /\bSEED_USER_ID\b/,
];

const SECRET_VALUE_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9]{20,}\b/,
  /\bsb_[A-Za-z0-9_-]{20,}\b/,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
];

// AI : .env.example placeholders — empty assignment or public URL, not live secrets.
const ENV_KEY_EMPTY_ASSIGNMENT = /^\s*=\s*(""|''|)\s*(?:#.*)?(?:\r?\n|$)/;
const ENV_KEY_PUBLIC_URL_ASSIGNMENT = /^\s*=\s*"https?:\/\//;

function isAllowedEnvKeyMention(source: string, matchIndex: number, matchLength: number): boolean {
  const after = source.slice(matchIndex + matchLength);
  if (!/^\s*=/.test(after)) return true;
  return ENV_KEY_EMPTY_ASSIGNMENT.test(after) || ENV_KEY_PUBLIC_URL_ASSIGNMENT.test(after);
}

function envKeyNameLeaks(source: string): string[] {
  const hits = new Set<string>();
  for (const re of ENV_KEY_NAME_PATTERNS) {
    const global = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    let match: RegExpExecArray | null;
    while ((match = global.exec(source)) !== null) {
      if (isAllowedEnvKeyMention(source, match.index, match[0].length)) continue;
      hits.add(re.source);
      break;
    }
  }
  return [...hits];
}

export function findEnvLeaksInExport(source: string): string[] {
  const hits = new Set<string>();
  for (const re of ENV_ACCESS_PATTERNS) {
    if (re.test(source)) hits.add(re.source);
  }
  for (const leak of envKeyNameLeaks(source)) hits.add(leak);
  for (const re of SECRET_VALUE_PATTERNS) {
    if (re.test(source)) hits.add(re.source);
  }
  return [...hits];
}

export function assertNoEnvKeysInExport(source: string): void {
  const leaks = findEnvLeaksInExport(source);
  if (leaks.length) {
    throw new Error(
      `Pipeline export blocked: output contains env or secret patterns (${leaks.slice(0, 4).join(", ")}${leaks.length > 4 ? ", …" : ""}). Remove them from step code or prompts before exporting.`,
    );
  }
}
