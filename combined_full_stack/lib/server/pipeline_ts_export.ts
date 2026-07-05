import { assertEntriesForModule, wrapAssertTypeScript } from "@/lib/assert_steps";
import { customCodeEntriesForModule } from "@/lib/custom_code_entries";
import { generateModelsDts } from "./type_codegen";
import {
  assertNoEnvKeysInExport,
  exportSpineInTs,
  generateCombineStepBodyTs,
  generateInputStepBodyTs,
  generateOrchestratorTs,
  modelName,
  prepareExportProject,
  tsCustomCodeCall,
} from "./pipeline_export_shared";
import { pipelineStateTsInterface } from "./pipeline_state";
import { labelToPyKey, stepSpineOutType, typeExprToTs } from "./type_expr";
import { MODULE_META } from "./types";
import type { PipelineModule, Project } from "./types";

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

function generateStepBody(m: PipelineModule, project: Project, outTs: string): string {
  const outName = modelName(project, m.outStructureId);
  const inName = modelName(project, m.inStructureId);

  switch (m.kind) {
    case "input":
      return generateInputStepBodyTs(m, outTs);
    case "llm": {
      const prompt = m.prompt ?? "Process the input.";
      const model = m.model ?? "/* global default model */";
      return [
        `// Structured LLM call → ${outName ?? outTs}${m.outIsList ? "[]" : ""}`,
        `const model = ${typeof model === "string" && model.startsWith("/*") ? `"deepseek-v3"` : JSON.stringify(model)};`,
        `const userPrompt = ${JSON.stringify(prompt)} + "\\n\\nINPUT DATA:\\n" + JSON.stringify(input, null, 2);`,
        `const schema = /* JSON schema for ${outName ?? "output"} */ {};`,
        `return await llmStructured<${outTs}>(userPrompt, schema);`,
      ].join("\n");
    }
    case "llm-batch": {
      const prompt = m.prompt ?? "Process the item.";
      return [
        `// One structured LLM call per list item → ${outName ?? outTs}[]`,
        "const items = Array.isArray(input) ? input : [input];",
        `const promptFor = (item: unknown) => ${JSON.stringify(prompt)} + "\\n\\nITEM:\\n" + JSON.stringify(item, null, 2);`,
        `const schema = /* JSON schema for ${outName ?? "output"} */ {};`,
        `return await llmBatchStructured<${outTs}>(items, promptFor, schema);`,
      ].join("\n");
    }
    case "quote":
      return [
        "// Match LLM quote strings against source document byte offsets (no LLM cost)",
        `return resolveQuotes(input, SOURCE_TEXT, SOURCE_DOC_ID) as ${outTs};`,
      ].join("\n");
    case "combine":
      return generateCombineStepBodyTs(m, project, outTs);
    case "transform": {
      const custom = tsPrimaryCustomCode(m);
      if (custom?.language === "typescript") {
        return [`const __fn = ${custom.code};`, tsCustomCodeCall(custom.code, outTs)].join("\n");
      }
      if (custom?.language === "python") {
        return [`// Python transform (not inlined):`, `// ${custom.code.split("\n").join("\n// ")}`, `return input as ${outTs};`].join("\n");
      }
      return [
        `// Reshape ${inName ?? "input"} → ${outName ?? outTs}${m.outIsList ? " (list)" : ""}`,
        `return input as ${outTs};`,
      ].join("\n");
    }
    case "custom-code": {
      const custom = tsPrimaryCustomCode(m);
      const fallbacks = customCodeEntriesForModule(m);
      if (custom?.language === "typescript") {
        const lines = [`const __fn = ${custom.code};`, tsCustomCodeCall(custom.code, outTs)];
        if (fallbacks.length > 1) {
          lines.unshift(`// ${fallbacks.length} fallback implementations — first shown`);
        }
        return lines.join("\n");
      }
      if (custom?.language === "python") {
        return [
          `// Python custom code (${fallbacks.length} attempt${fallbacks.length === 1 ? "" : "s"})`,
          `// ${custom.code.split("\n").join("\n// ")}`,
          `return input as ${outTs};`,
        ].join("\n");
      }
      return [`// Passthrough — no custom code configured`, `return input as ${outTs};`].join("\n");
    }
    case "assert": {
      const entries = assertEntriesForModule(m);
      const expectations = project.expectedOutputs ?? {};
      if (entries[0]?.language === "typescript") {
        const wrapped = wrapAssertTypeScript(entries[0].code, expectations);
        return [
          "// Validate pipeline state — passthrough on success",
          `const __assert = ${wrapped};`,
          "__assert(input, state);",
          `return input as ${outTs};`,
        ].join("\n");
      }
      return [`// Assert passthrough`, `return input as ${outTs};`].join("\n");
    }
    case "human-review":
      return [
        "// Pause for operator approval in Inference tab",
        "await waitForHumanReview(input);",
        `return input as ${outTs};`,
      ].join("\n");
    case "output":
      return [
        `// Snapshot ${outName ?? inName ?? "pipeline output"}`,
        `return input as ${outTs};`,
      ].join("\n");
    default:
      return `return input as ${outTs};`;
  }
}

function generateStepFn(m: PipelineModule, project: Project, index: number): string {
  const fn = stepFnName(m, index);
  const inTs = exportSpineInTs(m, project, index);
  const outType = stepSpineOutType(m);
  const outTs = outType ? typeExprToTs(outType, project.models) : "unknown";
  const meta = MODULE_META[m.kind];
  const header = [
    `/**`,
    ` * ${m.label.replace(/\*\//g, "*\\/")}`,
    ` * @kind ${meta.label}`,
    ...(m.note ? [` * ${m.note.replace(/\*\//g, "*\\/")}`] : []),
    ...(m.model ? [` * @model ${m.model}`] : []),
    ...(m.cached ? [` * @cached true`] : []),
    ` */`,
    `async function ${fn}(input: ${inTs}, state: PipelineState): Promise<${outTs}> {`,
  ];
  const body = generateStepBody(m, project, outTs);
  return [...header, indentBlock(body, 2), "}", ""].join("\n");
}

const RUNTIME_STUBS = `
// --- runtime stubs (replace with your implementations) ---
declare const SOURCE_TEXT: string;
declare const SOURCE_DOC_ID: string;

async function llmStructured<T>(prompt: string, _schema: unknown): Promise<T> {
  throw new Error("wire llmStructured to your LLM client");
}

async function llmBatchStructured<T>(
  items: unknown[],
  promptFor: (item: unknown) => string,
  schema: unknown,
): Promise<T[]> {
  return Promise.all(items.map((item) => llmStructured<T>(promptFor(item), schema)));
}

function resolveQuotes<T>(data: unknown, _sourceText: string, _docId: string): T {
  throw new Error("wire resolveQuotes to your quote linker");
}

async function waitForHumanReview<T>(_input: T): Promise<void> {
  throw new Error("wire waitForHumanReview to your review UI");
}
`.trim();

// AI : single-file TS export — types + step bodies + orchestrator for LOC comparison.
export function generatePipelineSourceTs(project: Project): string {
  const prepared = prepareExportProject(project);
  const sections: string[] = [];
  const stepFns = prepared.modules.map((m, i) => generateStepFn(m, prepared, i)).join("\n");
  const orchestrator = generateOrchestratorTs(prepared, stepFnName);

  sections.push(
    "// Generated pipeline export — equivalent TypeScript representation",
    `// Project: ${prepared.name}`,
    `// ${prepared.modules.length} steps · ${prepared.models.length} structures`,
    "",
    "// === structures ===",
    generateModelsDts(prepared.models, prepared.typeAliases ?? []),
    "",
    "// === pipeline state ===",
    pipelineStateTsInterface(prepared),
    "",
    RUNTIME_STUBS,
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
