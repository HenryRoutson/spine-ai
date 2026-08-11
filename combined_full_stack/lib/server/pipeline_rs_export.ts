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
  generateAssembleStepBodyRust,
  generateInputStepBodyRust,
  generateOrchestratorRust,
  modelName,
  prepareExportProject,
} from "./pipeline_export_shared";
import { analyzeExportRuntimeNeeds, generateRuntimeStubsRust } from "./pipeline_export_setup";
import { pipelineStateRustType } from "./pipeline_state";
import { exportWebhookStepBodyRust, webhookStepUsesPipelineState } from "@/lib/webhook-step";
import { isMergeModuleKind } from "@/lib/module-kinds";
import { MODULE_META, ModuleKind } from "./types";
import { stepEmitsList } from "./type_expr";
import type { PipelineModule, Project } from "./types";

// AI : TODO export — inline real JSON schemas for llm / llm-batch steps (from structure models).
// AI : TODO (linter-first) — exported .rs is the lint target (cargo check on full pipeline export + user custom code).

function commentForeignCode(code: string, langLabel: string): string {
  return [
    `// ${langLabel} (not inlined — port or call via FFI):`,
    ...code.split("\n").map((line) => `// ${line}`),
  ].join("\n");
}

function generateStepBody(m: PipelineModule, project: Project, outRust: string, _inRust: string): string {
  const outName = modelName(project, m.outStructureId);
  const inName = modelName(project, m.inStructureId);

  if (isMergeModuleKind(m.kind) || m.kind === ModuleKind.Chunk || m.kind === ModuleKind.CustomCode) {
    const custom = primaryExportCustomCode(m);
    const fallbacks = customCodeEntriesForModule(m);
    if (custom) {
      return [
        commentForeignCode(
          custom.code,
          `${custom.language === "python" ? "Python" : "TypeScript"} custom code (${fallbacks.length} attempt${fallbacks.length === 1 ? "" : "s"})`,
        ),
        `let out: ${outRust} = serde_json::from_value(serde_json::to_value(&input)?)?;`,
        "Ok(out)",
      ].join("\n");
    }
    return [
      "// Passthrough — no custom code configured",
      `let out: ${outRust} = serde_json::from_value(serde_json::to_value(&input)?)?;`,
      "Ok(out)",
    ].join("\n");
  }

  switch (m.kind) {
    case ModuleKind.Input:
      return generateInputStepBodyRust(m, outRust);
    case ModuleKind.Llm: {
      const prompt = m.prompt ?? "Process the input.";
      const model = m.model ?? "deepseek-v4";
      return [
        `// Structured LLM call → ${outName ?? outRust}${stepEmitsList(m) ? "[]" : ""}`,
        `let _model = ${exportStringLiteral(model)};`,
        `let _ = _model;`,
        `let user_prompt = format!("{}\\n\\nINPUT DATA:\\n{}", ${exportStringLiteral(prompt)}, serde_json::to_string_pretty(&input)?);`,
        `let schema = serde_json::json!({}); // JSON schema for ${outName ?? "output"}`,
        `let value = llm_structured(&user_prompt, &schema).await?;`,
        `let out: ${outRust} = serde_json::from_value(value)?;`,
        "Ok(out)",
      ].join("\n");
    }
    case ModuleKind.LlmBatch: {
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
    case ModuleKind.ExampleSelect: {
      const prompt = m.prompt ?? "Find useful examples…";
      const ctxLabel = m.exampleContextLabel ?? "Context";
      const ctxKey = exportStringLiteral(ctxLabel);
      const pointer = m.exampleContextField?.trim()
        ? `"/${m.exampleContextField.trim().split(".").filter(Boolean).join("/")}"`
        : "None";
      const itemRust = outRust.startsWith("Vec<") && outRust.endsWith(">") ? outRust.slice(4, -1) : outRust;
      return [
        `// Per-item relevance filter — ${outName ?? outRust} with selection_reason`,
        `let ctx_value = state.get(${ctxKey}).cloned().unwrap_or(Value::Null);`,
        pointer === "None"
          ? `let picked = &ctx_value;`
          : `let picked = ctx_value.pointer(${pointer}).unwrap_or(&ctx_value);`,
        `let description = if let Some(s) = picked.as_str() { s.to_string() } else { serde_json::to_string_pretty(picked)? };`,
        "let input_value = serde_json::to_value(&input)?;",
        "let items = if let Value::Array(arr) = &input_value { arr.clone() } else { vec![input_value] };",
        `let template = ${exportStringLiteral(prompt)};`,
        `let schema = serde_json::json!({"chain_of_thought": "string", "is_relevant": "boolean"});`,
        "let mut out = Vec::new();",
        "for item in items {",
        `    let ask = template.replace("{description}", &description).replace("{example}", &serde_json::to_string_pretty(&item)?);`,
        "    let verdict = llm_structured(&ask, &schema).await?;",
        "    if verdict.get(\"is_relevant\").and_then(|v| v.as_bool()).unwrap_or(false) {",
        `        let mut row = item.clone();`,
        "        if let Value::Object(ref mut map) = row {",
        "            map.insert(\"selection_reason\".to_string(), verdict.get(\"chain_of_thought\").cloned().unwrap_or(Value::String(String::new())));",
        "        }",
        `        out.push(serde_json::from_value::<${itemRust}>(row)?);`,
        "    }",
        "}",
        "Ok(out)",
      ].join("\n");
    }
    case ModuleKind.Quote:
      return [
        "// Match LLM quote strings against source document byte offsets (no LLM cost)",
        "let linked = resolve_quotes(&input, \"\", \"\")?;",
        `let out: ${outRust} = serde_json::from_value(linked)?;`,
        "Ok(out)",
      ].join("\n");
    case ModuleKind.Combine:
      return generateCombineStepBodyRust(m, project, outRust, _inRust);
    case ModuleKind.Assemble:
      return generateAssembleStepBodyRust(m, project, outRust);
    case ModuleKind.Parallel:
      return [
        "// Parallel LLM branches — join product (see runtime)",
        `let out: ${outRust} = serde_json::from_value(serde_json::json!({}))?;`,
        "Ok(out)",
      ].join("\n");
    case ModuleKind.Transform: {
      const custom = primaryExportCustomCode(m);
      if (custom) {
        return [
          commentForeignCode(custom.code, custom.language === "python" ? "Python transform" : "TypeScript transform"),
          `let out: ${outRust} = serde_json::from_value(serde_json::to_value(&input)?)?;`,
          "Ok(out)",
        ].join("\n");
      }
      return [
        `// Reshape ${inName ?? "input"} → ${outName ?? outRust}${stepEmitsList(m) ? " (list)" : ""}`,
        `let out: ${outRust} = serde_json::from_value(serde_json::to_value(&input)?)?;`,
        "Ok(out)",
      ].join("\n");
    }
    case ModuleKind.Assert: {
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
    case ModuleKind.HumanReview:
      return [
        "// Pause for operator approval in Inference tab",
        "wait_for_human_review(&input).await?;",
        "Ok(input)",
      ].join("\n");
    case ModuleKind.Chatbot:
      return [
        "// Prompted chatbot — input is ChatbotPrompt; returns ChatbotResult",
        "let __chat = wait_for_chatbot_session(&input).await?;",
        "Ok(__chat)",
      ].join("\n");
    case ModuleKind.Webhook:
      return exportWebhookStepBodyRust();
    case ModuleKind.Output:
      return [`// Snapshot ${outName ?? inName ?? "pipeline output"}`, "Ok(input)"].join("\n");
    default:
      return "Ok(input)";
  }
}

function stepBodyUsesPipelineState(body: string, m?: PipelineModule): boolean {
  if (m?.kind === ModuleKind.Webhook && webhookStepUsesPipelineState(m)) return true;
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
  const stateParam = stepBodyUsesPipelineState(body, m) ? "state" : "_state";
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
    "// Setup: export also includes .env.example and README.md — copy .env.example → .env",
    "// Cargo: serde, serde_json, tokio, reqwest, anyhow (see README.md)",
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
