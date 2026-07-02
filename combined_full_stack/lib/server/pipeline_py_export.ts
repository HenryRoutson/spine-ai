import { assertEntriesForModule, wrapAssertPython } from "@/lib/assert_steps";
import { customCodeEntriesForModule } from "@/lib/custom_code_entries";
import { allModelsToPydantic } from "./pydantic";
import { labelAsStateKey, pipelineStatePyTypedDict } from "./pipeline_state";
import { labelToPyKey, stepSpineInType, stepSpineOutType, typeExprToPy } from "./type_expr";
import { MODULE_META } from "./types";
import type { PipelineModule, Project, StructureModelId } from "./types";

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

function modelName(project: Project, id: StructureModelId | undefined): string | undefined {
  if (!id) return undefined;
  return project.models.find((m) => m.id === id)?.name;
}

function pyPrimaryCustomCode(m: PipelineModule): { language: string; code: string } | null {
  const entries = customCodeEntriesForModule(m);
  const primary = entries[0];
  if (!primary?.code.trim()) return null;
  return { language: primary.language, code: primary.code.trim() };
}

function inlinePythonCustomCode(code: string, outPy: string): string {
  if (/^\s*def\s+\w+\s*\(/.test(code)) {
    return [`${code}`, `return transform(input, state)  # type: ignore[name-defined]`].join("\n");
  }
  return [`__fn = ${code}`, `return __fn(input, state)`].join("\n");
}

function generateStepBody(m: PipelineModule, project: Project, outPy: string): string {
  const outName = modelName(project, m.outStructureId);
  const inName = modelName(project, m.inStructureId);

  switch (m.kind) {
    case "input": {
      const lines = [
        "# Parse uploaded file — built-in parser or vision OCR when enabled",
        ...(m.inputDescription
          ? [`# Input guard: ${pyStringLiteral(m.inputDescription)}${m.checkInputDescription === false ? " (disabled)" : ""}`]
          : []),
        ...(m.inputNameContains ? [`# Filename must contain: ${pyStringLiteral(m.inputNameContains)}`] : []),
        ...(m.useOcr ? ["# Vision OCR enabled for PDF/image uploads"] : []),
        "doc = input",
        'return {"content": doc["content"], "filename": doc["filename"]}',
      ];
      return lines.join("\n");
    }
    case "llm": {
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
        "return resolve_quotes(input, SOURCE_TEXT, SOURCE_DOC_ID)",
      ].join("\n");
    case "combine": {
      const out = project.models.find((x) => x.id === m.outStructureId);
      const fieldNames = out?.fields.map((f) => f.name) ?? [];
      return [
        `# Merge new document input with upstream ${inName ?? "pipeline data"}`,
        "new_doc = input[0] if isinstance(input, list) else input",
        `pipeline_data = None  # upstream ${inName ?? "structure"}`,
        `merged = {${fieldNames.map((n) => `"${n}": None  # from doc or pipeline`).join(", ")}}`,
        "return merged",
      ].join("\n");
    }
    case "transform": {
      const custom = pyPrimaryCustomCode(m);
      if (custom?.language === "python") {
        return inlinePythonCustomCode(custom.code, outPy);
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
        const lines = inlinePythonCustomCode(custom.code, outPy).split("\n");
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
  const inType = stepSpineInType(m);
  const outType = stepSpineOutType(m);
  const inPy = inType ? typeExprToPy(inType, project.models) : "Any";
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

function generateRunPipeline(project: Project): string {
  const lines = [
    "async def run_pipeline(initial_input: Any) -> Any:",
    "    state: PipelineState = {}",
    "    spine = initial_input",
    "",
  ];

  for (let i = 0; i < project.modules.length; i++) {
    const m = project.modules[i]!;
    const fn = stepFnName(m, i);
    const label = labelAsStateKey(m.label);
    lines.push(`    # ${i + 1}. ${m.label} (${MODULE_META[m.kind].label})`);
    lines.push(`    spine = await ${fn}(spine, state)`);
    if (label) lines.push(`    state[${pyStringLiteral(label)}] = spine`);
    lines.push("");
  }

  lines.push("    return spine", "");
  return lines.join("\n");
}

const RUNTIME_STUBS = `
# --- runtime stubs (replace with your implementations) ---
SOURCE_TEXT: str = ""
SOURCE_DOC_ID: str = ""

async def llm_structured(prompt: str, schema: Any) -> Any:
    raise NotImplementedError("wire llm_structured to your LLM client")

async def llm_batch_structured(
    items: list[Any],
    prompt_for: Any,
    schema: Any,
) -> list[Any]:
    return [await llm_structured(prompt_for(item), schema) for item in items]

def resolve_quotes(data: Any, source_text: str, doc_id: str) -> Any:
    raise NotImplementedError("wire resolve_quotes to your quote linker")

async def wait_for_human_review(input: Any) -> None:
    raise NotImplementedError("wire wait_for_human_review to your review UI")
`.trim();

// AI : single-file Python export — models + step bodies + orchestrator for LOC comparison.
export function generatePipelineSourcePy(project: Project): string {
  const sections: string[] = [];
  const stepFns = project.modules.map((m, i) => generateStepFn(m, project, i)).join("\n");
  const orchestrator = generateRunPipeline(project);

  sections.push(
    '"""Generated pipeline export — equivalent Python representation"""',
    `# Project: ${project.name}`,
    `# ${project.modules.length} steps · ${project.models.length} structures`,
    "",
    "from __future__ import annotations",
    "",
    "import json",
    "from typing import Any",
    "",
    "# === structures ===",
    allModelsToPydantic(project.models, project.typeAliases ?? []),
    "",
    "# === pipeline state ===",
    pipelineStatePyTypedDict(project),
    "",
    RUNTIME_STUBS,
    "",
    "# === steps ===",
    stepFns,
    "# === orchestrator ===",
    orchestrator,
  );

  const content = sections.join("\n");
  const lineCount = content.split("\n").length;
  return content.replace(
    `# ${project.modules.length} steps · ${project.models.length} structures`,
    `# ${project.modules.length} steps · ${project.models.length} structures · ${lineCount} lines`,
  );
}
