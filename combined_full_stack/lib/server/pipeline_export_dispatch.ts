// AI : kind × lang step-body table — adding a ModuleKind must fill ts/py/go/rs (typecheck).
// AI : TODO (arch-export-file) — generatePipelineSource* still assemble sections in 4 files.
// AI : TODO (arch-export-orchestrator) — after dispatch is the only kind switch, one IR then printers (leave BAML).
// AI : DONE (allow-pipeline-non-linear-fork) — Fork row in STEP_BODY; lane modules dispatched as today.

import { assertEntriesForModule, wrapAssertPython, wrapAssertTypeScriptForExport } from "@/lib/assert_steps";
import { customCodeEntriesForModule } from "@/lib/custom_code_entries";
import { DEFAULT_EXAMPLE_REASON_FIELD, exampleReasonField } from "@/lib/example-select";
import { examplePromptColumns } from "@/lib/sql-schema";
import { isMergeModuleKind } from "@/lib/module-kinds";
import {
  exportConnectStepBodyGo,
  exportConnectStepBodyPy,
  exportConnectStepBodyRust,
  exportConnectStepBodyTs,
} from "@/lib/connect-step";
import {
  exportN8nStepBodyGo,
  exportN8nStepBodyPy,
  exportN8nStepBodyRust,
  exportN8nStepBodyTs,
} from "@/lib/n8n-step";
import {
  exportWebhookStepBodyGo,
  exportWebhookStepBodyPy,
  exportWebhookStepBodyRust,
  exportWebhookStepBodyTs,
} from "@/lib/webhook-step";
import {
  assertPassthroughComment,
  assertValidateComment,
  chatbotComment,
  commentForeignCode,
  exampleSelectComment,
  exportComment,
  exportSchemaExprGo,
  exportSchemaExprPy,
  exportSchemaExprRust,
  exportStepLlmSchemaJson,
  exportStringLiteral,
  fallbacksFirstComment,
  generateAssembleStepBodyGo,
  generateAssembleStepBodyPy,
  generateAssembleStepBodyRust,
  generateAssembleStepBodyTs,
  generateCombineStepBodyGo,
  generateCombineStepBodyPy,
  generateCombineStepBodyRust,
  generateCombineStepBodyTs,
  generateCustomCodeStepBodyTs,
  generateExampleContextExprTs,
  generateExampleContextLinesPy,
  generateInputStepBodyGo,
  generateInputStepBodyPy,
  generateInputStepBodyRust,
  generateInputStepBodyTs,
  generateDocToTextStepBodyGo,
  generateDocToTextStepBodyPy,
  generateDocToTextStepBodyRust,
  generateDocToTextStepBodyTs,
  generateMergeStepBodyGo,
  generateMergeStepBodyPy,
  generateMergeStepBodyRust,
  generateMergeStepBodyTs,
  generateParallelStepBodyGo,
  generateParallelStepBodyPy,
  generateParallelStepBodyRust,
  generateParallelStepBodyTs,
  generateForkStepBodyGo,
  generateForkStepBodyPy,
  generateForkStepBodyRust,
  generateForkStepBodyTs,
  generateIfElseStepBodyGo,
  generateIfElseStepBodyPy,
  generateIfElseStepBodyRust,
  generateIfElseStepBodyTs,
  generateCaseStepBodyGo,
  generateCaseStepBodyPy,
  generateCaseStepBodyRust,
  generateCaseStepBodyTs,
  generateControlJoinStepBodyGo,
  generateControlJoinStepBodyPy,
  generateControlJoinStepBodyRust,
  generateControlJoinStepBodyTs,
  generateQuoteStepBodyGo,
  generateQuoteStepBodyPy,
  generateQuoteStepBodyRust,
  generateQuoteStepBodyTs,
  goZeroValue,
  humanReviewComment,
  llmBatchComment,
  modelName,
  passthroughCustomComment,
  primaryExportCustomCode,
  pyCustomCodeCall,
  reshapeStepComment,
  snapshotComment,
  structuredLlmComment,
} from "./pipeline_export_shared";
import { stepEmitsList } from "./type_expr";
import { ModuleKind } from "./types";
import type { PipelineModule, Project } from "./types";

export const EXPORT_LANGS = ["ts", "py", "go", "rs"] as const;
export type ExportLang = (typeof EXPORT_LANGS)[number];

export type StepBodyCtx = {
  m: PipelineModule;
  project: Project;
  inType: string;
  outType: string;
};

type StepBodyEmitter = (ctx: StepBodyCtx) => string;

const TS = "//" as const;
const PY = "#" as const;
const C = "//" as const;

const DEFAULT_LLM_PROMPT = "Process the input.";
const DEFAULT_LLM_BATCH_PROMPT = "Process the item.";
const DEFAULT_EXAMPLE_PROMPT = "Find useful examples…";
const DEFAULT_EXAMPLE_CTX = "Context";
const DEFAULT_MODEL = "deepseek-v4";

function names(ctx: StepBodyCtx): { outName: string | undefined; inName: string | undefined } {
  return {
    outName: modelName(ctx.project, ctx.m.outStructureId),
    inName: modelName(ctx.project, ctx.m.inStructureId),
  };
}

function outLabel(ctx: StepBodyCtx): string {
  return names(ctx).outName ?? ctx.outType;
}

function tsCast(outType: string): string {
  return `return input as unknown as ${outType};`;
}

function pyCast(ctx: StepBodyCtx, expr: string): string {
  return ctx.inType === ctx.outType
    ? `return ${expr}`
    : `return cast(${ctx.outType}, cast(object, ${expr}))`;
}

function goRoundtrip(outType: string): string[] {
  const zero = goZeroValue(outType);
  return [
    `b, err := json.Marshal(input)`,
    `if err != nil {`,
    `\treturn ${zero}, err`,
    `}`,
    `var out ${outType}`,
    `if err := json.Unmarshal(b, &out); err != nil {`,
    `\treturn ${zero}, err`,
    `}`,
    `return out, nil`,
  ];
}

function rsRoundtrip(outType: string): string[] {
  return [`let out: ${outType} = serde_json::from_value(serde_json::to_value(&input)?)?;`, "Ok(out)"];
}

function tsItemType(outType: string): string {
  return outType.endsWith("[]") ? outType.slice(0, -2) : outType;
}

function goItemType(outType: string): string {
  return outType.startsWith("[]") ? outType.slice(2) : outType;
}

function rsItemType(outType: string): string {
  return outType.startsWith("Vec<") && outType.endsWith(">") ? outType.slice(4, -1) : outType;
}

function inlinePythonCustomCode(code: string, outPy: string): string {
  if (/^\s*def\s+\w+\s*\(/.test(code)) {
    return [`${code}`, pyCustomCodeCall(code, outPy)].join("\n");
  }
  return [`__fn = ${code}`, pyCustomCodeCall(code, outPy)].join("\n");
}

function emitTsCustomOrPassthrough(ctx: StepBodyCtx): string {
  const custom = primaryExportCustomCode(ctx.m);
  const fallbacks = customCodeEntriesForModule(ctx.m);
  if (custom?.language === "typescript") {
    const lines = [generateCustomCodeStepBodyTs(custom.code, ctx.inType, ctx.outType)];
    if (fallbacks.length > 1) {
      lines.unshift(exportComment(TS, fallbacksFirstComment(fallbacks.length)));
    }
    return lines.join("\n");
  }
  if (custom?.language === "python") {
    return [
      commentForeignCode(
        TS,
        `Python custom code (${fallbacks.length} attempt${fallbacks.length === 1 ? "" : "s"})`,
        custom.code,
      ),
      tsCast(ctx.outType),
    ].join("\n");
  }
  return [exportComment(TS, passthroughCustomComment()), tsCast(ctx.outType)].join("\n");
}

function emitPyCustomOrPassthrough(ctx: StepBodyCtx): string {
  const custom = primaryExportCustomCode(ctx.m);
  const fallbacks = customCodeEntriesForModule(ctx.m);
  if (custom?.language === "python") {
    const lines = inlinePythonCustomCode(custom.code, ctx.outType).split("\n");
    if (fallbacks.length > 1) {
      lines.unshift(exportComment(PY, fallbacksFirstComment(fallbacks.length)));
    }
    return lines.join("\n");
  }
  if (custom?.language === "typescript") {
    return [
      commentForeignCode(
        PY,
        `TypeScript custom code (${fallbacks.length} attempt${fallbacks.length === 1 ? "" : "s"})`,
        custom.code,
      ),
      pyCast(ctx, "input"),
    ].join("\n");
  }
  return [exportComment(PY, passthroughCustomComment()), pyCast(ctx, "input")].join("\n");
}

function emitGoCustomOrPassthrough(ctx: StepBodyCtx): string {
  // AI : TODO (arch-export-dispatch) — hoist merge runtime once (TS already does); comments + json round-trip.
  const custom = primaryExportCustomCode(ctx.m);
  const fallbacks = customCodeEntriesForModule(ctx.m);
  const passthrough = goRoundtrip(ctx.outType);
  if (custom) {
    return [
      commentForeignCode(
        C,
        `${custom.language === "python" ? "Python" : "TypeScript"} custom code (${fallbacks.length} attempt${fallbacks.length === 1 ? "" : "s"})`,
        custom.code,
        "port or call via cgo/FFI",
      ),
      ...passthrough,
    ].join("\n");
  }
  return [exportComment(C, passthroughCustomComment()), ...passthrough].join("\n");
}

function emitRsCustomOrPassthrough(ctx: StepBodyCtx): string {
  // AI : TODO (arch-export-dispatch) — hoist merge runtime once (TS already does); comments + json round-trip.
  const custom = primaryExportCustomCode(ctx.m);
  const fallbacks = customCodeEntriesForModule(ctx.m);
  if (custom) {
    return [
      commentForeignCode(
        C,
        `${custom.language === "python" ? "Python" : "TypeScript"} custom code (${fallbacks.length} attempt${fallbacks.length === 1 ? "" : "s"})`,
        custom.code,
        "port or call via FFI",
      ),
      ...rsRoundtrip(ctx.outType),
    ].join("\n");
  }
  return [exportComment(C, passthroughCustomComment()), ...rsRoundtrip(ctx.outType)].join("\n");
}

function emitTsMergeChunkCustom(ctx: StepBodyCtx): string {
  if (isMergeModuleKind(ctx.m.kind) && !ctx.m.mergeCustom?.trim()) {
    return generateMergeStepBodyTs(ctx.m, ctx.outType);
  }
  return emitTsCustomOrPassthrough(ctx);
}

function emitPyMergeChunkCustom(ctx: StepBodyCtx): string {
  if (isMergeModuleKind(ctx.m.kind) && !ctx.m.mergeCustom?.trim()) {
    return generateMergeStepBodyPy(ctx.m, ctx.outType);
  }
  return emitPyCustomOrPassthrough(ctx);
}

function emitGoMergeChunkCustom(ctx: StepBodyCtx): string {
  if (isMergeModuleKind(ctx.m.kind) && !ctx.m.mergeCustom?.trim()) {
    return generateMergeStepBodyGo(ctx.m, ctx.outType);
  }
  return emitGoCustomOrPassthrough(ctx);
}

function emitRsMergeChunkCustom(ctx: StepBodyCtx): string {
  if (isMergeModuleKind(ctx.m.kind) && !ctx.m.mergeCustom?.trim()) {
    return generateMergeStepBodyRust(ctx.m, ctx.outType);
  }
  return emitRsCustomOrPassthrough(ctx);
}

const emitLlm: Record<ExportLang, StepBodyEmitter> = {
  ts: (ctx) => {
    const prompt = ctx.m.prompt ?? DEFAULT_LLM_PROMPT;
    const model = ctx.m.model ?? "/* global default model */";
    const outName = outLabel(ctx);
    return [
      exportComment(TS, structuredLlmComment(outName, stepEmitsList(ctx.m))),
      `const _model = ${typeof model === "string" && model.startsWith("/*") ? `"${DEFAULT_MODEL}"` : JSON.stringify(model)};`,
      `void _model;`,
      `const userPrompt = ${JSON.stringify(prompt)} + "\\n\\nINPUT DATA:\\n" + JSON.stringify(input, null, 2);`,
      `const schema = ${exportStepLlmSchemaJson(ctx.project, ctx.m)};`,
      `return await llmStructured<${ctx.outType}>(userPrompt, schema);`,
    ].join("\n");
  },
  py: (ctx) => {
    const prompt = ctx.m.prompt ?? DEFAULT_LLM_PROMPT;
    const model = ctx.m.model ?? DEFAULT_MODEL;
    const outName = outLabel(ctx);
    return [
      exportComment(PY, structuredLlmComment(outName, stepEmitsList(ctx.m))),
      `_model = ${exportStringLiteral(model)}`,
      `user_prompt = ${exportStringLiteral(prompt)} + "\\n\\nINPUT DATA:\\n" + json.dumps(input, indent=2, default=str)`,
      `schema = ${exportSchemaExprPy(exportStepLlmSchemaJson(ctx.project, ctx.m))}`,
      pyCast(ctx, "await llm_structured(user_prompt, schema)"),
    ].join("\n");
  },
  go: (ctx) => {
    const prompt = ctx.m.prompt ?? DEFAULT_LLM_PROMPT;
    const model = ctx.m.model ?? DEFAULT_MODEL;
    const outName = outLabel(ctx);
    const zero = goZeroValue(ctx.outType);
    return [
      exportComment(C, structuredLlmComment(outName, stepEmitsList(ctx.m))),
      `_ = ${exportStringLiteral(model)}`,
      `inJSON, err := json.MarshalIndent(input, "", "  ")`,
      `if err != nil {`,
      `\treturn ${zero}, err`,
      `}`,
      `userPrompt := ${exportStringLiteral(prompt)} + "\\n\\nINPUT DATA:\\n" + string(inJSON)`,
      `schema := ${exportSchemaExprGo(exportStepLlmSchemaJson(ctx.project, ctx.m))}`,
      `value, err := llmStructured(userPrompt, schema)`,
      `if err != nil {`,
      `\treturn ${zero}, err`,
      `}`,
      `var out ${ctx.outType}`,
      `if err := json.Unmarshal(value, &out); err != nil {`,
      `\treturn ${zero}, err`,
      `}`,
      `return out, nil`,
    ].join("\n");
  },
  rs: (ctx) => {
    const prompt = ctx.m.prompt ?? DEFAULT_LLM_PROMPT;
    const model = ctx.m.model ?? DEFAULT_MODEL;
    const outName = outLabel(ctx);
    return [
      exportComment(C, structuredLlmComment(outName, stepEmitsList(ctx.m))),
      `let _model = ${exportStringLiteral(model)};`,
      `let _ = _model;`,
      `let user_prompt = format!("{}\\n\\nINPUT DATA:\\n{}", ${exportStringLiteral(prompt)}, serde_json::to_string_pretty(&input)?);`,
      `let schema = ${exportSchemaExprRust(exportStepLlmSchemaJson(ctx.project, ctx.m))};`,
      `let value = llm_structured(&user_prompt, &schema).await?;`,
      `let out: ${ctx.outType} = serde_json::from_value(value)?;`,
      "Ok(out)",
    ].join("\n");
  },
};

const emitLlmBatch: Record<ExportLang, StepBodyEmitter> = {
  ts: (ctx) => {
    const prompt = ctx.m.prompt ?? DEFAULT_LLM_BATCH_PROMPT;
    const outName = outLabel(ctx);
    return [
      exportComment(TS, llmBatchComment(outName)),
      "const items = Array.isArray(input) ? input : [input];",
      `const promptFor = (item: unknown) => ${JSON.stringify(prompt)} + "\\n\\nITEM:\\n" + JSON.stringify(item, null, 2);`,
      `const schema = ${exportStepLlmSchemaJson(ctx.project, ctx.m)};`,
      `return await llmBatchStructured<${tsItemType(ctx.outType)}>(items, promptFor, schema);`,
    ].join("\n");
  },
  py: (ctx) => {
    const prompt = ctx.m.prompt ?? DEFAULT_LLM_BATCH_PROMPT;
    const outName = outLabel(ctx);
    const itemsLine = ctx.inType.startsWith("list[")
      ? "items = input"
      : "items = input if isinstance(input, list) else [input]";
    return [
      exportComment(PY, llmBatchComment(outName)),
      itemsLine,
      `def prompt_for(item: Any) -> str:`,
      `    return ${exportStringLiteral(prompt)} + "\\n\\nITEM:\\n" + json.dumps(item, indent=2)`,
      `schema = ${exportSchemaExprPy(exportStepLlmSchemaJson(ctx.project, ctx.m))}`,
      pyCast(ctx, "await llm_batch_structured(items, prompt_for, schema)"),
    ].join("\n");
  },
  go: (ctx) => {
    const prompt = ctx.m.prompt ?? DEFAULT_LLM_BATCH_PROMPT;
    const outName = outLabel(ctx);
    const zero = goZeroValue(ctx.outType);
    const itemGo = goItemType(ctx.outType);
    return [
      exportComment(C, llmBatchComment(outName)),
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
      `schema := ${exportSchemaExprGo(exportStepLlmSchemaJson(ctx.project, ctx.m))}`,
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
  },
  rs: (ctx) => {
    const prompt = ctx.m.prompt ?? DEFAULT_LLM_BATCH_PROMPT;
    const outName = outLabel(ctx);
    const itemRust = rsItemType(ctx.outType);
    return [
      exportComment(C, llmBatchComment(outName)),
      "let input_value = serde_json::to_value(&input)?;",
      "let items = if let Value::Array(arr) = &input_value { arr.clone() } else { vec![input_value] };",
      `let schema = ${exportSchemaExprRust(exportStepLlmSchemaJson(ctx.project, ctx.m))};`,
      "let mut out = Vec::new();",
      "for item in items {",
      `    let prompt = format!("{}\\n\\nITEM:\\n{}", ${exportStringLiteral(prompt)}, serde_json::to_string_pretty(&item)?);`,
      "    let value = llm_structured(&prompt, &schema).await?;",
      `    out.push(serde_json::from_value::<${itemRust}>(value)?);`,
      "}",
      "Ok(out)",
    ].join("\n");
  },
};

const emitExampleSelect: Record<ExportLang, StepBodyEmitter> = {
  ts: (ctx) => {
    const prompt = ctx.m.prompt ?? DEFAULT_EXAMPLE_PROMPT;
    const ctxLabel = ctx.m.exampleContextLabel ?? DEFAULT_EXAMPLE_CTX;
    const outName = outLabel(ctx);
    const reason = exampleReasonField(ctx.m);
    const cols = examplePromptColumns(ctx.m);
    // AI : TODO (example-select-view) — export must project each item for the prompt and still return full rows.
    // AI : TODO (type-join) — host runtime lookup-embeds context FKs into {description}; export still stringifies raw.
    let selectCall: string;
    if (cols?.length) {
      selectCall = `selectRelevant(items, description, template, ${JSON.stringify(reason)}, ${JSON.stringify(cols)})`;
    } else if (reason === DEFAULT_EXAMPLE_REASON_FIELD) {
      selectCall = "selectRelevant(items, description, template)";
    } else {
      selectCall = `selectRelevant(items, description, template, ${JSON.stringify(reason)})`;
    }
    return [
      exportComment(TS, exampleSelectComment(outName)),
      `const description = ${generateExampleContextExprTs(ctxLabel, ctx.m.exampleContextField)};`,
      "const items = exampleSelectItems(input);",
      `const template = ${JSON.stringify(prompt)};`,
      `return (await ${selectCall}) as ${ctx.outType};`,
    ].join("\n");
  },
  py: (ctx) => {
    const prompt = ctx.m.prompt ?? DEFAULT_EXAMPLE_PROMPT;
    const ctxLabel = ctx.m.exampleContextLabel ?? DEFAULT_EXAMPLE_CTX;
    const outName = outLabel(ctx);
    const cols = examplePromptColumns(ctx.m);
    const reason = exampleReasonField(ctx.m);
    const args = ["items", "description", "template"];
    if (reason !== DEFAULT_EXAMPLE_REASON_FIELD) args.push(`reason_field=${JSON.stringify(reason)}`);
    if (cols?.length) args.push(`prompt_columns=${JSON.stringify(cols)}`);
    return [
      exportComment(PY, exampleSelectComment(outName)),
      ...generateExampleContextLinesPy(ctxLabel, ctx.m.exampleContextField),
      "items = example_select_items(input)",
      `template = ${exportStringLiteral(prompt)}`,
      pyCast(ctx, `await select_relevant(${args.join(", ")})`),
    ].join("\n");
  },
  go: (ctx) => {
    const prompt = ctx.m.prompt ?? DEFAULT_EXAMPLE_PROMPT;
    const ctxLabel = ctx.m.exampleContextLabel ?? DEFAULT_EXAMPLE_CTX;
    const ctxKey = exportStringLiteral(ctxLabel);
    const outName = outLabel(ctx);
    const zero = goZeroValue(ctx.outType);
    const itemGo = goItemType(ctx.outType);
    const cols = examplePromptColumns(ctx.m);
    const fieldPath = ctx.m.exampleContextField?.trim();
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
            return [`if m, ok := picked.(map[string]any); ok {`, `\tpicked = m[${p}]`, `}`].join("\n");
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
      exportComment(C, exampleSelectComment(outName)),
      ...descriptionBlock,
      `inJSON, err := json.Marshal(input)`,
      `if err != nil {`,
      `\treturn ${zero}, err`,
      `}`,
      `items, err := exampleSelectItems(inJSON)`,
      `if err != nil {`,
      `\treturn ${zero}, err`,
      `}`,
      `template := ${exportStringLiteral(prompt)}`,
      cols?.length
        ? `selected, err := selectRelevant(items, description, template, ${cols.map((c) => exportStringLiteral(c)).join(", ")})`
        : `selected, err := selectRelevant(items, description, template)`,
      `if err != nil {`,
      `\treturn ${zero}, err`,
      `}`,
      `out := make([]${itemGo}, 0, len(selected))`,
      `for _, b := range selected {`,
      `\tvar one ${itemGo}`,
      `\tif err := json.Unmarshal(b, &one); err != nil {`,
      `\t\treturn ${zero}, err`,
      `\t}`,
      `\tout = append(out, one)`,
      `}`,
      `return out, nil`,
    ].join("\n");
  },
  rs: (ctx) => {
    const prompt = ctx.m.prompt ?? DEFAULT_EXAMPLE_PROMPT;
    const ctxLabel = ctx.m.exampleContextLabel ?? DEFAULT_EXAMPLE_CTX;
    const ctxKey = exportStringLiteral(ctxLabel);
    const pointer = ctx.m.exampleContextField?.trim()
      ? `"/${ctx.m.exampleContextField.trim().split(".").filter(Boolean).join("/")}"`
      : "None";
    const outName = outLabel(ctx);
    const itemRust = rsItemType(ctx.outType);
    const cols = examplePromptColumns(ctx.m);
    const promptCols = cols?.length
      ? `&[${cols.map((c) => `${exportStringLiteral(c)}.to_string()`).join(", ")}]`
      : "&[] as &[String]";
    return [
      exportComment(C, exampleSelectComment(outName)),
      `let ctx_value = state.get(${ctxKey}).cloned().unwrap_or(Value::Null);`,
      pointer === "None" ? `let picked = &ctx_value;` : `let picked = ctx_value.pointer(${pointer}).unwrap_or(&ctx_value);`,
      `let description = if let Some(s) = picked.as_str() { s.to_string() } else { serde_json::to_string_pretty(picked)? };`,
      "let input_value = serde_json::to_value(&input)?;",
      "let items = example_select_items(&input_value);",
      `let template = ${exportStringLiteral(prompt)};`,
      `let selected = select_relevant(items, &description, &template, ${promptCols}).await?;`,
      "let mut out = Vec::new();",
      "for row in selected {",
      `    out.push(serde_json::from_value::<${itemRust}>(row)?);`,
      "}",
      "Ok(out)",
    ].join("\n");
  },
};

const emitTransform: Record<ExportLang, StepBodyEmitter> = {
  ts: (ctx) => {
    const custom = primaryExportCustomCode(ctx.m);
    const { outName, inName } = names(ctx);
    if (custom?.language === "typescript") {
      return generateCustomCodeStepBodyTs(custom.code, ctx.inType, ctx.outType);
    }
    if (custom?.language === "python") {
      return [commentForeignCode(TS, "Python transform", custom.code), tsCast(ctx.outType)].join("\n");
    }
    return [exportComment(TS, reshapeStepComment(ctx.m, inName, outName, ctx.outType)), tsCast(ctx.outType)].join("\n");
  },
  py: (ctx) => {
    const custom = primaryExportCustomCode(ctx.m);
    const { outName, inName } = names(ctx);
    if (custom?.language === "python") {
      return inlinePythonCustomCode(custom.code, ctx.outType);
    }
    if (custom?.language === "typescript") {
      return [commentForeignCode(PY, "TypeScript transform", custom.code), pyCast(ctx, "input")].join("\n");
    }
    return [exportComment(PY, reshapeStepComment(ctx.m, inName, outName, ctx.outType)), pyCast(ctx, "input")].join("\n");
  },
  go: (ctx) => {
    const custom = primaryExportCustomCode(ctx.m);
    const { outName, inName } = names(ctx);
    const passthrough = goRoundtrip(ctx.outType);
    if (custom) {
      return [
        commentForeignCode(
          C,
          custom.language === "python" ? "Python transform" : "TypeScript transform",
          custom.code,
          "port or call via cgo/FFI",
        ),
        ...passthrough,
      ].join("\n");
    }
    return [exportComment(C, reshapeStepComment(ctx.m, inName, outName, ctx.outType)), ...passthrough].join("\n");
  },
  rs: (ctx) => {
    const custom = primaryExportCustomCode(ctx.m);
    const { outName, inName } = names(ctx);
    if (custom) {
      return [
        commentForeignCode(
          C,
          custom.language === "python" ? "Python transform" : "TypeScript transform",
          custom.code,
          "port or call via FFI",
        ),
        ...rsRoundtrip(ctx.outType),
      ].join("\n");
    }
    return [exportComment(C, reshapeStepComment(ctx.m, inName, outName, ctx.outType)), ...rsRoundtrip(ctx.outType)].join(
      "\n",
    );
  },
};

const emitAssert: Record<ExportLang, StepBodyEmitter> = {
  ts: (ctx) => {
    const entries = assertEntriesForModule(ctx.m);
    const expectations = ctx.project.expectedOutputs ?? {};
    if (entries[0]?.language === "typescript") {
      const wrapped = wrapAssertTypeScriptForExport(entries[0].code, expectations, ctx.inType);
      return [
        exportComment(TS, assertValidateComment()),
        `const __assert = ${wrapped};`,
        "__assert(input, state);",
        tsCast(ctx.outType),
      ].join("\n");
    }
    return [exportComment(TS, assertPassthroughComment()), tsCast(ctx.outType)].join("\n");
  },
  py: (ctx) => {
    const entries = assertEntriesForModule(ctx.m);
    const expectations = ctx.project.expectedOutputs ?? {};
    if (entries[0]?.language === "python") {
      return [
        exportComment(PY, assertValidateComment()),
        wrapAssertPython(entries[0].code, expectations),
        "transform(input, state)",
        pyCast(ctx, "input"),
      ].join("\n\n");
    }
    if (entries[0]?.language === "typescript") {
      return [commentForeignCode(PY, "TypeScript assert", entries[0].code), pyCast(ctx, "input")].join("\n");
    }
    return [exportComment(PY, assertPassthroughComment()), pyCast(ctx, "input")].join("\n");
  },
  go: (ctx) => {
    const entries = assertEntriesForModule(ctx.m);
    if (entries[0]?.code.trim()) {
      return [
        commentForeignCode(C, `${entries[0].language} assert`, entries[0].code, "port or call via cgo/FFI"),
        exportComment(C, assertValidateComment()),
        "return input, nil",
      ].join("\n");
    }
    return [exportComment(C, assertPassthroughComment()), "return input, nil"].join("\n");
  },
  rs: (ctx) => {
    const entries = assertEntriesForModule(ctx.m);
    if (entries[0]?.code.trim()) {
      return [
        commentForeignCode(C, `${entries[0].language} assert`, entries[0].code, "port or call via FFI"),
        exportComment(C, assertValidateComment()),
        "Ok(input)",
      ].join("\n");
    }
    return [exportComment(C, assertPassthroughComment()), "Ok(input)"].join("\n");
  },
};

// AI : exhaustive — a new ModuleKind fails typecheck until all four langs have an emitter.
export const STEP_BODY: Record<ModuleKind, Record<ExportLang, StepBodyEmitter>> = {
  [ModuleKind.Input]: {
    ts: (ctx) => generateInputStepBodyTs(ctx.m, ctx.outType),
    py: (ctx) => generateInputStepBodyPy(ctx.m, ctx.outType),
    go: (ctx) => generateInputStepBodyGo(ctx.m, ctx.outType),
    rs: (ctx) => generateInputStepBodyRust(ctx.m, ctx.outType),
  },
  [ModuleKind.DocToText]: {
    ts: (ctx) => generateDocToTextStepBodyTs(ctx.m),
    py: (ctx) => generateDocToTextStepBodyPy(ctx.m),
    go: (ctx) => generateDocToTextStepBodyGo(ctx.m, ctx.outType),
    rs: (ctx) => generateDocToTextStepBodyRust(ctx.m),
  },
  [ModuleKind.Llm]: emitLlm,
  [ModuleKind.LlmBatch]: emitLlmBatch,
  [ModuleKind.ExampleSelect]: emitExampleSelect,
  [ModuleKind.Quote]: {
    ts: (ctx) => generateQuoteStepBodyTs(ctx.m, ctx.project, ctx.outType),
    py: (ctx) => generateQuoteStepBodyPy(ctx.m, ctx.project, ctx.outType),
    go: (ctx) => generateQuoteStepBodyGo(ctx.m, ctx.project, ctx.outType),
    rs: (ctx) => generateQuoteStepBodyRust(ctx.m, ctx.project, ctx.outType),
  },
  [ModuleKind.Combine]: {
    ts: (ctx) => generateCombineStepBodyTs(ctx.m, ctx.project, ctx.outType),
    py: (ctx) => generateCombineStepBodyPy(ctx.m, ctx.project, ctx.outType, ctx.inType),
    go: (ctx) => generateCombineStepBodyGo(ctx.m, ctx.project, ctx.outType, ctx.inType),
    rs: (ctx) => generateCombineStepBodyRust(ctx.m, ctx.project, ctx.outType, ctx.inType),
  },
  [ModuleKind.Assemble]: {
    ts: (ctx) => generateAssembleStepBodyTs(ctx.m, ctx.project, ctx.outType),
    py: (ctx) => generateAssembleStepBodyPy(ctx.m, ctx.project, ctx.outType),
    go: (ctx) => generateAssembleStepBodyGo(ctx.m, ctx.project, ctx.outType),
    rs: (ctx) => generateAssembleStepBodyRust(ctx.m, ctx.project, ctx.outType),
  },
  [ModuleKind.Parallel]: {
    ts: (ctx) => generateParallelStepBodyTs(ctx.m, ctx.project, ctx.outType),
    py: (ctx) => generateParallelStepBodyPy(ctx.m, ctx.project, ctx.outType),
    go: (ctx) => generateParallelStepBodyGo(ctx.m, ctx.project, ctx.outType),
    rs: (ctx) => generateParallelStepBodyRust(ctx.m, ctx.project, ctx.outType),
  },
  [ModuleKind.Fork]: {
    ts: (ctx) => generateForkStepBodyTs(ctx.m, ctx.project, ctx.outType),
    py: (ctx) => generateForkStepBodyPy(ctx.m, ctx.project, ctx.outType),
    go: (ctx) => generateForkStepBodyGo(ctx.m, ctx.project, ctx.outType),
    rs: (ctx) => generateForkStepBodyRust(ctx.m, ctx.project, ctx.outType),
  },
  [ModuleKind.IfElse]: {
    ts: (ctx) => generateIfElseStepBodyTs(ctx.m, ctx.project, ctx.outType),
    py: (ctx) => generateIfElseStepBodyPy(ctx.m, ctx.project, ctx.outType),
    go: (ctx) => generateIfElseStepBodyGo(ctx.m, ctx.project, ctx.outType),
    rs: (ctx) => generateIfElseStepBodyRust(ctx.m, ctx.project, ctx.outType),
  },
  [ModuleKind.Case]: {
    ts: (ctx) => generateCaseStepBodyTs(ctx.m, ctx.project, ctx.outType),
    py: (ctx) => generateCaseStepBodyPy(ctx.m, ctx.project, ctx.outType),
    go: (ctx) => generateCaseStepBodyGo(ctx.m, ctx.project, ctx.outType),
    rs: (ctx) => generateCaseStepBodyRust(ctx.m, ctx.project, ctx.outType),
  },
  [ModuleKind.ControlJoin]: {
    ts: (ctx) => generateControlJoinStepBodyTs(ctx.m, ctx.project, ctx.outType),
    py: (ctx) => generateControlJoinStepBodyPy(ctx.m, ctx.project, ctx.outType),
    go: (ctx) => generateControlJoinStepBodyGo(ctx.m, ctx.project, ctx.outType),
    rs: (ctx) => generateControlJoinStepBodyRust(ctx.m, ctx.project, ctx.outType),
  },
  [ModuleKind.Chunk]: {
    ts: emitTsMergeChunkCustom,
    py: emitPyMergeChunkCustom,
    go: emitGoMergeChunkCustom,
    rs: emitRsMergeChunkCustom,
  },
  [ModuleKind.Merge]: {
    ts: emitTsMergeChunkCustom,
    py: emitPyMergeChunkCustom,
    go: emitGoMergeChunkCustom,
    rs: emitRsMergeChunkCustom,
  },
  [ModuleKind.CustomCode]: {
    ts: emitTsMergeChunkCustom,
    py: emitPyMergeChunkCustom,
    go: emitGoMergeChunkCustom,
    rs: emitRsMergeChunkCustom,
  },
  [ModuleKind.Transform]: emitTransform,
  [ModuleKind.Assert]: emitAssert,
  [ModuleKind.HumanReview]: {
    ts: (ctx) =>
      [exportComment(TS, humanReviewComment()), "await waitForHumanReview(input);", tsCast(ctx.outType)].join("\n"),
    py: (ctx) =>
      [exportComment(PY, humanReviewComment()), "await wait_for_human_review(input)", pyCast(ctx, "input")].join("\n"),
    go: (ctx) => {
      const zero = goZeroValue(ctx.outType);
      return [
        exportComment(C, humanReviewComment()),
        "if err := WaitForHumanReview(input); err != nil {",
        `\treturn ${zero}, err`,
        "}",
        "return input, nil",
      ].join("\n");
    },
    rs: () =>
      [exportComment(C, humanReviewComment()), "wait_for_human_review(&input).await?;", "Ok(input)"].join("\n"),
  },
  [ModuleKind.Chatbot]: {
    ts: (ctx) =>
      [
        exportComment(TS, chatbotComment()),
        "const __chat = await waitForChatbotSession(input as ChatbotPrompt, { mode: " +
          JSON.stringify(ctx.m.chatbotMode ?? "until-exit") +
          " });",
        `return __chat as unknown as ${ctx.outType};`,
      ].join("\n"),
    py: (ctx) =>
      [
        exportComment(PY, chatbotComment()),
        `result = await wait_for_chatbot_session(input, mode="${ctx.m.chatbotMode ?? "until-exit"}")`,
        pyCast(ctx, "result"),
      ].join("\n"),
    go: (ctx) => {
      const zero = goZeroValue(ctx.outType);
      return [
        exportComment(C, chatbotComment()),
        `result, err := WaitForChatbotSession(input, ${exportStringLiteral(ctx.m.chatbotMode ?? "until-exit")})`,
        "if err != nil {",
        `\treturn ${zero}, err`,
        "}",
        "return result, nil",
      ].join("\n");
    },
    rs: () =>
      [exportComment(C, chatbotComment()), "let __chat = wait_for_chatbot_session(&input).await?;", "Ok(__chat)"].join(
        "\n",
      ),
  },
  [ModuleKind.Webhook]: {
    ts: (ctx) => exportWebhookStepBodyTs(ctx.m, ctx.outType),
    py: (ctx) => exportWebhookStepBodyPy(ctx.m, ctx.outType),
    go: (ctx) => exportWebhookStepBodyGo(ctx.m, goZeroValue(ctx.outType)),
    rs: (ctx) => exportWebhookStepBodyRust(ctx.m),
  },
  [ModuleKind.N8n]: {
    ts: (ctx) => exportN8nStepBodyTs(ctx.m, ctx.outType),
    py: (ctx) => exportN8nStepBodyPy(ctx.m, ctx.outType),
    go: (ctx) => exportN8nStepBodyGo(ctx.m, goZeroValue(ctx.outType)),
    rs: (ctx) => exportN8nStepBodyRust(ctx.m),
  },
  [ModuleKind.Connect]: {
    ts: (ctx) => exportConnectStepBodyTs(ctx.m, ctx.outType),
    py: (ctx) => exportConnectStepBodyPy(ctx.m, ctx.outType),
    go: (ctx) => exportConnectStepBodyGo(ctx.m, goZeroValue(ctx.outType)),
    rs: (ctx) => exportConnectStepBodyRust(ctx.m),
  },
  [ModuleKind.Output]: {
    ts: (ctx) => {
      const { outName, inName } = names(ctx);
      return [exportComment(TS, snapshotComment(outName, inName)), tsCast(ctx.outType)].join("\n");
    },
    py: (ctx) => {
      const { outName, inName } = names(ctx);
      return [exportComment(PY, snapshotComment(outName, inName)), pyCast(ctx, "input")].join("\n");
    },
    go: (ctx) => {
      const { outName, inName } = names(ctx);
      return [exportComment(C, snapshotComment(outName, inName)), "return input, nil"].join("\n");
    },
    rs: (ctx) => {
      const { outName, inName } = names(ctx);
      return [exportComment(C, snapshotComment(outName, inName)), "Ok(input)"].join("\n");
    },
  },
};

export function emitStepBody(lang: ExportLang, ctx: StepBodyCtx): string {
  return STEP_BODY[ctx.m.kind][lang](ctx);
}
