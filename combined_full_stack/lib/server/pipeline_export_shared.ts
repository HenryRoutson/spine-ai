import { exampleSelectAcceptsWrapper } from "@/lib/example-select";
import { orderedInputModules } from "@/lib/inference-input";
import { buildCustomFnSource } from "@/lib/custom_code";
import { customCodeEntriesForModule } from "@/lib/custom_code_entries";
import { DEFAULT_MERGE_POLICY } from "@/lib/merger";
import { usesPassthroughStructure } from "@/lib/module-kinds";
import { modelExportIdentifierGo, modelExportIdentifierRust, rustFieldIdent } from "@/lib/structure-shape";
import { webhookStepUsesPipelineState } from "@/lib/webhook-step";
import { quoteFieldPaths } from "./quote_schema";
import { BUILTIN_DOCUMENT_ID, withSharedModels } from "./builtin_models";
import { labelAsStateKey } from "./pipeline_state";
import { forkBranchesOf, forkJoinOf, forkProductField, isControlJoinKind, isExclusiveKind, laneLastModule, locatePipelineModule, flattenPipelineModules } from "@/lib/fork-pipeline";
import { ifElseBranch, ifThenBranch } from "@/lib/if-else-pipeline";
import { isDefaultCaseMatch } from "@/lib/case-pipeline";
import { followingControlJoin } from "@/lib/exclusive-control";
import { FieldType, ModuleKind } from "./types";
import { migrateProjectModules } from "./validity";
import {
  fieldToTypeExpr,
  labelToPyKey,
  modelName as typeExprModelName,
  stepEmitsList,
  stepSpineInType,
  stepSpineOutType,
  typeExprToGo,
  typeExprToPy,
  typeExprToRust,
  typeExprToTs,
} from "./type_expr";
import { assemblePolymorphicTsSignature } from "@/lib/type-expr-polymorph";
import { llmSchema } from "./structure";
import { z } from "zod";
import type { StepLabel } from "../run-types";
import type { PipelineModule, Project, StructureModelId, TypeExpr } from "./types";

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

// AI : fork product join reads state, not the spine param — prefix unused input as _input for tsc.
export function stepBodyUsesInput(style: ExportCommentStyle, body: string): boolean {
  return body
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(style))
    .some((line) => /\binput\b/.test(line));
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

function quoteExportArgs(project: Project, m: PipelineModule): { paths: string[]; isList: boolean } {
  const model = project.models.find((x) => x.id === m.outStructureId);
  return {
    paths: model ? quoteFieldPaths(model, project.models) : [],
    isList: stepEmitsList(m),
  };
}

export function generateQuoteStepBodyTs(m: PipelineModule, project: Project, outTs: string): string {
  const { paths, isList } = quoteExportArgs(project, m);
  return [
    exportComment("//", quoteLinkComment()),
    `return resolveQuotes(input, "", "", ${JSON.stringify(paths)}, ${isList}) as unknown as ${outTs};`,
  ].join("\n");
}

export function generateQuoteStepBodyPy(m: PipelineModule, project: Project, outPy: string): string {
  const { paths, isList } = quoteExportArgs(project, m);
  return [
    exportComment("#", quoteLinkComment()),
    `return cast(${outPy}, cast(object, resolve_quotes(input, "", "", ${JSON.stringify(paths)}, ${isList ? "True" : "False"})))`,
  ].join("\n");
}

export function generateQuoteStepBodyGo(m: PipelineModule, project: Project, outGo: string): string {
  const { paths, isList } = quoteExportArgs(project, m);
  const zero = goZeroValue(outGo);
  return [
    exportComment("//", quoteLinkComment()),
    `linked, err := resolveQuotes(input, "", "", []string{${paths.map((p) => JSON.stringify(p)).join(", ")}}, ${isList})`,
    "if err != nil {",
    `\treturn ${zero}, err`,
    "}",
    `var out ${outGo}`,
    "if err := json.Unmarshal(linked, &out); err != nil {",
    `\treturn ${zero}, err`,
    "}",
    "return out, nil",
  ].join("\n");
}

export function generateQuoteStepBodyRust(m: PipelineModule, project: Project, outRust: string): string {
  const { paths, isList } = quoteExportArgs(project, m);
  return [
    exportComment("//", quoteLinkComment()),
    `let linked = resolve_quotes(&input, "", "", &[${paths.map((p) => `${JSON.stringify(p)}.to_string()`).join(", ")}], ${isList})?;`,
    `let out: ${outRust} = serde_json::from_value(linked)?;`,
    "Ok(out)",
  ].join("\n");
}

export function parallelBranchesComment(): string {
  return "Parallel LLM branches — run concurrently then join (see runtime)";
}

export function forkJoinComment(): string {
  return "Fork join — lanes already wrote state; zip/assemble/merge here";
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

export function sqlStepComment(): string {
  return "Hosted app SQL — SELECT/UPDATE/INSERT against Spine app_sql_rows";
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
  // AI : fork lanes — prev is the lane predecessor, not top-level modules[index - 1].
  const loc = locatePipelineModule(project.modules, m.id);
  const prev = loc?.predecessor ?? (index > 0 ? project.modules[index - 1] : undefined);
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
  if (usesPassthroughStructure(m.kind)) {
    const loc = locatePipelineModule(project.modules, m.id);
    const prev = loc?.predecessor ?? (index > 0 ? project.modules[index - 1] : undefined);
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
  const flat = flattenPipelineModules(project.modules);
  for (let i = 0; i < flat.length; i++) {
    const m = flat[i]!;
    const label = labelAsStateKey(m.label);
    if (!label) continue;
    lines.push(`  ${JSON.stringify(label)}: ${exportSpineOutTs(m, project, i)};`);
  }
  if (!lines.length) return "export type PipelineState = Record<string, never>;";
  return `export type PipelineState = {\n${lines.join("\n")}\n};`;
}

export function pipelineStatePyTypedDictForExport(project: Project): string {
  const entries: string[] = [];
  const flat = flattenPipelineModules(project.modules);
  for (let i = 0; i < flat.length; i++) {
    const m = flat[i]!;
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
  return typeExprModelName(project.models, id);
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
    const schema = exportLlmSchemaJson(project, b.outStructureId, false);
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

function forkLaneLastLabels(m: PipelineModule): string[] {
  return forkBranchesOf(m).flatMap((b) => {
    const last = laneLastModule(b);
    if (!last) return [];
    return [last.label.trim()];
  });
}

function forkLaneLastStateExprsTs(m: PipelineModule): string[] {
  return forkLaneLastLabels(m).map((label) => `state[${JSON.stringify(label)}]`);
}

export function generateForkStepBodyTs(m: PipelineModule, _project: Project, outTs: string): string {
  const join = forkJoinOf(m);
  if (join === "assemble") return generateAssembleStepBodyTs(m, _project, outTs);
  if (join === "merge") {
    const policyJson = JSON.stringify(m.mergePolicy ?? DEFAULT_MERGE_POLICY);
    const exprs = forkLaneLastStateExprsTs(m);
    return [
      exportComment("//", forkJoinComment()),
      `const values = [${exprs.join(", ")}].filter((v) => v != null);`,
      `return mergeFold(values, ${policyJson}) as ${outTs};`,
    ].join("\n");
  }
  const fields = forkBranchesOf(m).flatMap((b) => {
    const last = laneLastModule(b);
    if (!last) return [];
    return [`${JSON.stringify(forkProductField(b))}: state[${JSON.stringify(last.label.trim())}]`];
  });
  return [
    exportComment("//", forkJoinComment()),
    `const assembled = { ${fields.join(", ")} };`,
    `return assembled as ${outTs};`,
  ].join("\n");
}

export function generateForkStepBodyPy(m: PipelineModule, _project: Project, outPy: string): string {
  const join = forkJoinOf(m);
  if (join === "assemble") return generateAssembleStepBodyPy(m, _project, outPy);
  if (join === "merge") {
    const policyJson = JSON.stringify(m.mergePolicy ?? DEFAULT_MERGE_POLICY);
    const exprs = forkLaneLastLabels(m).map((label) => `state.get(${JSON.stringify(label)})`);
    return [
      exportComment("#", forkJoinComment()),
      `values = [v for v in [${exprs.join(", ")}] if v is not None]`,
      `return cast(${outPy}, cast(object, merge_fold(values, ${policyJson})))`,
    ].join("\n");
  }
  const fields = forkBranchesOf(m).flatMap((b) => {
    const last = laneLastModule(b);
    if (!last) return [];
    return [`${JSON.stringify(forkProductField(b))}: state.get(${JSON.stringify(last.label.trim())})`];
  });
  return [
    exportComment("#", forkJoinComment()),
    `return cast(${outPy}, cast(object, {${fields.join(", ")}}))`,
  ].join("\n");
}

export function generateForkStepBodyGo(m: PipelineModule, project: Project, outGo: string): string {
  const join = forkJoinOf(m);
  if (join === "assemble") return generateAssembleStepBodyGo(m, project, outGo);
  const zero = goZeroValue(outGo);
  if (join === "merge") {
    const policyJson = JSON.stringify(m.mergePolicy ?? DEFAULT_MERGE_POLICY);
    const pushes = forkLaneLastLabels(m).map(
      (label) => `\tif v, ok := state[${JSON.stringify(label)}]; ok { values = append(values, v) }`,
    );
    return [
      exportComment("//", forkJoinComment()),
      `var policy any`,
      `if err := json.Unmarshal([]byte(${JSON.stringify(policyJson)}), &policy); err != nil {`,
      `\treturn ${zero}, err`,
      `}`,
      `values := []any{}`,
      ...pushes,
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
    ].join("\n");
  }
  const inserts = forkBranchesOf(m).flatMap((b) => {
    const last = laneLastModule(b);
    if (!last) return [];
    return [
      `payload[${JSON.stringify(forkProductField(b))}] = state[${JSON.stringify(last.label.trim())}]`,
    ];
  });
  return [
    exportComment("//", forkJoinComment()),
    "payload := map[string]any{}",
    ...inserts,
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

export function generateForkStepBodyRust(m: PipelineModule, project: Project, outRust: string): string {
  const join = forkJoinOf(m);
  if (join === "assemble") return generateAssembleStepBodyRust(m, project, outRust);
  if (join === "merge") {
    const policyJson = JSON.stringify(m.mergePolicy ?? DEFAULT_MERGE_POLICY);
    const pushes = forkLaneLastLabels(m).map(
      (label) => `if let Some(v) = state.get(${JSON.stringify(label)}) { values.push(v.clone()); }`,
    );
    return [
      exportComment("//", forkJoinComment()),
      `let policy: Value = serde_json::from_str(${JSON.stringify(policyJson)}).unwrap_or(Value::Null);`,
      "let mut values: Vec<Value> = Vec::new();",
      ...pushes,
      "let merged = merge_fold(values, &policy);",
      `let out: ${outRust} = serde_json::from_value(merged)?;`,
      "Ok(out)",
    ].join("\n");
  }
  const inserts = forkBranchesOf(m).flatMap((b) => {
    const last = laneLastModule(b);
    if (!last) return [];
    return [
      `map.insert(${JSON.stringify(forkProductField(b))}.to_string(), state.get(${JSON.stringify(last.label.trim())}).cloned().unwrap_or(Value::Null));`,
    ];
  });
  return [
    exportComment("//", forkJoinComment()),
    "let mut map = serde_json::Map::new();",
    ...inserts,
    `let out: ${outRust} = serde_json::from_value(Value::Object(map))?;`,
    "Ok(out)",
  ].join("\n");
}

function exportDotPathTs(root: string, path: string): string {
  return path
    .split(".")
    .map((p) => p.trim())
    .filter(Boolean)
    .reduce((acc, p) => `(${acc} as Record<string, unknown>)?.[${JSON.stringify(p)}]`, root);
}

function ifConditionExportTs(m: PipelineModule, root: string): string {
  const path = m.ifCondition?.path.trim() ?? "";
  const access = exportDotPathTs(root, path);
  return `${access} === true`;
}

function ifConditionExportPy(m: PipelineModule, root: string): string {
  const parts = JSON.stringify((m.ifCondition?.path.trim() ?? "").split(".").map((p) => p.trim()).filter(Boolean));
  const walk = `_cur = ${root}\nfor _p in ${parts}:\n    _cur = _cur.get(_p) if isinstance(_cur, dict) else getattr(_cur, _p, None)`;
  return `${walk}\n_cond = _cur is True`;
}

function ifConditionPathWire(m: PipelineModule): string {
  return m.ifCondition?.path.trim() ?? "";
}

function ifElseStateExprTs(m: PipelineModule, thenSide: boolean): string {
  const branch = thenSide ? ifThenBranch(m) : ifElseBranch(m);
  const last = branch ? laneLastModule(branch) : undefined;
  return last ? `state[${JSON.stringify(last.label.trim())}]` : "input";
}

function ifElseStateExprPy(m: PipelineModule, thenSide: boolean): string {
  const branch = thenSide ? ifThenBranch(m) : ifElseBranch(m);
  const last = branch ? laneLastModule(branch) : undefined;
  return last ? `state.get(${JSON.stringify(last.label.trim())})` : "input";
}

export function generateIfElseStepBodyTs(m: PipelineModule, _project: Project, outTs: string): string {
  const cond = ifConditionExportTs(m, "input");
  return `return ((${cond}) ? ${ifElseStateExprTs(m, true)} : ${ifElseStateExprTs(m, false)}) as ${outTs};`;
}

export function generateIfElseStepBodyPy(m: PipelineModule, _project: Project, outPy: string): string {
  return [
    ifConditionExportPy(m, "input"),
    `return cast(${outPy}, ${ifElseStateExprPy(m, true)} if _cond else ${ifElseStateExprPy(m, false)})`,
  ].join("\n");
}

export function generateIfElseStepBodyGo(m: PipelineModule, _project: Project, _outGo: string): string {
  const thenLast = laneLastModule(ifThenBranch(m) ?? { id: "", label: "", modules: [] });
  const elseLast = laneLastModule(ifElseBranch(m) ?? { id: "", label: "", modules: [] });
  const thenKey = thenLast ? JSON.stringify(thenLast.label.trim()) : "";
  const elseKey = elseLast ? JSON.stringify(elseLast.label.trim()) : "";
  return [
    exportComment("//", "if/else — orchestrator ran the chosen lane; pick last output or passthrough"),
    thenKey ? `if v, ok := state[${thenKey}]; ok && v != nil { return v, nil }` : "",
    elseKey ? `if v, ok := state[${elseKey}]; ok && v != nil { return v, nil }` : "",
    "return input, nil",
  ]
    .filter(Boolean)
    .join("\n");
}

export function generateIfElseStepBodyRust(m: PipelineModule, _project: Project, outRust: string): string {
  const thenLast = laneLastModule(ifThenBranch(m) ?? { id: "", label: "", modules: [] });
  const elseLast = laneLastModule(ifElseBranch(m) ?? { id: "", label: "", modules: [] });
  return [
    exportComment("//", "if/else — orchestrator ran the chosen lane; pick last output or passthrough"),
    thenLast
      ? `if let Some(v) = state.get(${JSON.stringify(thenLast.label.trim())}) { let out: ${outRust} = serde_json::from_value(v.clone())?; return Ok(out); }`
      : "",
    elseLast
      ? `if let Some(v) = state.get(${JSON.stringify(elseLast.label.trim())}) { let out: ${outRust} = serde_json::from_value(v.clone())?; return Ok(out); }`
      : "",
    `let out: ${outRust} = serde_json::from_value(serde_json::to_value(&input)?)?;`,
    "Ok(out)",
  ]
    .filter(Boolean)
    .join("\n");
}

function exclusiveLaneStateTs(branch?: { modules: PipelineModule[] }): string {
  const last = branch ? laneLastModule(branch) : undefined;
  return last ? `state[${JSON.stringify(last.label.trim())}]` : "input";
}

function exclusiveLaneStatePy(branch?: { modules: PipelineModule[] }): string {
  const last = branch ? laneLastModule(branch) : undefined;
  return last ? `state.get(${JSON.stringify(last.label.trim())})` : "input";
}

function exclusiveLaneLast(branch?: { modules: PipelineModule[] }): PipelineModule | undefined {
  return branch ? laneLastModule(branch) : undefined;
}

export function generateCaseStepBodyTs(m: PipelineModule, _project: Project, outTs: string): string {
  const access = exportDotPathTs("input", ifConditionPathWire(m));
  const branches = forkBranchesOf(m);
  const lines = [`const __key = String(${access} ?? "");`];
  for (const b of branches.filter((arm) => !isDefaultCaseMatch(arm.match))) {
    lines.push(
      `if (__key === ${JSON.stringify((b.match ?? "").trim())}) return (${exclusiveLaneStateTs(b)}) as ${outTs};`,
    );
  }
  const fallback = branches.find((arm) => isDefaultCaseMatch(arm.match));
  lines.push(`return (${exclusiveLaneStateTs(fallback)}) as ${outTs};`);
  return lines.join("\n");
}

export function generateCaseStepBodyPy(m: PipelineModule, _project: Project, outPy: string): string {
  const branches = forkBranchesOf(m);
  const lines = caseDiscriminantExportPy(m, "input").split("\n");
  for (const b of branches.filter((arm) => !isDefaultCaseMatch(arm.match))) {
    lines.push(`if _disc == ${JSON.stringify((b.match ?? "").trim())}:`);
    lines.push(`    return cast(${outPy}, ${exclusiveLaneStatePy(b)})`);
  }
  const fallback = branches.find((arm) => isDefaultCaseMatch(arm.match));
  lines.push(`return cast(${outPy}, ${exclusiveLaneStatePy(fallback)})`);
  return lines.join("\n");
}

export function generateCaseStepBodyGo(m: PipelineModule, _project: Project, _outGo: string): string {
  const lines = [exportComment("//", "case — orchestrator ran the chosen arm; pick last output or passthrough")];
  for (const b of forkBranchesOf(m)) {
    const last = exclusiveLaneLast(b);
    if (!last) continue;
    lines.push(
      `if v, ok := state[${JSON.stringify(last.label.trim())}]; ok && v != nil { return v, nil }`,
    );
  }
  lines.push("return input, nil");
  return lines.join("\n");
}

export function generateCaseStepBodyRust(m: PipelineModule, _project: Project, outRust: string): string {
  const lines = [exportComment("//", "case — orchestrator ran the chosen arm; pick last output or passthrough")];
  for (const b of forkBranchesOf(m)) {
    const last = exclusiveLaneLast(b);
    if (!last) continue;
    lines.push(
      `if let Some(v) = state.get(${JSON.stringify(last.label.trim())}) { let out: ${outRust} = serde_json::from_value(v.clone())?; return Ok(out); }`,
    );
  }
  lines.push(`let out: ${outRust} = serde_json::from_value(serde_json::to_value(&input)?)?;`);
  lines.push("Ok(out)");
  return lines.join("\n");
}

export function generateControlJoinStepBodyTs(_m: PipelineModule, _project: Project, outTs: string): string {
  return `return input as ${outTs};`;
}

export function generateControlJoinStepBodyPy(_m: PipelineModule, _project: Project, outPy: string): string {
  return `return cast(${outPy}, input)`;
}

export function generateControlJoinStepBodyGo(_m: PipelineModule, _project: Project, _outGo: string): string {
  return "return input, nil";
}

export function generateControlJoinStepBodyRust(_m: PipelineModule, _project: Project, _outRust: string): string {
  return "Ok(input)";
}

function caseDiscriminantExportPy(m: PipelineModule, root: string): string {
  const parts = JSON.stringify(
    (m.ifCondition?.path.trim() ?? "")
      .split(".")
      .map((p) => p.trim())
      .filter(Boolean),
  );
  return [
    `_cur = ${root}`,
    `for _p in ${parts}:`,
    `    _cur = _cur.get(_p) if isinstance(_cur, dict) else getattr(_cur, _p, None)`,
    `_disc = "true" if _cur is True else "false" if _cur is False else "" if _cur is None else str(_cur)`,
  ].join("\n");
}

function caseDiscriminantExportTs(root: string, path: string): string {
  return `String(${exportDotPathTs(root, path)} ?? "")`;
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
// AI : DONE (allow-pipeline-non-linear-fork) — Fork → Promise.all of lane IIFEs then join (ts/py; go/rs sequential walk).
function orchestratorIndexById(project: Project): Map<string, number> {
  return new Map(flattenPipelineModules(project.modules).map((m, i) => [m.id, i]));
}

function emitTsOrchestratorWalk(
  modules: PipelineModule[],
  project: Project,
  stepFnName: (m: PipelineModule, i: number) => string,
  indexById: Map<string, number>,
  multi: boolean,
  indent: string,
): string[] {
  const lines: string[] = [];
  for (let wi = 0; wi < modules.length; wi++) {
    const m = modules[wi]!;
    if (isControlJoinKind(m.kind)) continue;
    const i = indexById.get(m.id) ?? 0;
    const fn = stepFnName(m, i);
    const label = labelAsStateKey(m.label);
    const outTs = exportSpineOutTs(m, project, i);
    const inTs = exportSpineInTs(m, project, i);
    if (m.kind === ModuleKind.Fork) {
      const lanes = forkBranchesOf(m);
      lines.push(`${indent}// ${i + 1}. ${m.label} (fork)`);
      lines.push(`${indent}{`);
      lines.push(`${indent}  const __forkIn = spine;`);
      lines.push(`${indent}  await Promise.all([`);
      for (const b of lanes) {
        lines.push(`${indent}    (async () => {`);
        lines.push(`${indent}      let spine: unknown = __forkIn;`);
        lines.push(
          ...emitTsOrchestratorWalk(b.modules, project, stepFnName, indexById, multi, indent + "      "),
        );
        lines.push(`${indent}      return spine;`);
        lines.push(`${indent}    })(),`);
      }
      lines.push(`${indent}  ]);`);
      lines.push(`${indent}  spine = __forkIn;`);
      lines.push(`${indent}  ${orchestratorInvokeLine(m, fn, "ts", !multi, inTs).trim()}`);
      if (label) {
        lines.push(`${indent}  state[${JSON.stringify(label)}] = spine as ${outTs};`);
        lines.push(
          `${indent}  lastRunTrace.push({ label: ${JSON.stringify(label)}, output: snapshotTraceOutput(spine) });`,
        );
      }
      lines.push(`${indent}}`, "");
      continue;
    }
    if (isExclusiveKind(m.kind)) {
      lines.push(`${indent}// ${i + 1}. ${m.label} (${m.kind})`);
      lines.push(`${indent}{`);
      lines.push(`${indent}  const __ifIn = spine;`);
      if (m.kind === ModuleKind.IfElse) {
        const thenB = ifThenBranch(m);
        const elseB = ifElseBranch(m);
        lines.push(`${indent}  if (${ifConditionExportTs(m, "__ifIn")}) {`);
        lines.push(`${indent}    let spine: unknown = __ifIn;`);
        if (thenB?.modules.length) {
          lines.push(...emitTsOrchestratorWalk(thenB.modules, project, stepFnName, indexById, multi, indent + "    "));
        }
        lines.push(`${indent}  } else {`);
        lines.push(`${indent}    let spine: unknown = __ifIn;`);
        if (elseB?.modules.length) {
          lines.push(...emitTsOrchestratorWalk(elseB.modules, project, stepFnName, indexById, multi, indent + "    "));
        }
        lines.push(`${indent}  }`);
      } else {
        const matches = forkBranchesOf(m).filter((b) => !isDefaultCaseMatch(b.match));
        const fallback = forkBranchesOf(m).find((b) => isDefaultCaseMatch(b.match));
        lines.push(`${indent}  const __disc = ${caseDiscriminantExportTs("__ifIn", ifConditionPathWire(m))};`);
        if (matches.length === 0) {
          lines.push(`${indent}  {`);
          lines.push(`${indent}    let spine: unknown = __ifIn;`);
          if (fallback?.modules.length) {
            lines.push(...emitTsOrchestratorWalk(fallback.modules, project, stepFnName, indexById, multi, indent + "    "));
          }
          lines.push(`${indent}  }`);
        } else {
          for (let ai = 0; ai < matches.length; ai++) {
            const b = matches[ai]!;
            const head = ai === 0 ? "if" : "} else if";
            lines.push(`${indent}  ${head} (__disc === ${JSON.stringify((b.match ?? "").trim())}) {`);
            lines.push(`${indent}    let spine: unknown = __ifIn;`);
            if (b.modules.length) {
              lines.push(...emitTsOrchestratorWalk(b.modules, project, stepFnName, indexById, multi, indent + "    "));
            }
          }
          lines.push(`${indent}  } else {`);
          lines.push(`${indent}    let spine: unknown = __ifIn;`);
          if (fallback?.modules.length) {
            lines.push(...emitTsOrchestratorWalk(fallback.modules, project, stepFnName, indexById, multi, indent + "    "));
          }
          lines.push(`${indent}  }`);
        }
      }
      lines.push(`${indent}  spine = __ifIn;`);
      lines.push(`${indent}  ${orchestratorInvokeLine(m, fn, "ts", !multi, inTs).trim()}`);
      if (label) {
        lines.push(`${indent}  state[${JSON.stringify(label)}] = spine as ${outTs};`);
        lines.push(
          `${indent}  lastRunTrace.push({ label: ${JSON.stringify(label)}, output: snapshotTraceOutput(spine) });`,
        );
      }
      lines.push(`${indent}}`, "");
      if (!followingControlJoin(modules, wi)) break;
      continue;
    }
    lines.push(`${indent}// ${i + 1}. ${m.label}`);
    lines.push(`${indent}${orchestratorInvokeLine(m, fn, "ts", !multi, inTs).trim()}`);
    if (label) {
      lines.push(`${indent}state[${JSON.stringify(label)}] = spine as ${outTs};`);
      lines.push(
        `${indent}lastRunTrace.push({ label: ${JSON.stringify(label)}, output: snapshotTraceOutput(spine) });`,
      );
    }
    lines.push("");
  }
  return lines;
}

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

  const indexById = orchestratorIndexById(project);
  lines.push(...emitTsOrchestratorWalk(project.modules, project, stepFnName, indexById, multi, "  "));

  lines.push("  return spine;", "}", "");
  return lines.join("\n");
}

export function generateOrchestratorPy(project: Project, stepFnName: (m: PipelineModule, i: number) => string): string {
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

  const indexById = orchestratorIndexById(project);
  lines.push(...emitPyOrchestratorWalk(project.modules, project, stepFnName, indexById, multi, "    "));

  lines.push("    return spine", "");
  return lines.join("\n");
}

function emitPyOrchestratorWalk(
  modules: PipelineModule[],
  project: Project,
  stepFnName: (m: PipelineModule, i: number) => string,
  indexById: Map<string, number>,
  multi: boolean,
  indent: string,
): string[] {
  const lines: string[] = [];
  for (let wi = 0; wi < modules.length; wi++) {
    const m = modules[wi]!;
    if (isControlJoinKind(m.kind)) continue;
    const i = indexById.get(m.id) ?? 0;
    const fn = stepFnName(m, i);
    const label = labelAsStateKey(m.label);
    const inPy = exportSpineInPy(m, project, i);
    if (m.kind === ModuleKind.Fork) {
      const lanes = forkBranchesOf(m);
      lines.push(`${indent}# ${i + 1}. ${m.label} (fork)`);
      lines.push(`${indent}__fork_in = spine`);
      for (let li = 0; li < lanes.length; li++) {
        const b = lanes[li]!;
        lines.push(`${indent}async def __lane_${li}():`);
        lines.push(`${indent}    spine = __fork_in`);
        lines.push(...emitPyOrchestratorWalk(b.modules, project, stepFnName, indexById, multi, indent + "    "));
        lines.push(`${indent}    return spine`);
      }
      lines.push(`${indent}await asyncio.gather(${lanes.map((_, li) => `__lane_${li}()`).join(", ")})`);
      lines.push(`${indent}spine = __fork_in`);
      lines.push(`${indent}${orchestratorInvokeLine(m, fn, "py", !multi, inPy).trim()}`);
      if (label) {
        lines.push(`${indent}state[${JSON.stringify(label)}] = spine`);
        lines.push(
          `${indent}last_run_trace.append({"label": ${JSON.stringify(label)}, "output": json.loads(json.dumps(spine, default=str))})`,
        );
      }
      lines.push("");
      continue;
    }
    if (isExclusiveKind(m.kind)) {
      lines.push(`${indent}# ${i + 1}. ${m.label} (${m.kind})`);
      lines.push(`${indent}__if_in = spine`);
      if (m.kind === ModuleKind.IfElse) {
        const thenB = ifThenBranch(m);
        const elseB = ifElseBranch(m);
        lines.push(
          ...ifConditionExportPy(m, "__if_in")
            .split("\n")
            .map((l) => `${indent}${l}`),
        );
        lines.push(`${indent}if _cond:`);
        lines.push(`${indent}    spine = __if_in`);
        if (thenB?.modules.length) {
          lines.push(...emitPyOrchestratorWalk(thenB.modules, project, stepFnName, indexById, multi, indent + "    "));
        }
        lines.push(`${indent}else:`);
        lines.push(`${indent}    spine = __if_in`);
        if (elseB?.modules.length) {
          lines.push(...emitPyOrchestratorWalk(elseB.modules, project, stepFnName, indexById, multi, indent + "    "));
        }
      } else {
        lines.push(
          ...caseDiscriminantExportPy(m, "__if_in")
            .split("\n")
            .map((l) => `${indent}${l}`),
        );
        const matches = forkBranchesOf(m).filter((b) => !isDefaultCaseMatch(b.match));
        const fallback = forkBranchesOf(m).find((b) => isDefaultCaseMatch(b.match));
        if (matches.length === 0) {
          lines.push(`${indent}spine = __if_in`);
          if (fallback?.modules.length) {
            lines.push(...emitPyOrchestratorWalk(fallback.modules, project, stepFnName, indexById, multi, indent));
          }
        } else {
          for (let ai = 0; ai < matches.length; ai++) {
            const b = matches[ai]!;
            const head = ai === 0 ? "if" : "elif";
            lines.push(`${indent}${head} _disc == ${JSON.stringify((b.match ?? "").trim())}:`);
            lines.push(`${indent}    spine = __if_in`);
            if (b.modules.length) {
              lines.push(...emitPyOrchestratorWalk(b.modules, project, stepFnName, indexById, multi, indent + "    "));
            }
          }
          lines.push(`${indent}else:`);
          lines.push(`${indent}    spine = __if_in`);
          if (fallback?.modules.length) {
            lines.push(...emitPyOrchestratorWalk(fallback.modules, project, stepFnName, indexById, multi, indent + "    "));
          }
        }
      }
      lines.push(`${indent}spine = __if_in`);
      lines.push(`${indent}${orchestratorInvokeLine(m, fn, "py", !multi, inPy).trim()}`);
      if (label) {
        lines.push(`${indent}state[${JSON.stringify(label)}] = spine`);
        lines.push(
          `${indent}last_run_trace.append({"label": ${JSON.stringify(label)}, "output": json.loads(json.dumps(spine, default=str))})`,
        );
      }
      lines.push("");
      if (!followingControlJoin(modules, wi)) break;
      continue;
    }
    lines.push(`${indent}# ${i + 1}. ${m.label}`);
    lines.push(`${indent}${orchestratorInvokeLine(m, fn, "py", !multi, inPy).trim()}`);
    if (label) {
      lines.push(`${indent}state[${JSON.stringify(label)}] = spine`);
      lines.push(
        `${indent}last_run_trace.append({"label": ${JSON.stringify(label)}, "output": json.loads(json.dumps(spine, default=str))})`,
      );
    }
    lines.push("");
  }
  return lines;
}

// AI : async Rust orchestrator — spine as Value between steps for open typing.
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

  const indexById = orchestratorIndexById(project);
  lines.push(...emitRsOrchestratorWalk(project.modules, project, stepFnName, indexById, multi, "    "));

  lines.push("    Ok(spine)", "}", "");
  return lines.join("\n");
}

function emitRsOrchestratorWalk(
  modules: PipelineModule[],
  project: Project,
  stepFnName: (m: PipelineModule, i: number) => string,
  indexById: Map<string, number>,
  multi: boolean,
  indent: string,
): string[] {
  const lines: string[] = [];
  for (let wi = 0; wi < modules.length; wi++) {
    const m = modules[wi]!;
    if (isControlJoinKind(m.kind)) continue;
    const i = indexById.get(m.id) ?? 0;
    const fn = stepFnName(m, i);
    const label = labelAsStateKey(m.label);
    const inRust = exportSpineInRust(m, project, i);
    if (m.kind === ModuleKind.Fork) {
      const forkIn = `${indent}let __fork_in = spine.clone();`;
      lines.push(`${indent}// ${i + 1}. ${m.label} (fork lanes sequential in export)`);
      lines.push(forkIn);
      for (const b of forkBranchesOf(m)) {
        lines.push(`${indent}{`);
        lines.push(`${indent}    let mut spine = __fork_in.clone();`);
        lines.push(...emitRsOrchestratorWalk(b.modules, project, stepFnName, indexById, multi, indent + "    "));
        lines.push(`${indent}}`);
      }
      lines.push(`${indent}spine = __fork_in;`);
      lines.push(`${indent}${orchestratorInvokeLine(m, fn, "rs", !multi, inRust).trim()}`);
      if (label) {
        lines.push(`${indent}state.insert(${JSON.stringify(label)}.to_string(), spine.clone());`);
      }
      lines.push("");
      continue;
    }
    if (isExclusiveKind(m.kind)) {
      lines.push(`${indent}// ${i + 1}. ${m.label} (${m.kind})`);
      lines.push(`${indent}let __if_in = spine.clone();`);
      if (m.kind === ModuleKind.IfElse) {
        const thenB = ifThenBranch(m);
        const elseB = ifElseBranch(m);
        lines.push(
          `${indent}if eval_if_condition("path", &spine_dot_path(&__if_in, ${JSON.stringify(ifConditionPathWire(m))}), &Value::Null) {`,
        );
        lines.push(`${indent}    let mut spine = __if_in.clone();`);
        if (thenB?.modules.length) {
          lines.push(...emitRsOrchestratorWalk(thenB.modules, project, stepFnName, indexById, multi, indent + "    "));
        }
        lines.push(`${indent}} else {`);
        lines.push(`${indent}    let mut spine = __if_in.clone();`);
        if (elseB?.modules.length) {
          lines.push(...emitRsOrchestratorWalk(elseB.modules, project, stepFnName, indexById, multi, indent + "    "));
        }
        lines.push(`${indent}}`);
      } else {
        const matches = forkBranchesOf(m).filter((b) => !isDefaultCaseMatch(b.match));
        const fallback = forkBranchesOf(m).find((b) => isDefaultCaseMatch(b.match));
        lines.push(
          `${indent}let __got = spine_dot_path(&__if_in, ${JSON.stringify(ifConditionPathWire(m))});`,
        );
        lines.push(
          `${indent}let __disc = __got.as_str().map(|s| s.to_string()).or_else(|| __got.as_i64().map(|n| n.to_string())).or_else(|| __got.as_bool().map(|b| if *b { "true".into() } else { "false".into() })).unwrap_or_default();`,
        );
        if (matches.length === 0) {
          lines.push(`${indent}{`);
          lines.push(`${indent}    let mut spine = __if_in.clone();`);
          if (fallback?.modules.length) {
            lines.push(...emitRsOrchestratorWalk(fallback.modules, project, stepFnName, indexById, multi, indent + "    "));
          }
          lines.push(`${indent}}`);
        } else {
          for (let ai = 0; ai < matches.length; ai++) {
            const b = matches[ai]!;
            const head = ai === 0 ? "if" : "} else if";
            lines.push(`${indent}${head} __disc == ${JSON.stringify((b.match ?? "").trim())} {`);
            lines.push(`${indent}    let mut spine = __if_in.clone();`);
            if (b.modules.length) {
              lines.push(...emitRsOrchestratorWalk(b.modules, project, stepFnName, indexById, multi, indent + "    "));
            }
          }
          lines.push(`${indent}} else {`);
          lines.push(`${indent}    let mut spine = __if_in.clone();`);
          if (fallback?.modules.length) {
            lines.push(...emitRsOrchestratorWalk(fallback.modules, project, stepFnName, indexById, multi, indent + "    "));
          }
          lines.push(`${indent}}`);
        }
      }
      lines.push(`${indent}spine = __if_in;`);
      lines.push(`${indent}${orchestratorInvokeLine(m, fn, "rs", !multi, inRust).trim()}`);
      if (label) {
        lines.push(`${indent}state.insert(${JSON.stringify(label)}.to_string(), spine.clone());`);
      }
      lines.push("");
      if (!followingControlJoin(modules, wi)) break;
      continue;
    }
    lines.push(`${indent}// ${i + 1}. ${m.label}`);
    lines.push(`${indent}${orchestratorInvokeLine(m, fn, "rs", !multi, inRust).trim()}`);
    if (label) {
      lines.push(`${indent}state.insert(${JSON.stringify(label)}.to_string(), spine.clone());`);
    }
    lines.push("");
  }
  return lines;
}

// AI : Go orchestrator — spine as json.RawMessage between steps for open typing.
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

  const indexById = orchestratorIndexById(project);
  lines.push(...emitGoOrchestratorWalk(project.modules, project, stepFnName, indexById, multi, "    "));

  lines.push("    return spine, nil", "}", "");
  return lines.join("\n");
}

function emitGoOrchestratorWalk(
  modules: PipelineModule[],
  project: Project,
  stepFnName: (m: PipelineModule, i: number) => string,
  indexById: Map<string, number>,
  multi: boolean,
  indent: string,
): string[] {
  const lines: string[] = [];
  for (let wi = 0; wi < modules.length; wi++) {
    const m = modules[wi]!;
    if (isControlJoinKind(m.kind)) continue;
    const i = indexById.get(m.id) ?? 0;
    const fn = stepFnName(m, i);
    const label = labelAsStateKey(m.label);
    const inGo = exportSpineInGo(m, project, i);
    if (m.kind === ModuleKind.Fork) {
      lines.push(`${indent}// ${i + 1}. ${m.label} (fork lanes sequential in export)`);
      lines.push(`${indent}forkIn := append(json.RawMessage(nil), spine...)`);
      for (const b of forkBranchesOf(m)) {
        lines.push(`${indent}{`);
        lines.push(`${indent}    spine = append(json.RawMessage(nil), forkIn...)`);
        lines.push(...emitGoOrchestratorWalk(b.modules, project, stepFnName, indexById, multi, indent + "    "));
        lines.push(`${indent}}`);
      }
      lines.push(`${indent}spine = forkIn`);
      lines.push(orchestratorInvokeLine(m, fn, "go", !multi, inGo).split("\n").map((l) => indent + l.trimStart()).join("\n"));
      if (label) {
        lines.push(`${indent}state[${JSON.stringify(label)}] = append(json.RawMessage(nil), spine...)`);
      }
      lines.push("");
      continue;
    }
    if (isExclusiveKind(m.kind)) {
      lines.push(`${indent}// ${i + 1}. ${m.label} (${m.kind})`);
      lines.push(`${indent}ifIn := append(json.RawMessage(nil), spine...)`);
      lines.push(`${indent}var ifObj any`);
      lines.push(`${indent}if err := json.Unmarshal(ifIn, &ifObj); err != nil { return nil, err }`);
      if (m.kind === ModuleKind.IfElse) {
        const thenB = ifThenBranch(m);
        const elseB = ifElseBranch(m);
        lines.push(
          `${indent}if EvalIfCondition("path", SpineDotPath(ifObj, ${JSON.stringify(ifConditionPathWire(m))}), nil) {`,
        );
        lines.push(`${indent}    spine = append(json.RawMessage(nil), ifIn...)`);
        if (thenB?.modules.length) {
          lines.push(...emitGoOrchestratorWalk(thenB.modules, project, stepFnName, indexById, multi, indent + "    "));
        }
        lines.push(`${indent}} else {`);
        lines.push(`${indent}    spine = append(json.RawMessage(nil), ifIn...)`);
        if (elseB?.modules.length) {
          lines.push(...emitGoOrchestratorWalk(elseB.modules, project, stepFnName, indexById, multi, indent + "    "));
        }
        lines.push(`${indent}}`);
      } else {
        const matches = forkBranchesOf(m).filter((b) => !isDefaultCaseMatch(b.match));
        const fallback = forkBranchesOf(m).find((b) => isDefaultCaseMatch(b.match));
        lines.push(
          `${indent}disc := fmt.Sprint(SpineDotPath(ifObj, ${JSON.stringify(ifConditionPathWire(m))}))`,
        );
        if (matches.length === 0) {
          lines.push(`${indent}spine = append(json.RawMessage(nil), ifIn...)`);
          if (fallback?.modules.length) {
            lines.push(...emitGoOrchestratorWalk(fallback.modules, project, stepFnName, indexById, multi, indent));
          }
        } else {
          for (let ai = 0; ai < matches.length; ai++) {
            const b = matches[ai]!;
            const head = ai === 0 ? "if" : "} else if";
            lines.push(`${indent}${head} disc == ${JSON.stringify((b.match ?? "").trim())} {`);
            lines.push(`${indent}    spine = append(json.RawMessage(nil), ifIn...)`);
            if (b.modules.length) {
              lines.push(...emitGoOrchestratorWalk(b.modules, project, stepFnName, indexById, multi, indent + "    "));
            }
          }
          lines.push(`${indent}} else {`);
          lines.push(`${indent}    spine = append(json.RawMessage(nil), ifIn...)`);
          if (fallback?.modules.length) {
            lines.push(...emitGoOrchestratorWalk(fallback.modules, project, stepFnName, indexById, multi, indent + "    "));
          }
          lines.push(`${indent}}`);
        }
      }
      lines.push(`${indent}spine = ifIn`);
      lines.push(orchestratorInvokeLine(m, fn, "go", !multi, inGo).split("\n").map((l) => indent + l.trimStart()).join("\n"));
      if (label) {
        lines.push(`${indent}state[${JSON.stringify(label)}] = append(json.RawMessage(nil), spine...)`);
      }
      lines.push("");
      if (!followingControlJoin(modules, wi)) break;
      continue;
    }
    lines.push(`${indent}// ${i + 1}. ${m.label}`);
    lines.push(orchestratorInvokeLine(m, fn, "go", !multi, inGo).split("\n").map((l) => indent + l.trimStart()).join("\n"));
    if (label) {
      lines.push(`${indent}state[${JSON.stringify(label)}] = append(json.RawMessage(nil), spine...)`);
    }
    lines.push("");
  }
  return lines;
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
