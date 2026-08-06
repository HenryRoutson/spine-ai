import { assertEntriesForModule } from "@/lib/assert_steps";
import { customCodeEntriesForModule } from "@/lib/custom_code_entries";
import { allModelsToGo } from "./pydantic";
import {
  exportStringLiteral,
  goZeroValue,
  indentExportBlock,
  makeUniqueStepFnName,
  primaryExportCustomCode,
  withExportLineCountMeta,
  exportSpineInGo,
  exportSpineOutGo,
  generateCombineStepBodyGo,
  generateInputStepBodyGo,
  generateOrchestratorGo,
  modelName,
  prepareExportProject,
} from "./pipeline_export_shared";
import { analyzeExportRuntimeNeeds, generateRuntimeStubsGo, type ExportRuntimeNeeds } from "./pipeline_export_setup";
import { pipelineStateGoType } from "./pipeline_state";
import { exportWebhookStepBodyGo, webhookStepUsesPipelineState } from "@/lib/webhook-step";
import { isMergeModuleKind } from "@/lib/module-kinds";
import { MODULE_META } from "./types";
import { stepEmitsList } from "./type_expr";
import type { PipelineModule, Project } from "./types";

// AI : TODO export — inline real JSON schemas for llm / llm-batch steps (from structure models).

function commentForeignCode(code: string, langLabel: string): string {
  return [
    `// ${langLabel} (not inlined — port or call via cgo/FFI):`,
    ...code.split("\n").map((line) => `// ${line}`),
  ].join("\n");
}

function goImports(needs: ExportRuntimeNeeds, project: Project): string {
  const pkgs = new Set<string>(["encoding/json", "sync"]);
  const needsFmt =
    needs.llm ||
    needs.llmBatch ||
    needs.visionOcr ||
    needs.quote ||
    needs.humanReview ||
    project.modules.some((m) => m.kind === "combine");
  if (needsFmt) pkgs.add("fmt");
  if (needs.llm || needs.llmBatch || needs.visionOcr) {
    pkgs.add("bytes");
    pkgs.add("io");
    pkgs.add("net/http");
    pkgs.add("strings");
  }
  const sorted = [...pkgs].sort();
  return ["import (", ...sorted.map((p) => `\t"${p}"`), ")"].join("\n");
}

function generateStepBody(m: PipelineModule, project: Project, outGo: string, inGo: string): string {
  const outName = modelName(project, m.outStructureId);
  const inName = modelName(project, m.inStructureId);
  const zero = goZeroValue(outGo);

  if (isMergeModuleKind(m.kind) || m.kind === "chunk" || m.kind === "custom-code") {
    const custom = primaryExportCustomCode(m);
    const fallbacks = customCodeEntriesForModule(m);
    const passthrough = [
      `b, err := json.Marshal(input)`,
      `if err != nil {`,
      `\treturn ${zero}, err`,
      `}`,
      `var out ${outGo}`,
      `if err := json.Unmarshal(b, &out); err != nil {`,
      `\treturn ${zero}, err`,
      `}`,
      `return out, nil`,
    ];
    if (custom) {
      return [
        commentForeignCode(
          custom.code,
          `${custom.language === "python" ? "Python" : "TypeScript"} custom code (${fallbacks.length} attempt${fallbacks.length === 1 ? "" : "s"})`,
        ),
        ...passthrough,
      ].join("\n");
    }
    return ["// Passthrough — no custom code configured", ...passthrough].join("\n");
  }

  switch (m.kind) {
    case "input":
      return generateInputStepBodyGo(m, outGo);
    case "llm": {
      const prompt = m.prompt ?? "Process the input.";
      const model = m.model ?? "deepseek-v4";
      return [
        `// Structured LLM call → ${outName ?? outGo}${stepEmitsList(m) ? "[]" : ""}`,
        `_ = ${exportStringLiteral(model)}`,
        `inJSON, err := json.MarshalIndent(input, "", "  ")`,
        `if err != nil {`,
        `\treturn ${zero}, err`,
        `}`,
        `userPrompt := ${exportStringLiteral(prompt)} + "\\n\\nINPUT DATA:\\n" + string(inJSON)`,
        `schema := json.RawMessage([]byte("{}")) // JSON schema for ${outName ?? "output"}`,
        `value, err := llmStructured(userPrompt, schema)`,
        `if err != nil {`,
        `\treturn ${zero}, err`,
        `}`,
        `var out ${outGo}`,
        `if err := json.Unmarshal(value, &out); err != nil {`,
        `\treturn ${zero}, err`,
        `}`,
        `return out, nil`,
      ].join("\n");
    }
    case "llm-batch": {
      const prompt = m.prompt ?? "Process the item.";
      const itemGo = outGo.startsWith("[]") ? outGo.slice(2) : outGo;
      return [
        `// One structured LLM call per list item → ${outName ?? outGo}`,
        `inJSON, err := json.Marshal(input)`,
        `if err != nil {`,
        `\treturn ${zero}, err`,
        `}`,
        `var items []json.RawMessage`,
        `if len(inJSON) > 0 && inJSON[0] == '[' {`,
        `\tif err := json.Unmarshal(inJSON, &items); err != nil {`,
        `\t\treturn ${zero}, err`,
        `\t}`,
        `} else {`,
        `\titems = []json.RawMessage{inJSON}`,
        `}`,
        `schema := json.RawMessage([]byte("{}")) // JSON schema for ${outName ?? "output"}`,
        `out := make([]${itemGo}, 0, len(items))`,
        `for _, item := range items {`,
        `\tprompt := ${exportStringLiteral(prompt)} + "\\n\\nITEM:\\n" + string(item)`,
        `\tvalue, err := llmStructured(prompt, schema)`,
        `\tif err != nil {`,
        `\t\treturn ${zero}, err`,
        `\t}`,
        `\tvar one ${itemGo}`,
        `\tif err := json.Unmarshal(value, &one); err != nil {`,
        `\t\treturn ${zero}, err`,
        `\t}`,
        `\tout = append(out, one)`,
        `}`,
        `return out, nil`,
      ].join("\n");
    }
    case "example-select": {
      const prompt = m.prompt ?? "Find useful examples…";
      const ctxLabel = m.exampleContextLabel ?? "Context";
      const ctxKey = exportStringLiteral(ctxLabel);
      const itemGo = outGo.startsWith("[]") ? outGo.slice(2) : outGo;
      const fieldPath = m.exampleContextField?.trim();
      const descriptionBlock = fieldPath
        ? [
            `ctxRaw, ok := state[${ctxKey}]`,
            `if !ok {`,
            `\treturn ${zero}, fmt.Errorf("example-select: missing context label %s", ${ctxKey})`,
            `}`,
            `ctxJSON, err := json.Marshal(ctxRaw)`,
            `if err != nil {`,
            `\treturn ${zero}, err`,
            `}`,
            `var ctxAny any`,
            `if err := json.Unmarshal(ctxJSON, &ctxAny); err != nil {`,
            `\treturn ${zero}, err`,
            `}`,
            `picked := ctxAny`,
            ...fieldPath.split(".").filter(Boolean).map((part) => {
              const p = exportStringLiteral(part);
              return [
                `if m, ok := picked.(map[string]any); ok {`,
                `\tpicked = m[${p}]`,
                `}`,
              ].join("\n");
            }),
            `var description string`,
            `switch v := picked.(type) {`,
            `case string:`,
            `\tdescription = v`,
            `default:`,
            `\tb, err := json.MarshalIndent(picked, "", "  ")`,
            `\tif err != nil {`,
            `\t\treturn ${zero}, err`,
            `\t}`,
            `\tdescription = string(b)`,
            `}`,
          ]
        : [
            `ctxRaw, ok := state[${ctxKey}]`,
            `if !ok {`,
            `\treturn ${zero}, fmt.Errorf("example-select: missing context label %s", ${ctxKey})`,
            `}`,
            `b, err := json.MarshalIndent(ctxRaw, "", "  ")`,
            `if err != nil {`,
            `\treturn ${zero}, err`,
            `}`,
            `description := string(b)`,
          ];
      return [
        `// Per-item relevance filter — ${outName ?? outGo} with selection_reason`,
        ...descriptionBlock,
        `inJSON, err := json.Marshal(input)`,
        `if err != nil {`,
        `\treturn ${zero}, err`,
        `}`,
        `var items []json.RawMessage`,
        `if len(inJSON) > 0 && inJSON[0] == '[' {`,
        `\tif err := json.Unmarshal(inJSON, &items); err != nil {`,
        `\t\treturn ${zero}, err`,
        `\t}`,
        `} else {`,
        `\titems = []json.RawMessage{inJSON}`,
        `}`,
        `schema := json.RawMessage([]byte("{\\"chain_of_thought\\":\\"string\\",\\"is_relevant\\":\\"boolean\\"}"))`,
        `template := ${exportStringLiteral(prompt)}`,
        `out := make([]${itemGo}, 0, len(items))`,
        `for _, item := range items {`,
        `\task := strings.ReplaceAll(strings.ReplaceAll(template, "{description}", description), "{example}", string(item))`,
        `\tvalue, err := llmStructured(ask, schema)`,
        `\tif err != nil {`,
        `\t\treturn ${zero}, err`,
        `\t}`,
        `\tvar verdict map[string]any`,
        `\tif err := json.Unmarshal(value, &verdict); err != nil {`,
        `\t\treturn ${zero}, err`,
        `\t}`,
        `\tif relevant, _ := verdict["is_relevant"].(bool); !relevant {`,
        `\t\tcontinue`,
        `\t}`,
        `\tvar row map[string]any`,
        `\tif err := json.Unmarshal(item, &row); err != nil {`,
        `\t\treturn ${zero}, err`,
        `\t}`,
        `\tif reason, ok := verdict["chain_of_thought"].(string); ok {`,
        `\t\trow["selection_reason"] = reason`,
        `\t}`,
        `\tb, err := json.Marshal(row)`,
        `\tif err != nil {`,
        `\t\treturn ${zero}, err`,
        `\t}`,
        `\tvar one ${itemGo}`,
        `\tif err := json.Unmarshal(b, &one); err != nil {`,
        `\t\treturn ${zero}, err`,
        `\t}`,
        `\tout = append(out, one)`,
        `}`,
        `return out, nil`,
      ].join("\n");
    }
    case "quote":
      return [
        "// Match LLM quote strings against source document byte offsets (no LLM cost)",
        "linked, err := resolveQuotes(input, \"\", \"\")",
        "if err != nil {",
        `\treturn ${zero}, err`,
        "}",
        `var out ${outGo}`,
        "if err := json.Unmarshal(linked, &out); err != nil {",
        `\treturn ${zero}, err`,
        "}",
        "return out, nil",
      ].join("\n");
    case "combine":
      return generateCombineStepBodyGo(m, project, outGo, inGo);
    case "transform": {
      const custom = primaryExportCustomCode(m);
      const passthrough = [
        `b, err := json.Marshal(input)`,
        `if err != nil {`,
        `\treturn ${zero}, err`,
        `}`,
        `var out ${outGo}`,
        `if err := json.Unmarshal(b, &out); err != nil {`,
        `\treturn ${zero}, err`,
        `}`,
        `return out, nil`,
      ];
      if (custom) {
        return [
          commentForeignCode(custom.code, custom.language === "python" ? "Python transform" : "TypeScript transform"),
          ...passthrough,
        ].join("\n");
      }
      return [
        `// Reshape ${inName ?? "input"} → ${outName ?? outGo}${stepEmitsList(m) ? " (list)" : ""}`,
        ...passthrough,
      ].join("\n");
    }
    case "assert": {
      const entries = assertEntriesForModule(m);
      if (entries[0]?.code.trim()) {
        return [
          commentForeignCode(entries[0].code, `${entries[0].language} assert`),
          "// Validate pipeline state — passthrough on success",
          "return input, nil",
        ].join("\n");
      }
      return ["// Assert passthrough", "return input, nil"].join("\n");
    }
    case "human-review":
      return [
        "// Pause for operator approval in Inference tab",
        "if err := WaitForHumanReview(input); err != nil {",
        `\treturn ${zero}, err`,
        "}",
        "return input, nil",
      ].join("\n");
    case "webhook":
      return exportWebhookStepBodyGo(m, zero);
    case "output":
      return [`// Snapshot ${outName ?? inName ?? "pipeline output"}`, "return input, nil"].join("\n");
    default:
      return "return input, nil";
  }
}

function stepBodyUsesPipelineState(body: string, m?: PipelineModule): boolean {
  if (m?.kind === "webhook" && webhookStepUsesPipelineState(m)) return true;
  // AI : real state reads only — ignore commented lines.
  return body
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .some((line) => /\bstate\[/.test(line));
}

// AI : indentExportBlock uses spaces — convert leading spaces to tabs for idiomatic Go.
function indentGoBlock(code: string): string {
  return code
    .split("\n")
    .map((line) => {
      const m = /^( +)/.exec(line);
      if (!m) return line;
      const tabs = "\t".repeat(Math.ceil(m[1]!.length / 4) || 1);
      return tabs + line.slice(m[1]!.length);
    })
    .join("\n");
}

function generateStepFnGo(
  m: PipelineModule,
  project: Project,
  index: number,
  stepFnName: (m: PipelineModule, index: number) => string,
): string {
  const fn = stepFnName(m, index);
  const inGo = exportSpineInGo(m, project, index);
  const outGo = exportSpineOutGo(m, project, index);
  const meta = MODULE_META[m.kind];
  const body = generateStepBody(m, project, outGo, inGo);
  const stateParam = stepBodyUsesPipelineState(body, m) ? "state" : "_state";
  const docLines = [
    `// ${m.label.replace(/\*\//g, "*\\/")}`,
    `// Kind: ${meta.label}`,
    ...(m.note ? [`// ${m.note.replace(/\*\//g, "*\\/")}`] : []),
    ...(m.model ? [`// Model: ${m.model}`] : []),
    ...(m.cached ? [`// Cached: true`] : []),
  ];
  return [
    ...docLines,
    `func ${fn}(input ${inGo}, ${stateParam} PipelineState) (${outGo}, error) {`,
    indentGoBlock(indentExportBlock(body, 4)),
    "}",
    "",
  ].join("\n");
}

// AI : single-file Go export — structs + step bodies + orchestrator for LOC comparison.
export function generatePipelineSourceGo(project: Project): string {
  const prepared = prepareExportProject(project);
  const needs = analyzeExportRuntimeNeeds(prepared);
  const runtimeStubs = generateRuntimeStubsGo(needs);
  const sections: string[] = [];
  const stepFnName = makeUniqueStepFnName();
  const stepFns = prepared.modules.map((m, i) => generateStepFnGo(m, prepared, i, stepFnName)).join("\n");
  const orchestrator = generateOrchestratorGo(prepared, stepFnName);

  sections.push(
    "// Generated pipeline export — equivalent Go representation",
    `// Project: ${prepared.name}`,
    `// ${prepared.modules.length} steps · ${prepared.models.length} structures`,
    "// Setup: export also includes .env.example and README.md — copy .env.example → .env",
    "// Stdlib: encoding/json, net/http (see README.md)",
    "",
    "package pipeline",
    "",
    goImports(needs, prepared),
    "",
    "// === structures ===",
    allModelsToGo(prepared.models, prepared.typeAliases ?? []),
    "",
    "// === pipeline state ===",
    pipelineStateGoType(prepared),
    "",
    runtimeStubs,
    "",
    "// === steps ===",
    stepFns,
    "// === orchestrator ===",
    orchestrator,
  );

  return withExportLineCountMeta(sections.join("\n"), prepared, "//");
}

export { assertNoEnvKeysInExport, findEnvLeaksInExport } from "./pipeline_export_shared";
