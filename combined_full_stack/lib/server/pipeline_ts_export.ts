import { assertEntriesForModule, wrapAssertTypeScriptForExport } from "@/lib/assert_steps";
import { customCodeEntriesForModule } from "@/lib/custom_code_entries";
import { generateModelsDts } from "./type_codegen";
import {
  assertPassthroughComment,
  assertValidateComment,
  chatbotComment,
  exampleSelectComment,
  exportComment,
  exportFileMetaComments,
  exportSectionComment,
  fallbacksFirstComment,
  humanReviewComment,
  indentExportBlock,
  llmBatchComment,
  passthroughCustomComment,
  primaryExportCustomCode,
  quoteLinkComment,
  reshapeStepComment,
  snapshotComment,
  stepFnNameFromLabel,
  structuredLlmComment,
  withExportLineCountMeta,
  exportSpineInTs,
  exportSpineOutTs,
  generateCombineStepBodyTs,
  generateAssembleStepBodyTs,
  generateParallelStepBodyTs,
  generateCustomCodeStepBodyTs,
  generateExampleContextExprTs,
  generateInputStepBodyTs,
  generateOrchestratorTs,
  modelName,
  pipelineStateTsInterfaceForExport,
  prepareExportProject,
} from "./pipeline_export_shared";
import { analyzeExportRuntimeNeeds, generateRuntimeStubsTs } from "./pipeline_export_setup";
import { isMergeModuleKind } from "@/lib/module-kinds";
import { exportWebhookStepBodyTs, webhookStepUsesPipelineState } from "@/lib/webhook-step";
import { MODULE_META, ModuleKind } from "./types";
import { stepEmitsList } from "./type_expr";
import type { PipelineModule, Project } from "./types";

// AI : TODO export — inline real JSON schemas for llm / llm-batch steps (from structure models).
// AI : TODO export — emit only pipeline-referenced structures, not every project model.

const C = "//" as const;

function generateStepBody(m: PipelineModule, project: Project, outTs: string, inTs: string): string {
  const outName = modelName(project, m.outStructureId);
  const inName = modelName(project, m.inStructureId);

  if (isMergeModuleKind(m.kind) || m.kind === ModuleKind.Chunk || m.kind === ModuleKind.CustomCode) {
    const custom = primaryExportCustomCode(m);
    const fallbacks = customCodeEntriesForModule(m);
    if (custom?.language === "typescript") {
      const lines = [generateCustomCodeStepBodyTs(custom.code, inTs, outTs)];
      if (fallbacks.length > 1) {
        lines.unshift(exportComment(C, fallbacksFirstComment(fallbacks.length)));
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
    return [exportComment(C, passthroughCustomComment()), `return input as unknown as ${outTs};`].join("\n");
  }

  switch (m.kind) {
    case ModuleKind.Input:
      return generateInputStepBodyTs(m, outTs);
    case ModuleKind.Llm: {
      // AI : TODO export — replace schema placeholder with generated JSON Schema from outStructureId.
      const prompt = m.prompt ?? "Process the input.";
      const model = m.model ?? "/* global default model */";
      return [
        exportComment(C, structuredLlmComment(outName ?? outTs, stepEmitsList(m))),
        `const _model = ${typeof model === "string" && model.startsWith("/*") ? `"deepseek-v4"` : JSON.stringify(model)};`,
        `void _model;`,
        `const userPrompt = ${JSON.stringify(prompt)} + "\\n\\nINPUT DATA:\\n" + JSON.stringify(input, null, 2);`,
        `const schema = /* JSON schema for ${outName ?? "output"} */ {};`,
        `return await llmStructured<${outTs}>(userPrompt, schema);`,
      ].join("\n");
    }
    case ModuleKind.LlmBatch: {
      const prompt = m.prompt ?? "Process the item.";
      const itemTs = outTs.endsWith("[]") ? outTs.slice(0, -2) : outTs;
      return [
        exportComment(C, llmBatchComment(outName ?? outTs)),
        "const items = Array.isArray(input) ? input : [input];",
        `const promptFor = (item: unknown) => ${JSON.stringify(prompt)} + "\\n\\nITEM:\\n" + JSON.stringify(item, null, 2);`,
        `const schema = /* JSON schema for ${outName ?? "output"} */ {};`,
        `return await llmBatchStructured<${itemTs}>(items, promptFor, schema);`,
      ].join("\n");
    }
    case ModuleKind.ExampleSelect: {
      const prompt = m.prompt ?? "Find useful examples…";
      const ctxLabel = m.exampleContextLabel ?? "Context";
      const descriptionExpr = generateExampleContextExprTs(ctxLabel, m.exampleContextField);
      return [
        exportComment(C, exampleSelectComment(outName ?? outTs)),
        `const description = ${descriptionExpr};`,
        "const items = Array.isArray(input) ? input : [input];",
        `const template = ${JSON.stringify(prompt)};`,
        `const relevanceSchema = { chain_of_thought: "string", is_relevant: "boolean" };`,
        `type RelevanceVerdict = { chain_of_thought?: string; is_relevant?: boolean };`,
        `const verdicts = await llmBatchStructured<RelevanceVerdict>(items, (item: unknown) => template.replace("{description}", description).replace("{example}", JSON.stringify(item)), relevanceSchema);`,
        `return items.filter((_, i) => verdicts[i]?.is_relevant).map((item, i) => ({ ...item, selection_reason: verdicts[i]?.chain_of_thought ?? "" })) as ${outTs};`,
      ].join("\n");
    }
    case ModuleKind.Quote:
      return [
        exportComment(C, quoteLinkComment()),
        `return resolveQuotes(input, "", "") as unknown as ${outTs};`,
      ].join("\n");
    case ModuleKind.Combine:
      return generateCombineStepBodyTs(m, project, outTs);
    case ModuleKind.Assemble:
      return generateAssembleStepBodyTs(m, project, outTs);
    case ModuleKind.Parallel:
      return generateParallelStepBodyTs(m, outTs);
    case ModuleKind.Transform: {
      const custom = primaryExportCustomCode(m);
      if (custom?.language === "typescript") {
        return generateCustomCodeStepBodyTs(custom.code, inTs, outTs);
      }
      if (custom?.language === "python") {
        return [`// Python transform (not inlined):`, `// ${custom.code.split("\n").join("\n// ")}`, `return input as unknown as ${outTs};`].join("\n");
      }
      return [
        exportComment(C, reshapeStepComment(m, inName, outName, outTs)),
        `return input as unknown as ${outTs};`,
      ].join("\n");
    }
    case ModuleKind.Assert: {
      const entries = assertEntriesForModule(m);
      const expectations = project.expectedOutputs ?? {};
      if (entries[0]?.language === "typescript") {
        const wrapped = wrapAssertTypeScriptForExport(entries[0].code, expectations);
        return [
          exportComment(C, assertValidateComment()),
          `const __assert = ${wrapped};`,
          "__assert(input, state);",
          `return input as unknown as ${outTs};`,
        ].join("\n");
      }
      return [exportComment(C, assertPassthroughComment()), `return input as unknown as ${outTs};`].join("\n");
    }
    case ModuleKind.HumanReview:
      return [
        exportComment(C, humanReviewComment()),
        "await waitForHumanReview(input);",
        `return input as unknown as ${outTs};`,
      ].join("\n");
    case ModuleKind.Chatbot:
      return [
        exportComment(C, chatbotComment()),
        "const __chat = await waitForChatbotSession(input as ChatbotPrompt, { mode: " +
          JSON.stringify(m.chatbotMode ?? "until-exit") +
          " });",
        `return __chat as unknown as ${outTs};`,
      ].join("\n");
    case ModuleKind.Webhook:
      return exportWebhookStepBodyTs(m, outTs);
    case ModuleKind.Output:
      return [
        exportComment(C, snapshotComment(outName, inName)),
        `return input as unknown as ${outTs};`,
      ].join("\n");
    default:
      return `return input as unknown as ${outTs};`;
  }
}

function stepBodyUsesPipelineState(body: string, m?: PipelineModule): boolean {
  if (m?.kind === ModuleKind.Webhook && webhookStepUsesPipelineState(m)) return true;
  return /\bstate\s*\[|__assert\(input,\s*state\)|__compiled\.length >= 2/.test(body);
}

function generateStepFn(m: PipelineModule, project: Project, index: number): string {
  const fn = stepFnNameFromLabel(m, index);
  const inTs = exportSpineInTs(m, project, index);
  const outTs = exportSpineOutTs(m, project, index);
  const meta = MODULE_META[m.kind];
  const body = generateStepBody(m, project, outTs, inTs);
  const stateParam = stepBodyUsesPipelineState(body, m) ? "state" : "_state";
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
  return [...header, indentExportBlock(body, 2), "}", ""].join("\n");
}

// AI : single-file TS export — types + step bodies + orchestrator for LOC comparison.
export function generatePipelineSourceTs(project: Project): string {
  const prepared = prepareExportProject(project);
  const needs = analyzeExportRuntimeNeeds(prepared);
  const runtimeStubs = generateRuntimeStubsTs(needs);
  const sections: string[] = [];
  const stepFns = prepared.modules.map((m, i) => generateStepFn(m, prepared, i)).join("\n");
  const orchestrator = generateOrchestratorTs(prepared, stepFnNameFromLabel);

  sections.push(
    "// Generated pipeline export — equivalent TypeScript representation",
    ...exportFileMetaComments(C, prepared),
    "",
    exportSectionComment(C, "structures"),
    generateModelsDts(prepared.models, prepared.typeAliases ?? []),
    "",
    exportSectionComment(C, "pipeline state"),
    pipelineStateTsInterfaceForExport(prepared),
    "",
    runtimeStubs,
    "",
    exportSectionComment(C, "steps"),
    stepFns,
    exportSectionComment(C, "orchestrator"),
    orchestrator,
  );

  return withExportLineCountMeta(sections.join("\n"), prepared, "//");
}

export { assertNoEnvKeysInExport, findEnvLeaksInExport } from "./pipeline_export_shared";
