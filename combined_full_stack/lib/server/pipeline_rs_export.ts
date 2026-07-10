import { assertEntriesForModule } from "@/lib/assert_steps";
import { customCodeEntriesForModule } from "@/lib/custom_code_entries";
import { allModelsToRust } from "./pydantic";
import {
  exportStringLiteral,
  indentExportBlock,
  makeUniqueStepFnName,
  primaryExportCustomCode,
  withExportLineCountMeta,
  exportSpineInRust,
  exportSpineOutRust,
  generateCombineStepBodyRust,
  generateInputStepBodyRust,
  generateOrchestratorRust,
  modelName,
  prepareExportProject,
} from "./pipeline_export_shared";
import { analyzeExportRuntimeNeeds, generateRuntimeStubsRust } from "./pipeline_export_setup";
import { pipelineStateRustType } from "./pipeline_state";
import { MODULE_META } from "./types";
import type { PipelineModule, Project } from "./types";

// AI : TODO export — inline real JSON schemas for llm / llm-batch steps (from structure models).

function commentForeignCode(code: string, langLabel: string): string {
  return [
    `// ${langLabel} (not inlined — port or call via FFI):`,
    ...code.split("\n").map((line) => `// ${line}`),
  ].join("\n");
}

function generateStepBody(m: PipelineModule, project: Project, outRust: string, _inRust: string): string {
  const outName = modelName(project, m.outStructureId);
  const inName = modelName(project, m.inStructureId);

  switch (m.kind) {
    case "input":
      return generateInputStepBodyRust(m, outRust);
    case "llm": {
      const prompt = m.prompt ?? "Process the input.";
      const model = m.model ?? "deepseek-v3";
      return [
        `// Structured LLM call → ${outName ?? outRust}${m.outIsList ? "[]" : ""}`,
        `let _model = ${exportStringLiteral(model)};`,
        `let _ = _model;`,
        `let user_prompt = format!("{}\\n\\nINPUT DATA:\\n{}", ${exportStringLiteral(prompt)}, serde_json::to_string_pretty(&input)?);`,
        `let schema = serde_json::json!({}); // JSON schema for ${outName ?? "output"}`,
        `let value = llm_structured(&user_prompt, &schema).await?;`,
        `let out: ${outRust} = serde_json::from_value(value)?;`,
        "Ok(out)",
      ].join("\n");
    }
    case "llm-batch": {
      const prompt = m.prompt ?? "Process the item.";
      const itemRust = outRust.startsWith("Vec<") && outRust.endsWith(">") ? outRust.slice(4, -1) : outRust;
      return [
        `// One structured LLM call per list item → ${outName ?? outRust}`,
        "let input_value = serde_json::to_value(&input)?;",
        "let items = if let Value::Array(arr) = &input_value { arr.clone() } else { vec![input_value] };",
        `let schema = serde_json::json!({}); // JSON schema for ${outName ?? "output"}`,
        "let mut out = Vec::new();",
        "for item in items {",
        `    let prompt = format!("{}\\n\\nITEM:\\n{}", ${exportStringLiteral(prompt)}, serde_json::to_string_pretty(&item)?);`,
        "    let value = llm_structured(&prompt, &schema).await?;",
        `    out.push(serde_json::from_value::<${itemRust}>(value)?);`,
        "}",
        "Ok(out)",
      ].join("\n");
    }
    case "quote":
      return [
        "// Match LLM quote strings against source document byte offsets (no LLM cost)",
        "let linked = resolve_quotes(&input, \"\", \"\")?;",
        `let out: ${outRust} = serde_json::from_value(linked)?;`,
        "Ok(out)",
      ].join("\n");
    case "combine":
      return generateCombineStepBodyRust(m, project, outRust, _inRust);
    case "transform": {
      const custom = primaryExportCustomCode(m);
      if (custom) {
        return [
          commentForeignCode(custom.code, custom.language === "python" ? "Python transform" : "TypeScript transform"),
          `let out: ${outRust} = serde_json::from_value(serde_json::to_value(&input)?)?;`,
          "Ok(out)",
        ].join("\n");
      }
      return [
        `// Reshape ${inName ?? "input"} → ${outName ?? outRust}${m.outIsList ? " (list)" : ""}`,
        `let out: ${outRust} = serde_json::from_value(serde_json::to_value(&input)?)?;`,
        "Ok(out)",
      ].join("\n");
    }
    case "custom-code": {
      const custom = primaryExportCustomCode(m);
      const fallbacks = customCodeEntriesForModule(m);
      if (custom) {
        const lines = [
          commentForeignCode(
            custom.code,
            `${custom.language === "python" ? "Python" : "TypeScript"} custom code (${fallbacks.length} attempt${fallbacks.length === 1 ? "" : "s"})`,
          ),
          `let out: ${outRust} = serde_json::from_value(serde_json::to_value(&input)?)?;`,
          "Ok(out)",
        ];
        return lines.join("\n");
      }
      return [
        "// Passthrough — no custom code configured",
        `let out: ${outRust} = serde_json::from_value(serde_json::to_value(&input)?)?;`,
        "Ok(out)",
      ].join("\n");
    }
    case "assert": {
      const entries = assertEntriesForModule(m);
      if (entries[0]?.code.trim()) {
        return [
          commentForeignCode(entries[0].code, `${entries[0].language} assert`),
          "// Validate pipeline state — passthrough on success",
          "Ok(input)",
        ].join("\n");
      }
      return ["// Assert passthrough", "Ok(input)"].join("\n");
    }
    case "human-review":
      return [
        "// Pause for operator approval in Inference tab",
        "wait_for_human_review(&input).await?;",
        "Ok(input)",
      ].join("\n");
    case "output":
      return [`// Snapshot ${outName ?? inName ?? "pipeline output"}`, "Ok(input)"].join("\n");
    default:
      return "Ok(input)";
  }
}

function stepBodyUsesPipelineState(body: string): boolean {
  // AI : real state reads only — ignore commented lines.
  return body
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .some((line) => /\bstate\.(get|insert)\b|\bstate\[/.test(line));
}

function generateStepFn(
  m: PipelineModule,
  project: Project,
  index: number,
  stepFnName: (m: PipelineModule, index: number) => string,
): string {
  const fn = stepFnName(m, index);
  const inRust = exportSpineInRust(m, project, index);
  const outRust = exportSpineOutRust(m, project, index);
  const meta = MODULE_META[m.kind];
  const body = generateStepBody(m, project, outRust, inRust);
  const stateParam = stepBodyUsesPipelineState(body) ? "state" : "_state";
  const docLines = [
    `/// ${m.label.replace(/\*\//g, "*\\/")}`,
    `/// Kind: ${meta.label}`,
    ...(m.note ? [`/// ${m.note.replace(/\*\//g, "*\\/")}`] : []),
    ...(m.model ? [`/// Model: ${m.model}`] : []),
    ...(m.cached ? [`/// Cached: true`] : []),
  ];
  const header = [
    ...docLines,
    `async fn ${fn}(input: ${inRust}, ${stateParam}: &mut PipelineState) -> anyhow::Result<${outRust}> {`,
  ];
  return [...header, indentExportBlock(body, 4), "}", ""].join("\n");
}

// AI : single-file Rust export — structs + step bodies + orchestrator for LOC comparison.
export function generatePipelineSourceRust(project: Project): string {
  const prepared = prepareExportProject(project);
  const needs = analyzeExportRuntimeNeeds(prepared);
  const runtimeStubs = generateRuntimeStubsRust(needs);
  const sections: string[] = [];
  const stepFnName = makeUniqueStepFnName();
  const stepFns = prepared.modules.map((m, i) => generateStepFn(m, prepared, i, stepFnName)).join("\n");
  const orchestrator = generateOrchestratorRust(prepared, stepFnName);

  sections.push(
    "// Generated pipeline export — equivalent Rust representation",
    `// Project: ${prepared.name}`,
    `// ${prepared.modules.length} steps · ${prepared.models.length} structures`,
    "// Setup: export also includes .env.example and SETUP.md — copy .env.example → .env",
    "// Cargo: serde, serde_json, tokio, reqwest, anyhow (see SETUP.md)",
    "",
    "// === structures ===",
    allModelsToRust(prepared.models, prepared.typeAliases ?? []),
    "",
    "// === pipeline state ===",
    pipelineStateRustType(prepared),
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
