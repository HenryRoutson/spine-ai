import { assertEntriesForModule, wrapAssertPython } from "@/lib/assert_steps";
import { customCodeEntriesForModule } from "@/lib/custom_code_entries";
import { allModelsToPydantic } from "./pydantic";
import {
  assertNoEnvKeysInExport,
  exportSpineInPy,
  generateCombineStepBodyPy,
  generateInputStepBodyPy,
  generateOrchestratorPy,
  modelName,
  prepareExportProject,
  pyCustomCodeCall,
} from "./pipeline_export_shared";
import { analyzeExportRuntimeNeeds, generateRuntimeStubsPy } from "./pipeline_export_setup";
import { pipelineStatePyTypedDict } from "./pipeline_state";
import { labelToPyKey, stepSpineOutType, typeExprToPy } from "./type_expr";
import { MODULE_META } from "./types";
import type { PipelineModule, Project } from "./types";

// AI : TODO export — inline real JSON schemas for llm / llm-batch steps (from structure models).

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

function pyStringLiteral(s: string): string {
  return JSON.stringify(s);
}

function pyPrimaryCustomCode(m: PipelineModule): { language: string; code: string } | null {
  const entries = customCodeEntriesForModule(m);
  const primary = entries[0];
  if (!primary?.code.trim()) return null;
  return { language: primary.language, code: primary.code.trim() };
}

function inlinePythonCustomCode(code: string): string {
  if (/^\s*def\s+\w+\s*\(/.test(code)) {
    return [`${code}`, pyCustomCodeCall(code)].join("\n");
  }
  return [`__fn = ${code}`, pyCustomCodeCall(code)].join("\n");
}

function generateStepBody(m: PipelineModule, project: Project, outPy: string): string {
  const outName = modelName(project, m.outStructureId);
  const inName = modelName(project, m.inStructureId);

  switch (m.kind) {
    case "input":
      return generateInputStepBodyPy(m);
    case "llm": {
      // AI : TODO export — replace schema placeholder with generated JSON Schema from outStructureId.
      const prompt = m.prompt ?? "Process the input.";
      const model = m.model ?? "deepseek-v3";
      return [
        `# Structured LLM call → ${outName ?? outPy}${m.outIsList ? "[]" : ""}`,
        `model = ${pyStringLiteral(model)}`,
        `user_prompt = ${pyStringLiteral(prompt)} + "\\n\\nINPUT DATA:\\n" + json.dumps(input, indent=2)`,
        `schema = None  # JSON schema for ${outName ?? "output"}`,
        "return await llm_structured(user_prompt, schema)",
      ].join("\n");
    }
    case "llm-batch": {
      const prompt = m.prompt ?? "Process the item.";
      return [
        `# One structured LLM call per list item → ${outName ?? outPy}[]`,
        "items = input if isinstance(input, list) else [input]",
        `prompt_for = lambda item: ${pyStringLiteral(prompt)} + "\\n\\nITEM:\\n" + json.dumps(item, indent=2)`,
        `schema = None  # JSON schema for ${outName ?? "output"}`,
        "return await llm_batch_structured(items, prompt_for, schema)",
      ].join("\n");
    }
    case "quote":
      return [
        "# Match LLM quote strings against source document byte offsets (no LLM cost)",
        "return resolve_quotes(input, '', '')",
      ].join("\n");
    case "combine":
      return generateCombineStepBodyPy(m, project);
    case "transform": {
      const custom = pyPrimaryCustomCode(m);
      if (custom?.language === "python") {
        return inlinePythonCustomCode(custom.code);
      }
      if (custom?.language === "typescript") {
        return [
          "# TypeScript transform (not inlined):",
          ...custom.code.split("\n").map((line) => `# ${line}`),
          "return input",
        ].join("\n");
      }
      return [
        `# Reshape ${inName ?? "input"} → ${outName ?? outPy}${m.outIsList ? " (list)" : ""}`,
        "return input",
      ].join("\n");
    }
    case "custom-code": {
      const custom = pyPrimaryCustomCode(m);
      const fallbacks = customCodeEntriesForModule(m);
      if (custom?.language === "python") {
        const lines = inlinePythonCustomCode(custom.code).split("\n");
        if (fallbacks.length > 1) {
          lines.unshift(`# ${fallbacks.length} fallback implementations — first shown`);
        }
        return lines.join("\n");
      }
      if (custom?.language === "typescript") {
        return [
          `# TypeScript custom code (${fallbacks.length} attempt${fallbacks.length === 1 ? "" : "s"})`,
          ...custom.code.split("\n").map((line) => `# ${line}`),
          "return input",
        ].join("\n");
      }
      return ["# Passthrough — no custom code configured", "return input"].join("\n");
    }
    case "assert": {
      const entries = assertEntriesForModule(m);
      const expectations = project.expectedOutputs ?? {};
      if (entries[0]?.language === "python") {
        return [
          "# Validate pipeline state — passthrough on success",
          wrapAssertPython(entries[0].code, expectations),
          "transform(input, state)",
          "return input",
        ].join("\n\n");
      }
      if (entries[0]?.language === "typescript") {
        return [
          "# TypeScript assert (not inlined):",
          ...entries[0].code.split("\n").map((line) => `# ${line}`),
          "return input",
        ].join("\n");
      }
      return ["# Assert passthrough", "return input"].join("\n");
    }
    case "human-review":
      return [
        "# Pause for operator approval in Inference tab",
        "await wait_for_human_review(input)",
        "return input",
      ].join("\n");
    case "output":
      return [`# Snapshot ${outName ?? inName ?? "pipeline output"}`, "return input"].join("\n");
    default:
      return "return input";
  }
}

function generateStepFn(m: PipelineModule, project: Project, index: number): string {
  const fn = stepFnName(m, index);
  const inPy = exportSpineInPy(m, project, index);
  const outType = stepSpineOutType(m);
  const outPy = outType ? typeExprToPy(outType, project.models) : "Any";
  const meta = MODULE_META[m.kind];
  const docLines = [
    m.label,
    `Kind: ${meta.label}`,
    ...(m.note ? [m.note] : []),
    ...(m.model ? [`Model: ${m.model}`] : []),
    ...(m.cached ? ["Cached: true"] : []),
  ];
  const header = [
    `async def ${fn}(input: ${inPy}, state: PipelineState) -> ${outPy}:`,
    `    """${docLines.join(" · ").replace(/"""/g, "''")}"""`,
  ];
  const body = generateStepBody(m, project, outPy);
  return [...header, indentBlock(body, 4), "", ""].join("\n");
}

// AI : single-file Python export — models + step bodies + orchestrator for LOC comparison.
export function generatePipelineSourcePy(project: Project): string {
  const prepared = prepareExportProject(project);
  const needs = analyzeExportRuntimeNeeds(prepared);
  const runtimeStubs = generateRuntimeStubsPy(needs);
  const sections: string[] = [];
  const stepFns = prepared.modules.map((m, i) => generateStepFn(m, prepared, i)).join("\n");
  const orchestrator = generateOrchestratorPy(prepared, stepFnName);

  sections.push(
    '"""Generated pipeline export — equivalent Python representation"""',
    `# Project: ${prepared.name}`,
    `# ${prepared.modules.length} steps · ${prepared.models.length} structures`,
    "# Setup: export also includes .env.example and SETUP.md — copy .env.example → .env",
    "",
    "from __future__ import annotations",
    "",
    "import json",
    "from typing import Any",
    "",
    "# === structures ===",
    allModelsToPydantic(prepared.models, prepared.typeAliases ?? []),
    "",
    "# === pipeline state ===",
    pipelineStatePyTypedDict(prepared),
    "",
    runtimeStubs,
    "",
    "# === steps ===",
    stepFns,
    "# === orchestrator ===",
    orchestrator,
  );

  const content = sections.join("\n");
  const lineCount = content.split("\n").length;
  const withMeta = content.replace(
    `# ${prepared.modules.length} steps · ${prepared.models.length} structures`,
    `# ${prepared.modules.length} steps · ${prepared.models.length} structures · ${lineCount} lines`,
  );
  assertNoEnvKeysInExport(withMeta);
  return withMeta;
}

export { assertNoEnvKeysInExport, findEnvLeaksInExport } from "./pipeline_export_shared";
