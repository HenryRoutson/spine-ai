import { assertEntriesForModule, wrapAssertTypeScriptForExport } from "@/lib/assert_steps";
import { customCodeEntriesForModule } from "@/lib/custom_code_entries";
import { generateModelsDts } from "./type_codegen";
import {
  assertNoEnvKeysInExport,
  exportSpineInTs,
  generateCombineStepBodyTs,
  generateCustomCodeStepBodyTs,
  generateInputStepBodyTs,
  generateOrchestratorTs,
  modelName,
  prepareExportProject,
} from "./pipeline_export_shared";
import { analyzeExportRuntimeNeeds, generateRuntimeStubsTs } from "./pipeline_export_setup";
import { pipelineStateTsInterface } from "./pipeline_state";
import { labelToPyKey, stepSpineOutType, typeExprToTs } from "./type_expr";
import { MODULE_META } from "./types";
import type { PipelineModule, Project } from "./types";

// AI : TODO export — inline real JSON schemas for llm / llm-batch steps (from structure models).
// AI : TODO export — emit only pipeline-referenced structures, not every project model.

function stepFnName(m: PipelineModule, index: number): string {
  const key = labelToPyKey(m.label);
  return key !== "_empty" ? `step_${key}` : `step_${index}`;
}

function indentBlock(code: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return code
    .split("\n")
    .map((line) => (line ? `${pad}${line}` : line))
    .join("\n");
}

function tsPrimaryCustomCode(m: PipelineModule): { language: string; code: string } | null {
  const entries = customCodeEntriesForModule(m);
  const primary = entries[0];
  if (!primary?.code.trim()) return null;
  return { language: primary.language, code: primary.code.trim() };
}

function generateStepBody(m: PipelineModule, project: Project, outTs: string, inTs: string): string {
  const outName = modelName(project, m.outStructureId);
  const inName = modelName(project, m.inStructureId);

  switch (m.kind) {
    case "input":
      return generateInputStepBodyTs(m, outTs);
    case "llm": {
      // AI : TODO export — replace schema placeholder with generated JSON Schema from outStructureId.
      const prompt = m.prompt ?? "Process the input.";
      const model = m.model ?? "/* global default model */";
      return [
        `// Structured LLM call → ${outName ?? outTs}${m.outIsList ? "[]" : ""}`,
        `const _model = ${typeof model === "string" && model.startsWith("/*") ? `"deepseek-v3"` : JSON.stringify(model)};`,
        `void _model;`,
        `const userPrompt = ${JSON.stringify(prompt)} + "\\n\\nINPUT DATA:\\n" + JSON.stringify(input, null, 2);`,
        `const schema = /* JSON schema for ${outName ?? "output"} */ {};`,
        `return await llmStructured<${outTs}>(userPrompt, schema);`,
      ].join("\n");
    }
    case "llm-batch": {
      const prompt = m.prompt ?? "Process the item.";
      const itemTs = outTs.endsWith("[]") ? outTs.slice(0, -2) : outTs;
      return [
        `// One structured LLM call per list item → ${outName ?? outTs}`,
        "const items = Array.isArray(input) ? input : [input];",
        `const promptFor = (item: unknown) => ${JSON.stringify(prompt)} + "\\n\\nITEM:\\n" + JSON.stringify(item, null, 2);`,
        `const schema = /* JSON schema for ${outName ?? "output"} */ {};`,
        `return await llmBatchStructured<${itemTs}>(items, promptFor, schema);`,
      ].join("\n");
    }
    case "quote":
      return [
        "// Match LLM quote strings against source document byte offsets (no LLM cost)",
        `return resolveQuotes(input, "", "") as unknown as ${outTs};`,
      ].join("\n");
    case "combine":
      return generateCombineStepBodyTs(m, project, outTs);
    case "transform": {
      const custom = tsPrimaryCustomCode(m);
      if (custom?.language === "typescript") {
        return generateCustomCodeStepBodyTs(custom.code, inTs, outTs);
      }
      if (custom?.language === "python") {
        return [`// Python transform (not inlined):`, `// ${custom.code.split("\n").join("\n// ")}`, `return input as unknown as ${outTs};`].join("\n");
      }
      return [
        `// Reshape ${inName ?? "input"} → ${outName ?? outTs}${m.outIsList ? " (list)" : ""}`,
        `return input as unknown as ${outTs};`,
      ].join("\n");
    }
    case "custom-code": {
      const custom = tsPrimaryCustomCode(m);
      const fallbacks = customCodeEntriesForModule(m);
      if (custom?.language === "typescript") {
        const lines = [generateCustomCodeStepBodyTs(custom.code, inTs, outTs)];
        if (fallbacks.length > 1) {
          lines.unshift(`// ${fallbacks.length} fallback implementations — first shown`);
        }
        return lines.join("\n");
      }
      if (custom?.language === "python") {
        return [
          `// Python custom code (${fallbacks.length} attempt${fallbacks.length === 1 ? "" : "s"})`,
          `// ${custom.code.split("\n").join("\n// ")}`,
          `return input as unknown as ${outTs};`,
        ].join("\n");
      }
      return [`// Passthrough — no custom code configured`, `return input as unknown as ${outTs};`].join("\n");
    }
    case "assert": {
      const entries = assertEntriesForModule(m);
      const expectations = project.expectedOutputs ?? {};
      if (entries[0]?.language === "typescript") {
        const wrapped = wrapAssertTypeScriptForExport(entries[0].code, expectations);
        return [
          "// Validate pipeline state — passthrough on success",
          `const __assert = ${wrapped};`,
          "__assert(input, state);",
          `return input as unknown as ${outTs};`,
        ].join("\n");
      }
      return [`// Assert passthrough`, `return input as unknown as ${outTs};`].join("\n");
    }
    case "human-review":
      return [
        "// Pause for operator approval in Inference tab",
        "await waitForHumanReview(input);",
        `return input as unknown as ${outTs};`,
      ].join("\n");
    case "output":
      return [
        `// Snapshot ${outName ?? inName ?? "pipeline output"}`,
        `return input as unknown as ${outTs};`,
      ].join("\n");
    default:
      return `return input as unknown as ${outTs};`;
  }
}

function stepBodyUsesPipelineState(body: string): boolean {
  return /\bstate\s*\[|__assert\(input,\s*state\)|__compiled\.length >= 2/.test(body);
}

function generateStepFn(m: PipelineModule, project: Project, index: number): string {
  const fn = stepFnName(m, index);
  const inTs = exportSpineInTs(m, project, index);
  const outType = stepSpineOutType(m);
  const outTs = outType ? typeExprToTs(outType, project.models) : "unknown";
  const meta = MODULE_META[m.kind];
  const body = generateStepBody(m, project, outTs, inTs);
  const stateParam = stepBodyUsesPipelineState(body) ? "state" : "_state";
  const header = [
    `/**`,
    ` * ${m.label.replace(/\*\//g, "*\\/")}`,
    ` * @kind ${meta.label}`,
    ...(m.note ? [` * ${m.note.replace(/\*\//g, "*\\/")}`] : []),
    ...(m.model ? [` * @model ${m.model}`] : []),
    ...(m.cached ? [` * @cached true`] : []),
    ` */`,
    `async function ${fn}(input: ${inTs}, ${stateParam}: PipelineState): Promise<${outTs}> {`,
  ];
  return [...header, indentBlock(body, 2), "}", ""].join("\n");
}

// AI : single-file TS export — types + step bodies + orchestrator for LOC comparison.
export function generatePipelineSourceTs(project: Project): string {
  const prepared = prepareExportProject(project);
  const needs = analyzeExportRuntimeNeeds(prepared);
  const runtimeStubs = generateRuntimeStubsTs(needs);
  const sections: string[] = [];
  const stepFns = prepared.modules.map((m, i) => generateStepFn(m, prepared, i)).join("\n");
  const orchestrator = generateOrchestratorTs(prepared, stepFnName);

  sections.push(
    "// Generated pipeline export — equivalent TypeScript representation",
    `// Project: ${prepared.name}`,
    `// ${prepared.modules.length} steps · ${prepared.models.length} structures`,
    "// Setup: export also includes .env.example and SETUP.md — copy .env.example → .env",
    "",
    "// === structures ===",
    generateModelsDts(prepared.models, prepared.typeAliases ?? []),
    "",
    "// === pipeline state ===",
    pipelineStateTsInterface(prepared),
    "",
    runtimeStubs,
    "",
    "// === steps ===",
    stepFns,
    "// === orchestrator ===",
    orchestrator,
  );

  const content = sections.join("\n");
  const lineCount = content.split("\n").length;
  const withMeta = content.replace(
    `// ${prepared.modules.length} steps · ${prepared.models.length} structures`,
    `// ${prepared.modules.length} steps · ${prepared.models.length} structures · ${lineCount} lines`,
  );
  assertNoEnvKeysInExport(withMeta);
  return withMeta;
}

export { assertNoEnvKeysInExport, findEnvLeaksInExport } from "./pipeline_export_shared";
