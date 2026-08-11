import { assertEntriesForModule, wrapAssertPython } from "@/lib/assert_steps";
import { customCodeEntriesForModule } from "@/lib/custom_code_entries";
import { allModelsToPydantic } from "./pydantic";
import {
  assertPassthroughComment,
  assertValidateComment,
  chatbotComment,
  exampleSelectComment,
  exportComment,
  exportFileMetaComments,
  exportSectionComment,
  exportStringLiteral,
  fallbacksFirstComment,
  humanReviewComment,
  indentExportBlock,
  llmBatchComment,
  parallelBranchesComment,
  passthroughCustomComment,
  primaryExportCustomCode,
  quoteLinkComment,
  reshapeStepComment,
  snapshotComment,
  stepFnNameFromLabel,
  structuredLlmComment,
  withExportLineCountMeta,
  exportSpineInPy,
  exportSpineOutPy,
  generateCombineStepBodyPy,
  generateAssembleStepBodyPy,
  generateExampleContextLinesPy,
  generateInputStepBodyPy,
  generateOrchestratorPy,
  modelName,
  pipelineStatePyTypedDictForExport,
  prepareExportProject,
  pyCustomCodeCall,
} from "./pipeline_export_shared";
import { analyzeExportRuntimeNeeds, generateRuntimeStubsPy } from "./pipeline_export_setup";
import { exportWebhookStepBodyPy, webhookStepUsesPipelineState } from "@/lib/webhook-step";
import { isMergeModuleKind } from "@/lib/module-kinds";
import { MODULE_META, ModuleKind } from "./types";
import { stepEmitsList } from "./type_expr";
import type { PipelineModule, Project } from "./types";

// AI : TODO export — inline real JSON schemas for llm / llm-batch steps (from structure models).
// AI : TODO (linter-first) — exported .py is the lint target (pyright on full pipeline export + user custom code).

const C = "#" as const;

function inlinePythonCustomCode(code: string, outPy: string): string {
  if (/^\s*def\s+\w+\s*\(/.test(code)) {
    return [`${code}`, pyCustomCodeCall(code, outPy)].join("\n");
  }
  return [`__fn = ${code}`, pyCustomCodeCall(code, outPy)].join("\n");
}

function generateStepBody(m: PipelineModule, project: Project, outPy: string, inPy: string): string {
  const outName = modelName(project, m.outStructureId);
  const inName = modelName(project, m.inStructureId);
  // AI : cast via object — same pattern as TS `as unknown as T` for intentional spine lies.
  const castOut = (expr: string): string =>
    inPy === outPy ? `return ${expr}` : `return cast(${outPy}, cast(object, ${expr}))`;

  if (isMergeModuleKind(m.kind) || m.kind === ModuleKind.Chunk || m.kind === ModuleKind.CustomCode) {
    const custom = primaryExportCustomCode(m);
    const fallbacks = customCodeEntriesForModule(m);
    if (custom?.language === "python") {
      const lines = inlinePythonCustomCode(custom.code, outPy).split("\n");
      if (fallbacks.length > 1) {
        lines.unshift(exportComment(C, fallbacksFirstComment(fallbacks.length)));
      }
      return lines.join("\n");
    }
    if (custom?.language === "typescript") {
      return [
        `# TypeScript custom code (${fallbacks.length} attempt${fallbacks.length === 1 ? "" : "s"})`,
        ...custom.code.split("\n").map((line) => `# ${line}`),
        castOut("input"),
      ].join("\n");
    }
    return [exportComment(C, passthroughCustomComment()), castOut("input")].join("\n");
  }

  switch (m.kind) {
    case ModuleKind.Input:
      return generateInputStepBodyPy(m, outPy);
    case ModuleKind.Llm: {
      // AI : TODO export — replace schema placeholder with generated JSON Schema from outStructureId.
      const prompt = m.prompt ?? "Process the input.";
      const model = m.model ?? "deepseek-v4";
      return [
        exportComment(C, structuredLlmComment(outName ?? outPy, stepEmitsList(m))),
        `_model = ${exportStringLiteral(model)}`,
        `user_prompt = ${exportStringLiteral(prompt)} + "\\n\\nINPUT DATA:\\n" + json.dumps(input, indent=2, default=str)`,
        `schema = None  # JSON schema for ${outName ?? "output"}`,
        castOut("await llm_structured(user_prompt, schema)"),
      ].join("\n");
    }
    case ModuleKind.LlmBatch: {
      const prompt = m.prompt ?? "Process the item.";
      const itemsLine = inPy.startsWith("list[") ? "items = input" : "items = input if isinstance(input, list) else [input]";
      return [
        exportComment(C, llmBatchComment(outName ?? outPy)),
        itemsLine,
        `def prompt_for(item: Any) -> str:`,
        `    return ${exportStringLiteral(prompt)} + "\\n\\nITEM:\\n" + json.dumps(item, indent=2)`,
        `schema = None  # JSON schema for ${outName ?? "output"}`,
        castOut("await llm_batch_structured(items, prompt_for, schema)"),
      ].join("\n");
    }
    case ModuleKind.ExampleSelect: {
      const prompt = m.prompt ?? "Find useful examples…";
      const ctxLabel = m.exampleContextLabel ?? "Context";
      const itemsLine = inPy.startsWith("list[") ? "items = input" : "items = input if isinstance(input, list) else [input]";
      return [
        exportComment(C, exampleSelectComment(outName ?? outPy)),
        ...generateExampleContextLinesPy(ctxLabel, m.exampleContextField),
        itemsLine,
        `template = ${exportStringLiteral(prompt)}`,
        `def prompt_for(item: Any) -> str:`,
        `    return template.replace("{description}", description).replace("{example}", json.dumps(item, default=str))`,
        `relevance_schema = {"chain_of_thought": "string", "is_relevant": "boolean"}`,
        `verdicts = await llm_batch_structured(items, prompt_for, relevance_schema)`,
        `selected = []`,
        `for i, item in enumerate(items):`,
        `    verdict = verdicts[i] if i < len(verdicts) else {}`,
        `    if isinstance(verdict, dict) and verdict.get("is_relevant"):`,
        `        row = dict(item) if isinstance(item, dict) else (item.model_dump() if hasattr(item, "model_dump") else {"value": item})`,
        `        row["selection_reason"] = verdict.get("chain_of_thought") or ""`,
        `        selected.append(row)`,
        castOut("selected"),
      ].join("\n");
    }
    case ModuleKind.Quote:
      return [
        exportComment(C, quoteLinkComment()),
        castOut("resolve_quotes(input, '', '')"),
      ].join("\n");
    case ModuleKind.Combine:
      return generateCombineStepBodyPy(m, project, outPy, inPy);
    case ModuleKind.Assemble:
      return generateAssembleStepBodyPy(m, project, outPy);
    case ModuleKind.Parallel:
      return [
        exportComment(C, parallelBranchesComment()),
        castOut("{**{}}"),
      ].join("\n");
    case ModuleKind.Transform: {
      const custom = primaryExportCustomCode(m);
      if (custom?.language === "python") {
        return inlinePythonCustomCode(custom.code, outPy);
      }
      if (custom?.language === "typescript") {
        return [
          "# TypeScript transform (not inlined):",
          ...custom.code.split("\n").map((line) => `# ${line}`),
          castOut("input"),
        ].join("\n");
      }
      return [
        exportComment(C, reshapeStepComment(m, inName, outName, outPy)),
        castOut("input"),
      ].join("\n");
    }
    case ModuleKind.Assert: {
      const entries = assertEntriesForModule(m);
      const expectations = project.expectedOutputs ?? {};
      if (entries[0]?.language === "python") {
        return [
          exportComment(C, assertValidateComment()),
          wrapAssertPython(entries[0].code, expectations),
          "transform(input, state)",
          castOut("input"),
        ].join("\n\n");
      }
      if (entries[0]?.language === "typescript") {
        return [
          "# TypeScript assert (not inlined):",
          ...entries[0].code.split("\n").map((line) => `# ${line}`),
          castOut("input"),
        ].join("\n");
      }
      return [exportComment(C, assertPassthroughComment()), castOut("input")].join("\n");
    }
    case ModuleKind.HumanReview:
      return [
        exportComment(C, humanReviewComment()),
        "await wait_for_human_review(input)",
        castOut("input"),
      ].join("\n");
    case ModuleKind.Chatbot:
      return [
        exportComment(C, chatbotComment()),
        `result = await wait_for_chatbot_session(input, mode="${m.chatbotMode ?? "until-exit"}")`,
        castOut("result"),
      ].join("\n");
    case ModuleKind.Webhook:
      return exportWebhookStepBodyPy(m, outPy);
    case ModuleKind.Output:
      return [exportComment(C, snapshotComment(outName, inName)), castOut("input")].join("\n");
    default:
      return castOut("input");
  }
}

function stepBodyUsesPipelineState(body: string, m?: PipelineModule): boolean {
  if (m?.kind === ModuleKind.Webhook && webhookStepUsesPipelineState(m)) return true;
  // AI : real state reads only — ignore commented lines.
  return body
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("#"))
    .some((line) => /\bstate\s*\[|\bstate\.get\b/.test(line));
}

function generateStepFn(m: PipelineModule, project: Project, index: number): string {
  const fn = stepFnNameFromLabel(m, index);
  const inPy = exportSpineInPy(m, project, index);
  const outPy = exportSpineOutPy(m, project, index);
  const meta = MODULE_META[m.kind];
  const body = generateStepBody(m, project, outPy, inPy);
  const stateParam = stepBodyUsesPipelineState(body, m) ? "state" : "_state";
  const docLines = [
    m.label,
    `Kind: ${meta.label}`,
    ...(m.note ? [m.note] : []),
    ...(m.model ? [`Model: ${m.model}`] : []),
    ...(m.cached ? ["Cached: true"] : []),
  ];
  const header = [
    `async def ${fn}(input: ${inPy}, ${stateParam}: PipelineState) -> ${outPy}:`,
    `    """${docLines.join(" · ").replace(/"""/g, "''")}"""`,
  ];
  return [...header, indentExportBlock(body, 4), "", ""].join("\n");
}

// AI : single-file Python export — models + step bodies + orchestrator for LOC comparison.
export function generatePipelineSourcePy(project: Project): string {
  const prepared = prepareExportProject(project);
  const needs = analyzeExportRuntimeNeeds(prepared);
  const runtimeStubs = generateRuntimeStubsPy(needs);
  const sections: string[] = [];
  const stepFns = prepared.modules.map((m, i) => generateStepFn(m, prepared, i)).join("\n");
  const orchestrator = generateOrchestratorPy(prepared, stepFnNameFromLabel);

  sections.push(
    '"""Generated pipeline export — equivalent Python representation"""',
    ...exportFileMetaComments(C, prepared),
    "",
    "from __future__ import annotations",
    "",
    "import json",
    "from dataclasses import dataclass",
    "from typing import Any, Callable, TypedDict, cast",
    "",
    "from pydantic import BaseModel, Field",
    "",
    exportSectionComment(C, "structures"),
    allModelsToPydantic(prepared.models, prepared.typeAliases ?? [], { includeImports: false }),
    "",
    exportSectionComment(C, "pipeline state"),
    pipelineStatePyTypedDictForExport(prepared),
    "",
    runtimeStubs,
    "",
    exportSectionComment(C, "steps"),
    stepFns,
    exportSectionComment(C, "orchestrator"),
    orchestrator,
  );

  return withExportLineCountMeta(sections.join("\n"), prepared, "#");
}

export { assertNoEnvKeysInExport, findEnvLeaksInExport } from "./pipeline_export_shared";
