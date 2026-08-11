import { orderedInputModules } from "@/lib/inference-input";
import { buildCustomFnSource } from "@/lib/custom_code";
import { customCodeEntriesForModule } from "@/lib/custom_code_entries";
import { usesPassthroughStructure } from "@/lib/module-kinds";
import { modelExportIdentifierGo, modelExportIdentifierRust, rustFieldIdent } from "@/lib/structure-shape";
import { BUILTIN_DOCUMENT_ID, withSharedModels } from "./builtin_models";
import { labelAsStateKey } from "./pipeline_state";
import {
  labelToPyKey,
  stepEmitsList,
  stepSpineInType,
  stepSpineOutType,
  typeExprToGo,
  typeExprToPy,
  typeExprToRust,
  typeExprToTs,
} from "./type_expr";
import { FieldType, ModuleKind } from "./types";
import type { StepLabel } from "../run-types";
import type { PipelineModule, Project, StructureModelId, TypeExpr } from "./types";
import { assemblePolymorphicTsSignature } from "@/lib/type-expr-polymorph";

export type PipelineSetupFile = {
  filename: string;
  content: string;
  mime: string;
};

export type ExportCustomCode = { language: string; code: string };

// AI : normalize project models before codegen so built-in Document resolves everywhere.
export function prepareExportProject(project: Project): Project {
  return { ...project, models: withSharedModels(project.models) };
}

// AI : shared by py / ts / rust / go / baml pipeline exporters — keep step bodies DRY across languages.
export function indentExportBlock(code: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return code
    .split("\n")
    .map((line) => (line ? `${pad}${line}` : line))
    .join("\n");
}

export function exportStringLiteral(s: string): string {
  return JSON.stringify(s);
}

export function primaryExportCustomCode(m: PipelineModule): ExportCustomCode | null {
  const entries = customCodeEntriesForModule(m);
  const primary = entries[0];
  if (!primary?.code.trim()) return null;
  return { language: primary.language, code: primary.code.trim() };
}

export function stepFnNameFromLabel(m: PipelineModule, index: number): string {
  const key = labelToPyKey(m.label);
  return key !== "_empty" ? `step_${key}` : `step_${index}`;
}

// AI : rustc non_snake_case — "✓ Wrap → List" → step_wrap_list; index disambiguates collisions.
export function makeUniqueStepFnName(): (m: PipelineModule, index: number) => string {
  const byIndex = new Map<number, string>();
  const used = new Set<string>();
  return (m, index) => {
    const cached = byIndex.get(index);
    if (cached) return cached;
    const key = labelToPyKey(m.label)
      .toLowerCase()
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
    let name = key ? `step_${key}` : `step_${index}`;
    if (used.has(name)) name = `step_${index}_${key || "step"}`;
    used.add(name);
    byIndex.set(index, name);
    return name;
  };
}

export function withExportLineCountMeta(
  content: string,
  prepared: Project,
  commentPrefix: "#" | "//",
): string {
  const base = `${commentPrefix} ${prepared.modules.length} steps · ${prepared.models.length} structures`;
  const lineCount = content.split("\n").length;
  const withMeta = content.replace(base, `${base} · ${lineCount} lines`);
  assertNoEnvKeysInExport(withMeta);
  return withMeta;
}

export function exportSpineInType(
  m: PipelineModule,
  project: Project,
  index: number,
): TypeExpr | undefined {
  const prev = index > 0 ? project.modules[index - 1] : undefined;
  if (m.kind === ModuleKind.Input) return { kind: "document" };
  if (m.kind === ModuleKind.Combine || usesPassthroughStructure(m.kind)) {
    return prev ? stepSpineOutType(prev) : undefined;
  }
  return stepSpineInType(m);
}

export function exportSpineInTs(m: PipelineModule, project: Project, index: number): string {
  const t = exportSpineInType(m, project, index);
  return t ? typeExprToTs(t, project.models) : "unknown";
}

export function exportSpineInPy(m: PipelineModule, project: Project, index: number): string {
  const t = exportSpineInType(m, project, index);
  return t ? typeExprToPy(t, project.models) : "Any";
}

export function exportSpineInRust(m: PipelineModule, project: Project, index: number): string {
  const t = exportSpineInType(m, project, index);
  return t ? typeExprToRust(t, project.models) : "Value";
}

export function exportSpineInGo(m: PipelineModule, project: Project, index: number): string {
  const t = exportSpineInType(m, project, index);
  return t ? typeExprToGo(t, project.models) : "json.RawMessage";
}

// AI : passthrough out follows the spine (prev), not a stale inStructureId on the module.
export function exportSpineOutType(
  m: PipelineModule,
  project: Project,
  index: number,
): TypeExpr | undefined {
  if (usesPassthroughStructure(m.kind)) {
    const prev = index > 0 ? project.modules[index - 1] : undefined;
    return prev ? stepSpineOutType(prev) : stepSpineOutType(m);
  }
  return stepSpineOutType(m);
}

export function exportSpineOutTs(m: PipelineModule, project: Project, index: number): string {
  const t = exportSpineOutType(m, project, index);
  return t ? typeExprToTs(t, project.models) : "unknown";
}

export function exportSpineOutPy(m: PipelineModule, project: Project, index: number): string {
  const t = exportSpineOutType(m, project, index);
  return t ? typeExprToPy(t, project.models) : "Any";
}

export function exportSpineOutRust(m: PipelineModule, project: Project, index: number): string {
  const t = exportSpineOutType(m, project, index);
  return t ? typeExprToRust(t, project.models) : "Value";
}

export function exportSpineOutGo(m: PipelineModule, project: Project, index: number): string {
  const t = exportSpineOutType(m, project, index);
  return t ? typeExprToGo(t, project.models) : "json.RawMessage";
}

// AI : zero value for Go return-on-error paths.
export function goZeroValue(goType: string): string {
  if (
    goType.startsWith("[]") ||
    goType.startsWith("*") ||
    goType.startsWith("map[") ||
    goType === "json.RawMessage" ||
    goType === "any"
  ) {
    return "nil";
  }
  if (goType === "string") return `""`;
  if (goType === "bool") return "false";
  if (goType === "int64" || goType === "float64") return "0";
  return `${goType}{}`;
}

// AI : export PipelineState keys use the same spine-out types as step signatures.
export function pipelineStateTsInterfaceForExport(project: Project): string {
  const lines: string[] = [];
  for (let i = 0; i < project.modules.length; i++) {
    const m = project.modules[i]!;
    const label = labelAsStateKey(m.label);
    if (!label) continue;
    lines.push(`  ${JSON.stringify(label)}: ${exportSpineOutTs(m, project, i)};`);
  }
  if (!lines.length) return "export type PipelineState = Record<string, never>;";
  return `export type PipelineState = {\n${lines.join("\n")}\n};`;
}

export function pipelineStatePyTypedDictForExport(project: Project): string {
  const entries: string[] = [];
  for (let i = 0; i < project.modules.length; i++) {
    const m = project.modules[i]!;
    const label = labelAsStateKey(m.label);
    if (!label) continue;
    // AI : functional TypedDict — keys must match runtime state["Human Label"] strings.
    entries.push(`    ${JSON.stringify(label)}: ${exportSpineOutPy(m, project, i)},`);
  }
  if (!entries.length) {
    return 'PipelineState = TypedDict("PipelineState", {})\n';
  }
  // AI : total=True (default) matches TS PipelineState — empty init uses cast(object, {}).
  return [
    'PipelineState = TypedDict(',
    '    "PipelineState",',
    "    {",
    ...entries,
    "    },",
    ")",
    "",
  ].join("\n");
}

export function modelName(project: Project, id: StructureModelId | undefined): string | undefined {
  if (!id) return undefined;
  return project.models.find((m) => m.id === id)?.name;
}

export function upstreamLabelForCombine(m: PipelineModule, project: Project): StepLabel | undefined {
  const id = m.inStructureId;
  if (!id) return undefined;
  for (const mod of project.modules) {
    if (mod.outStructureId === id) return labelAsStateKey(mod.label);
  }
  return undefined;
}

// AI : mirror execExampleSelectStep formatExampleContext — field path picks {description} text.
export function generateExampleContextExprTs(ctxLabel: string, fieldPath?: string): string {
  const key = JSON.stringify(ctxLabel);
  const base = `state[${key}]`;
  if (!fieldPath?.trim()) {
    return `(typeof ${base} === "string" ? ${base} : JSON.stringify(${base}, null, 2)) as string`;
  }
  let accessor = base;
  for (const part of fieldPath.trim().split(".").filter(Boolean)) {
    accessor = `(${accessor} as Record<string, unknown>)[${JSON.stringify(part)}]`;
  }
  return `(typeof ${accessor} === "string" ? ${accessor} : JSON.stringify(${accessor}, null, 2)) as string`;
}

export function generateExampleContextLinesPy(ctxLabel: string, fieldPath?: string): string[] {
  const key = exportStringLiteral(ctxLabel);
  if (!fieldPath?.trim()) {
    return [
      `_ctx = state[${key}]`,
      `description = _ctx if isinstance(_ctx, str) else json.dumps(_ctx, indent=2, default=str)`,
    ];
  }
  const lines = [`_ctx = state[${key}]`];
  for (const part of fieldPath.trim().split(".").filter(Boolean)) {
    lines.push(
      `_ctx = (_ctx.get(${exportStringLiteral(part)}) if isinstance(_ctx, dict) else getattr(_ctx, ${exportStringLiteral(part)}, None))`,
    );
  }
  lines.push(
    `description = _ctx if isinstance(_ctx, str) else json.dumps(_ctx, indent=2, default=str)`,
  );
  return lines;
}

function inputOutputsDocument(m: PipelineModule): boolean {
  return m.outStructureId === BUILTIN_DOCUMENT_ID;
}

function tsCustomCodeParamCount(code: string): number {
  const trimmed = code.trim();
  const parenArrow = trimmed.match(/^\(\s*([^)]*)\s*\)\s*=>/);
  if (parenArrow) {
    const params = parenArrow[1]!.trim();
    if (!params) return 0;
    return params.split(",").filter((p) => p.trim()).length;
  }
  if (/^[\w$]+\s*=>/.test(trimmed)) return 1;
  return 1;
}

function generateCustomCodeStepBodyTs(code: string, inTs: string, outTs: string): string {
  const fnSrc = buildCustomFnSource(code);
  return [
    `const __compiled = new Function("return " + ${JSON.stringify(fnSrc)})() as (input: ${inTs}, state?: PipelineState) => ${outTs};`,
    `return (__compiled.length >= 2 ? __compiled(input, state) : __compiled(input)) as ${outTs};`,
  ].join("\n");
}

function tsCustomCodeCall(code: string, outTs: string): string {
  return tsCustomCodeParamCount(code) <= 1
    ? `return __fn(input) as ${outTs};`
    : `return __fn(input, state) as ${outTs};`;
}

function tsCustomCodeFnDecl(code: string, inTs: string, outTs: string): string {
  const fnType =
    tsCustomCodeParamCount(code) <= 1
      ? `(input: ${inTs}) => ${outTs}`
      : `(input: ${inTs}, state: PipelineState) => ${outTs}`;
  return `const __fn: ${fnType} = ${code};`;
}

function pyCustomCodeCall(code: string, outPy: string): string {
  if (/^\s*def\s+\w+\s*\(/.test(code)) {
    return `return cast(${outPy}, cast(object, transform(input, state)))  # type: ignore[name-defined]`;
  }
  const unary = /^\(\s*input\s*\)\s*=>/.test(code) || /^\s*input\s*=>/.test(code);
  return unary
    ? `return cast(${outPy}, cast(object, __fn(input)))`
    : `return cast(${outPy}, cast(object, __fn(input, state)))`;
}

export function generateInputStepBodyTs(m: PipelineModule, outTs: string): string {
  // AI : TODO export — emit input-description LLM guard when checkInputDescription is enabled.
  // AI : TODO export — emit output-description LLM guard when checkOutputDescription ships (spec § pipeline).
  const purpose = m.inputDescription?.trim() || m.label || "general transcription";
  const lines = [
    "// Parse uploaded file — built-in parser or vision OCR when enabled",
    ...(m.inputDescription
      ? [
          `// Input guard: ${JSON.stringify(m.inputDescription)}${m.checkInputDescription === false ? " (disabled)" : ""}`,
        ]
      : []),
    ...(m.inputNameContains ? [`// Filename must contain: ${JSON.stringify(m.inputNameContains)}`] : []),
    "const doc = input as Document & { base64?: string; mime?: string };",
  ];
  if (m.useOcr) {
    lines.push(
      `let content = doc.content ?? "";`,
      `if (doc.base64 && doc.mime) {`,
      `  // Vision OCR via OpenRouter multimodal (override runtime.visionOcrModel for DeepSeek-OCR hosts)`,
      `  content = await visionOcr({ mime: doc.mime, base64: doc.base64 }, ${JSON.stringify(purpose)});`,
      `} else if (!content.trim()) {`,
      `  throw new Error("Vision OCR: pass Document.base64 + mime, or pre-extracted content");`,
      `}`,
    );
  } else {
    lines.push("const content = doc.content;");
  }
  if (inputOutputsDocument(m)) {
    const docObj = "{ content, filename: doc.filename }";
    lines.push(stepEmitsList(m) ? `return [${docObj}];` : `return ${docObj};`);
    return lines.join("\n");
  }
  if (stepEmitsList(m)) {
    lines.push(`const parsed = JSON.parse(content) as unknown;`);
    lines.push(`return (Array.isArray(parsed) ? parsed : [parsed]) as ${outTs};`);
  } else {
    lines.push(`return JSON.parse(content) as ${outTs};`);
  }
  return lines.join("\n");
}

export function generateInputStepBodyPy(m: PipelineModule, outPy: string): string {
  const purpose = m.inputDescription?.trim() || m.label || "general transcription";
  const lines = [
    "# Parse uploaded file — built-in parser or vision OCR when enabled",
    ...(m.inputDescription
      ? [
          `# Input guard: ${JSON.stringify(m.inputDescription)}${m.checkInputDescription === false ? " (disabled)" : ""}`,
        ]
      : []),
    ...(m.inputNameContains ? [`# Filename must contain: ${JSON.stringify(m.inputNameContains)}`] : []),
    "doc = input",
  ];
  if (m.useOcr) {
    lines.push(
      'content = getattr(doc, "content", None) or (doc.get("content") if isinstance(doc, dict) else "") or ""',
      'base64 = getattr(doc, "base64", None) or (doc.get("base64") if isinstance(doc, dict) else None)',
      'mime = getattr(doc, "mime", None) or (doc.get("mime") if isinstance(doc, dict) else None)',
      "if base64 and mime:",
      "    # Vision OCR via OpenRouter multimodal (override vision_ocr_model for DeepSeek-OCR hosts)",
      `    content = await vision_ocr(str(mime), str(base64), ${JSON.stringify(purpose)})`,
      "elif not str(content).strip():",
      '    raise RuntimeError("Vision OCR: pass Document base64 + mime, or pre-extracted content")',
    );
  } else {
    lines.push("content = doc.content");
  }
  if (inputOutputsDocument(m)) {
    lines.push(
      stepEmitsList(m)
        ? "return [Document(content=content, filename=doc.filename)]"
        : "return Document(content=content, filename=doc.filename)",
    );
    return lines.join("\n");
  }
  if (stepEmitsList(m)) {
    lines.push("parsed = json.loads(content)");
    lines.push(`return cast(${outPy}, cast(object, parsed if isinstance(parsed, list) else [parsed]))`);
  } else {
    lines.push(`return cast(${outPy}, cast(object, json.loads(content)))`);
  }
  return lines.join("\n");
}

export function generateInputStepBodyRust(m: PipelineModule, outRust: string): string {
  const lines = [
    "// Parse uploaded file — built-in parser or vision OCR when enabled",
    ...(m.inputDescription
      ? [
          `// Input guard: ${JSON.stringify(m.inputDescription)}${m.checkInputDescription === false ? " (disabled)" : ""}`,
        ]
      : []),
    ...(m.inputNameContains ? [`// Filename must contain: ${JSON.stringify(m.inputNameContains)}`] : []),
    ...(m.useOcr ? ["// Vision OCR enabled for PDF/image uploads"] : []),
  ];
  if (inputOutputsDocument(m)) {
    if (stepEmitsList(m)) {
      lines.push("Ok(vec![input])");
    } else {
      lines.push("Ok(input)");
    }
    return lines.join("\n");
  }
  lines.push("let parsed: Value = serde_json::from_str(&input.content)?;");
  if (stepEmitsList(m)) {
    lines.push(`let out: ${outRust} = if parsed.is_array() {`);
    lines.push("    serde_json::from_value(parsed)?");
    lines.push("} else {");
    lines.push("    serde_json::from_value(Value::Array(vec![parsed]))?");
    lines.push("};");
    lines.push("Ok(out)");
  } else {
    lines.push(`let out: ${outRust} = serde_json::from_value(parsed)?;`);
    lines.push("Ok(out)");
  }
  return lines.join("\n");
}

export function generateInputStepBodyGo(m: PipelineModule, outGo: string): string {
  const zero = goZeroValue(outGo);
  const lines = [
    "// Parse uploaded file — built-in parser or vision OCR when enabled",
    ...(m.inputDescription
      ? [
          `// Input guard: ${JSON.stringify(m.inputDescription)}${m.checkInputDescription === false ? " (disabled)" : ""}`,
        ]
      : []),
    ...(m.inputNameContains ? [`// Filename must contain: ${JSON.stringify(m.inputNameContains)}`] : []),
    ...(m.useOcr ? ["// Vision OCR enabled for PDF/image uploads"] : []),
  ];
  if (inputOutputsDocument(m)) {
    if (stepEmitsList(m)) {
      lines.push("return []Document{input}, nil");
    } else {
      lines.push("return input, nil");
    }
    return lines.join("\n");
  }
  lines.push("var parsed any");
  lines.push("if err := json.Unmarshal([]byte(input.Content), &parsed); err != nil {");
  lines.push(`\treturn ${zero}, err`);
  lines.push("}");
  if (stepEmitsList(m)) {
    lines.push("arr, ok := parsed.([]any)");
    lines.push("if !ok {");
    lines.push("\tarr = []any{parsed}");
    lines.push("}");
    lines.push("b, err := json.Marshal(arr)");
    lines.push("if err != nil {");
    lines.push(`\treturn ${zero}, err`);
    lines.push("}");
  } else {
    lines.push("b, err := json.Marshal(parsed)");
    lines.push("if err != nil {");
    lines.push(`\treturn ${zero}, err`);
    lines.push("}");
  }
  lines.push(`var out ${outGo}`);
  lines.push("if err := json.Unmarshal(b, &out); err != nil {");
  lines.push(`\treturn ${zero}, err`);
  lines.push("}");
  lines.push("return out, nil");
  return lines.join("\n");
}

// AI : the side input (or its auto parse llm) directly precedes the combine — its emitted
// AI : structure lands in matching ref fields, mirroring execCombineStep.
function combineSideStructId(m: PipelineModule, project: Project): StructureModelId | undefined {
  const i = project.modules.findIndex((x) => x.id === m.id);
  const id = i > 0 ? project.modules[i - 1]?.outStructureId : undefined;
  return id && id !== BUILTIN_DOCUMENT_ID && id !== m.inStructureId ? id : undefined;
}

export function generateCombineStepBodyTs(m: PipelineModule, project: Project, outTs: string): string {
  const out = project.models.find((x) => x.id === m.outStructureId);
  const inName = modelName(project, m.inStructureId);
  const sideId = combineSideStructId(m, project);
  const upstreamLabel = upstreamLabelForCombine(m, project);
  // AI : always a string literal — comment placeholders are invalid as index expressions.
  const upstreamKey = JSON.stringify(upstreamLabel ?? "upstream");
  const fieldExprs =
    out?.fields.map((f) => {
      if (f.type === FieldType.Document) return `${f.name}: newDoc as Document`;
      if (sideId && f.ref === sideId) return `${f.name}: newDoc as ${modelName(project, sideId)}`;
      // AI : missing upstream label → index via Record so tsc still accepts the fallback key.
      return upstreamLabel
        ? `${f.name}: state[${upstreamKey}]`
        : `${f.name}: (state as Record<string, unknown>)[${upstreamKey}]`;
    }) ?? [];
  return [
    `// Merge uploaded document with upstream ${inName ?? "pipeline data"} from pipeline state`,
    "const newDoc = Array.isArray(input) ? input[0] : input;",
    `const merged = { ${fieldExprs.join(", ")} };`,
    `return merged as ${outTs};`,
  ].join("\n");
}

function assembleFieldExprTs(source: import("./types").AssembleSource): string {
  if (source.kind === "spine") return "input";
  if (source.kind === "state") return `state[${JSON.stringify(source.label.trim())}]`;
  const root =
    source.from === "spine" ? "input" : `state[${JSON.stringify(source.from.label.trim())}]`;
  const parts = source.path.split(".").map((p) => p.trim()).filter(Boolean);
  return parts.reduce((acc, part) => `(${acc} as Record<string, unknown>)[${JSON.stringify(part)}]`, root);
}

export function generateAssembleStepBodyTs(m: PipelineModule, project: Project, outTs: string): string {
  const bindings = m.assembleBindings ?? {};
  const fieldExprs = Object.entries(bindings).map(
    ([name, source]) => `${name}: ${assembleFieldExprTs(source)}`,
  );
  const poly = assemblePolymorphicTsSignature(m.outType, bindings, project.typeAliases ?? []);
  const lines = [
    "// Zip spine + pipeline state labels into one flat structure (Assemble)",
    ...(poly ? [`// polymorphic shape ${poly}`] : []),
    `const assembled = { ${fieldExprs.join(", ")} };`,
    `return assembled as ${outTs};`,
  ];
  return lines.join("\n");
}

export function generateAssembleStepBodyPy(m: PipelineModule, _project: Project, outPy: string): string {
  const bindings = m.assembleBindings ?? {};
  const fieldExprs = Object.entries(bindings).map(([name, source]) => {
    let rhs: string
    if (source.kind === "spine") rhs = "input"
    else if (source.kind === "state") rhs = `state[${JSON.stringify(source.label.trim())}]`
    else {
      const root =
        source.from === "spine" ? "input" : `state[${JSON.stringify(source.from.label.trim())}]`
      const parts = source.path.split(".").map((p) => p.trim()).filter(Boolean)
      rhs = root
      for (const part of parts) {
        rhs = `(${rhs}.get(${JSON.stringify(part)}) if isinstance(${rhs}, dict) else getattr(${rhs}, ${JSON.stringify(part)}, None))`
      }
    }
    return `"${name}": ${rhs}`;
  });
  return [
    "# Zip spine + pipeline state labels into one flat structure (Assemble)",
    `return cast(${outPy}, cast(object, {${fieldExprs.join(", ")}}))`,
  ].join("\n");
}

export function generateParallelStepBodyTs(m: PipelineModule, outTs: string): string {
  const branches = m.parallelBranches ?? [];
  const calls = branches.map(
    (b) =>
      `${JSON.stringify(b.field)}: await llmStructured(${JSON.stringify(b.prompt || "Process the input.")} + "\\n\\nINPUT DATA:\\n" + JSON.stringify(input), /* schema for ${b.outStructureId} */ {} as never)`,
  );
  return [
    "// Parallel LLM branches on shared spine input, then join",
    `const assembled = { ${calls.join(", ")} };`,
    `return assembled as ${outTs};`,
  ].join("\n");
}

export function generateAssembleStepBodyRust(m: PipelineModule, project: Project, outRust: string): string {
  const bindings = m.assembleBindings ?? {};
  const rawOutName = modelName(project, m.outStructureId);
  const outName = rawOutName ? modelExportIdentifierRust(rawOutName) : outRust;
  const inserts = Object.entries(bindings).map(([name, source]) => {
    let rhs: string;
    if (source.kind === "spine") rhs = "serde_json::to_value(&input)?";
    else if (source.kind === "state") {
      rhs = `state.get(${JSON.stringify(source.label.trim())}).cloned().unwrap_or(Value::Null)`;
    } else {
      const root =
        source.from === "spine"
          ? "serde_json::to_value(&input)?"
          : `state.get(${JSON.stringify(source.from.label.trim())}).cloned().unwrap_or(Value::Null)`;
      const parts = source.path.split(".").map((p) => p.trim()).filter(Boolean);
      rhs = root;
      for (const part of parts) {
        rhs = `(${rhs}).get(${JSON.stringify(part)}).cloned().unwrap_or(Value::Null)`;
      }
    }
    return `map.insert(${JSON.stringify(name)}.to_string(), ${rhs});`;
  });
  return [
    "// Zip spine + pipeline state labels into one flat structure (Assemble)",
    "let mut map = serde_json::Map::new();",
    ...inserts,
    `let out: ${outName} = serde_json::from_value(Value::Object(map))?;`,
    "Ok(out)",
  ].join("\n");
}

export function generateAssembleStepBodyGo(m: PipelineModule, project: Project, outGo: string): string {
  const bindings = m.assembleBindings ?? {};
  const zero = `*new(${outGo})`;
  const assigns = Object.entries(bindings).map(([name, source]) => {
    let rhs: string;
    if (source.kind === "spine") rhs = "input";
    else if (source.kind === "state") rhs = `state[${JSON.stringify(source.label.trim())}]`;
    else {
      rhs =
        source.from === "spine" ? "input" : `state[${JSON.stringify(source.from.label.trim())}]`;
      // AI : path dig is left to runtime helper in full Go export; export stores root for now.
    }
    return `\t${JSON.stringify(name)}: ${rhs},`;
  });
  return [
    "// Zip spine + pipeline state labels into one flat structure (Assemble)",
    "payload := map[string]any{",
    ...assigns,
    "}",
    "b, err := json.Marshal(payload)",
    "if err != nil {",
    `\treturn ${zero}, err`,
    "}",
    `var merged ${outGo}`,
    "if err := json.Unmarshal(b, &merged); err != nil {",
    `\treturn ${zero}, err`,
    "}",
    "return merged, nil",
  ].join("\n");
}

export function generateCombineStepBodyPy(
  m: PipelineModule,
  project: Project,
  outPy: string,
  inPy: string,
): string {
  const out = project.models.find((x) => x.id === m.outStructureId);
  const inName = modelName(project, m.inStructureId);
  const sideId = combineSideStructId(m, project);
  const upstreamLabel = upstreamLabelForCombine(m, project);
  // AI : always a string literal — comment placeholders are invalid as index expressions.
  const upstreamKey = JSON.stringify(upstreamLabel ?? "upstream");
  const fieldExprs =
    out?.fields.map((f) => {
      if (f.type === FieldType.Document) return `"${f.name}": new_doc`;
      if (sideId && f.ref === sideId) return `"${f.name}": new_doc`;
      return `"${f.name}": state[${upstreamKey}]`;
    }) ?? [];
  // AI : skip isinstance when the spine type is already a list.
  const unwrap = inPy.startsWith("list[") ? "new_doc = input[0]" : "new_doc = input";
  // AI : cast via object — dict literals are not TypedDict/BaseModel-compatible under strict pyright.
  return [
    `# Merge uploaded document with upstream ${inName ?? "pipeline data"} from pipeline state`,
    unwrap,
    `return cast(${outPy}, cast(object, {${fieldExprs.join(", ")}}))`,
  ].join("\n");
}

export function generateCombineStepBodyRust(m: PipelineModule, project: Project, outRust: string, inRust: string): string {
  const out = project.models.find((x) => x.id === m.outStructureId);
  const inName = modelName(project, m.inStructureId);
  const sideId = combineSideStructId(m, project);
  const upstreamLabel = upstreamLabelForCombine(m, project);
  const upstreamKey = upstreamLabel ? JSON.stringify(upstreamLabel) : '"upstream"';
  const rawOutName = modelName(project, m.outStructureId);
  const outName = rawOutName ? modelExportIdentifierRust(rawOutName) : outRust;
  const fieldExprs =
    out?.fields.map((f) => {
      const fname = rustFieldIdent(f.name).ident;
      if (f.type === FieldType.Document) return `        ${fname}: new_doc.clone(),`;
      if (sideId && f.ref === sideId) {
        return `        ${fname}: serde_json::from_value(serde_json::to_value(&new_doc)?)?,`;
      }
      return `        ${fname}: serde_json::from_value(state.get(${upstreamKey}).cloned().unwrap_or(Value::Null))?,`;
    }) ?? [];
  // AI : mirror TS/Py — list side-inputs unwrap to the first document.
  const unwrap = inRust.startsWith("Vec<")
    ? 'let new_doc = input.into_iter().next().ok_or_else(|| anyhow::anyhow!("combine expects at least one document"))?;'
    : "let new_doc = input;";
  return [
    `// Merge uploaded document with upstream ${inName ?? "pipeline data"} from pipeline state`,
    unwrap,
    `let merged = ${outName} {`,
    ...fieldExprs,
    "};",
    "Ok(merged)",
  ].join("\n");
}

export function generateCombineStepBodyGo(
  m: PipelineModule,
  project: Project,
  outGo: string,
  inGo: string,
): string {
  const out = project.models.find((x) => x.id === m.outStructureId);
  const inName = modelName(project, m.inStructureId);
  const sideId = combineSideStructId(m, project);
  const upstreamLabel = upstreamLabelForCombine(m, project);
  const upstreamKey = upstreamLabel ? JSON.stringify(upstreamLabel) : '"upstream"';
  const rawOutName = modelName(project, m.outStructureId);
  const outName = rawOutName ? modelExportIdentifierGo(rawOutName) : outGo;
  const zero = goZeroValue(outGo);
  const fieldEntries =
    out?.fields.map((f) => {
      if (f.type === FieldType.Document || (sideId && f.ref === sideId)) {
        return `\t\t${JSON.stringify(f.name)}: newDoc,`;
      }
      return `\t\t${JSON.stringify(f.name)}: state[${upstreamKey}],`;
    }) ?? [];
  const unwrap = inGo.startsWith("[]")
    ? [
        "if len(input) == 0 {",
        `\treturn ${zero}, fmt.Errorf("combine expects at least one document")`,
        "}",
        "newDoc := input[0]",
      ].join("\n")
    : "newDoc := input";
  return [
    `// Merge uploaded document with upstream ${inName ?? "pipeline data"} from pipeline state`,
    unwrap,
    "payload := map[string]any{",
    ...fieldEntries,
    "}",
    "b, err := json.Marshal(payload)",
    "if err != nil {",
    `\treturn ${zero}, err`,
    "}",
    `var merged ${outName}`,
    "if err := json.Unmarshal(b, &merged); err != nil {",
    `\treturn ${zero}, err`,
    "}",
    "return merged, nil",
  ].join("\n");
}

export type OrchestratorLang = "ts" | "py" | "rs" | "go";

function orchestratorInputMods(project: Project): PipelineModule[] {
  return orderedInputModules(project.modules);
}

function orchestratorInvokeLine(
  m: PipelineModule,
  fn: string,
  lang: OrchestratorLang,
  singleInput: boolean,
  inTs: string,
): string {
  const label = labelAsStateKey(m.label);
  if (lang === "go") {
    if (m.kind !== ModuleKind.Input) {
      return [
        `    var _in_${fn} ${inTs}`,
        `    if err := json.Unmarshal(spine, &_in_${fn}); err != nil {`,
        "        return nil, err",
        "    }",
        `    _out_${fn}, err := ${fn}(_in_${fn}, state)`,
        "    if err != nil {",
        "        return nil, err",
        "    }",
        `    spine, err = json.Marshal(_out_${fn})`,
        "    if err != nil {",
        "        return nil, err",
        "    }",
      ].join("\n");
    }
    const inputExpr = singleInput
      ? "initialInput"
      : `inputs[${JSON.stringify(label)}]`;
    return [
      `    _out_${fn}, err := ${fn}(${inputExpr}, state)`,
      "    if err != nil {",
      "        return nil, err",
      "    }",
      `    spine, err = json.Marshal(_out_${fn})`,
      "    if err != nil {",
      "        return nil, err",
      "    }",
    ].join("\n");
  }
  if (lang === "rs") {
    if (m.kind !== ModuleKind.Input) {
      return `    spine = serde_json::to_value(${fn}(serde_json::from_value(spine)?, &mut state).await?)?;`;
    }
    if (singleInput) {
      return `    spine = serde_json::to_value(${fn}(initial_input, &mut state).await?)?;`;
    }
    return `    spine = serde_json::to_value(${fn}(inputs.get(${JSON.stringify(label)}).cloned().ok_or_else(|| anyhow::anyhow!("missing input"))?, &mut state).await?)?;`;
  }
  if (m.kind !== ModuleKind.Input) {
    return lang === "ts"
      ? `  spine = await ${fn}(spine as ${inTs}, state);`
      : `    spine = await ${fn}(spine, state)`;
  }
  if (singleInput) {
    return lang === "ts" ? `  spine = await ${fn}(initialInput, state);` : `    spine = await ${fn}(initial_input, state)`;
  }
  const key = JSON.stringify(label);
  return lang === "ts"
    ? `  spine = await ${fn}(inputs[${key}], state);`
    : `    spine = await ${fn}(inputs[${key}], state)`;
}

export function generateOrchestratorTs(project: Project, stepFnName: (m: PipelineModule, i: number) => string): string {
  const inputMods = orchestratorInputMods(project);
  const multi = inputMods.length > 1;
  const lines: string[] = [
    "export type PipelineStepTraceEntry = { label: string; output: unknown };",
    "",
    "let lastRunTrace: PipelineStepTraceEntry[] = [];",
    "",
    "export function getLastRunTrace(): PipelineStepTraceEntry[] {",
    "  return lastRunTrace;",
    "}",
    "",
    "function snapshotTraceOutput(value: unknown): unknown {",
    "  return JSON.parse(JSON.stringify(value));",
    "}",
    "",
  ];

  if (multi) {
    lines.push("export type PipelineRunInputs = {");
    for (const m of inputMods) {
      lines.push(`  ${JSON.stringify(labelAsStateKey(m.label))}: Document;`);
    }
    lines.push("};", "");
    lines.push("export async function runPipeline(inputs: PipelineRunInputs): Promise<unknown> {");
  } else {
    lines.push("export async function runPipeline(initialInput: Document): Promise<unknown> {");
  }

  lines.push(
    "  lastRunTrace = [];",
    "  const state = {} as PipelineState;",
    "  let spine: unknown;",
    "",
  );

  for (let i = 0; i < project.modules.length; i++) {
    const m = project.modules[i]!;
    const fn = stepFnName(m, i);
    const label = labelAsStateKey(m.label);
    const outTs = exportSpineOutTs(m, project, i);
    const inTs = exportSpineInTs(m, project, i);
    lines.push(`  // ${i + 1}. ${m.label}`);
    lines.push(orchestratorInvokeLine(m, fn, "ts", !multi, inTs));
    if (label) {
      lines.push(`  state[${JSON.stringify(label)}] = spine as ${outTs};`);
      lines.push(
        `  lastRunTrace.push({ label: ${JSON.stringify(label)}, output: snapshotTraceOutput(spine) });`,
      );
    }
    lines.push("");
  }

  lines.push("  return spine;", "}", "");
  return lines.join("\n");
}

export function generateOrchestratorPy(project: Project, stepFnName: (m: PipelineModule, i: number) => string): string {
  const inputMods = orchestratorInputMods(project);
  const multi = inputMods.length > 1;
  const lines: string[] = [
    "last_run_trace: list[dict[str, Any]] = []",
    "",
    "def get_last_run_trace() -> list[dict[str, Any]]:",
    "    return last_run_trace",
    "",
  ];

  if (multi) {
    lines.push("async def run_pipeline(inputs: dict[str, Document]) -> Any:");
  } else {
    lines.push("async def run_pipeline(initial_input: Document) -> Any:");
  }

  lines.push(
    "    global last_run_trace",
    "    last_run_trace = []",
    "    state = cast(PipelineState, cast(object, {}))",
    "    spine: Any = None",
    "",
  );

  for (let i = 0; i < project.modules.length; i++) {
    const m = project.modules[i]!;
    const fn = stepFnName(m, i);
    const label = labelAsStateKey(m.label);
    const inTs = exportSpineInPy(m, project, i);
    lines.push(`    # ${i + 1}. ${m.label}`);
    lines.push(orchestratorInvokeLine(m, fn, "py", !multi, inTs));
    if (label) {
      lines.push(`    state[${JSON.stringify(label)}] = spine`);
      lines.push(
        `    last_run_trace.append({"label": ${JSON.stringify(label)}, "output": json.loads(json.dumps(spine, default=str))})`,
      );
    }
    lines.push("");
  }

  lines.push("    return spine", "");
  return lines.join("\n");
}

// AI : async Rust orchestrator — spine as Value between steps for open typing.
export function generateOrchestratorRust(project: Project, stepFnName: (m: PipelineModule, i: number) => string): string {
  const inputMods = orchestratorInputMods(project);
  const multi = inputMods.length > 1;
  const lines: string[] = [];

  if (multi) {
    lines.push("pub async fn run_pipeline(inputs: HashMap<String, Document>) -> anyhow::Result<Value> {");
  } else {
    lines.push("pub async fn run_pipeline(initial_input: Document) -> anyhow::Result<Value> {");
  }

  lines.push("    let mut state: PipelineState = HashMap::new();", "    let mut spine: Value;", "");

  for (let i = 0; i < project.modules.length; i++) {
    const m = project.modules[i]!;
    const fn = stepFnName(m, i);
    const label = labelAsStateKey(m.label);
    const inRust = exportSpineInRust(m, project, i);
    lines.push(`    // ${i + 1}. ${m.label}`);
    lines.push(orchestratorInvokeLine(m, fn, "rs", !multi, inRust));
    if (label) {
      if (m.kind === ModuleKind.Input) {
        lines.push(`    state.insert(${JSON.stringify(label)}.to_string(), spine.clone());`);
      } else {
        lines.push(`    state.insert(${JSON.stringify(label)}.to_string(), spine.clone());`);
      }
    }
    lines.push("");
  }

  lines.push("    Ok(spine)", "}", "");
  return lines.join("\n");
}

// AI : Go orchestrator — spine as json.RawMessage between steps for open typing.
export function generateOrchestratorGo(project: Project, stepFnName: (m: PipelineModule, i: number) => string): string {
  const inputMods = orchestratorInputMods(project);
  const multi = inputMods.length > 1;
  const lines: string[] = [];

  if (multi) {
    lines.push("func RunPipeline(inputs map[string]Document) (json.RawMessage, error) {");
  } else {
    lines.push("func RunPipeline(initialInput Document) (json.RawMessage, error) {");
  }

  lines.push("    state := make(PipelineState)", "    var spine json.RawMessage", "    var err error", "");

  for (let i = 0; i < project.modules.length; i++) {
    const m = project.modules[i]!;
    const fn = stepFnName(m, i);
    const label = labelAsStateKey(m.label);
    const inGo = exportSpineInGo(m, project, i);
    lines.push(`    // ${i + 1}. ${m.label}`);
    lines.push(orchestratorInvokeLine(m, fn, "go", !multi, inGo));
    if (label) {
      lines.push(`    state[${JSON.stringify(label)}] = append(json.RawMessage(nil), spine...)`);
    }
    lines.push("");
  }

  lines.push("    return spine, nil", "}", "");
  return lines.join("\n");
}

export { generateCustomCodeStepBodyTs, tsCustomCodeCall, tsCustomCodeFnDecl, pyCustomCodeCall };

// AI : block exports that reference runtime secrets or env wiring.
// AI : TODO export — optional Supabase hooks in orchestrator (persist run metadata + per-step spine snapshots).
// AI : TODO export — emit cache lookup/store around LLM steps when module.cached or runtime.enableCache is set.
const ENV_ACCESS_PATTERNS: RegExp[] = [
  /\bprocess\.env\b/,
  /\bprocess\[["']env["']\]/,
  /\bos\.environ\b/,
  /\bos\.getenv\s*\(/,
  /\bos\.Getenv\b/,
  /\bgetenv\s*\(/,
  /\bDeno\.env\b/,
  /\bimport\.meta\.env\b/,
  /\bstd::env::/,
  /\benv::var\b/,
];

const ENV_KEY_NAME_PATTERNS: RegExp[] = [
  /\bSUPABASE_[A-Z0-9_]+\b/,
  /\bNEXT_PUBLIC_SUPABASE_[A-Z0-9_]+\b/,
  /\bOPENROUTER_[A-Z0-9_]+\b/,
  /\bSTRIPE_[A-Z0-9_]+\b/,
  /\bOPENROUTER_API_KEY\b/,
  /\bSUPABASE_SERVICE_ROLE_KEY\b/,
  /\bSTRIPE_SECRET_KEY\b/,
  /\bSTRIPE_WEBHOOK_SECRET\b/,
  /\bSEED_USER_ID\b/,
];

const SECRET_VALUE_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9]{20,}\b/,
  /\bsb_[A-Za-z0-9_-]{20,}\b/,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
];

// AI : .env.example placeholders — empty assignment or public URL, not live secrets.
const ENV_KEY_EMPTY_ASSIGNMENT = /^\s*=\s*(""|''|)\s*(?:#.*)?(?:\r?\n|$)/;
const ENV_KEY_PUBLIC_URL_ASSIGNMENT = /^\s*=\s*"https?:\/\//;

function isAllowedEnvKeyMention(source: string, matchIndex: number, matchLength: number): boolean {
  const after = source.slice(matchIndex + matchLength);
  if (!/^\s*=/.test(after)) return true;
  return ENV_KEY_EMPTY_ASSIGNMENT.test(after) || ENV_KEY_PUBLIC_URL_ASSIGNMENT.test(after);
}

function envKeyNameLeaks(source: string): string[] {
  const hits = new Set<string>();
  for (const re of ENV_KEY_NAME_PATTERNS) {
    const global = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    let match: RegExpExecArray | null;
    while ((match = global.exec(source)) !== null) {
      if (isAllowedEnvKeyMention(source, match.index, match[0].length)) continue;
      hits.add(re.source);
      break;
    }
  }
  return [...hits];
}

export function findEnvLeaksInExport(source: string): string[] {
  const hits = new Set<string>();
  for (const re of ENV_ACCESS_PATTERNS) {
    if (re.test(source)) hits.add(re.source);
  }
  for (const leak of envKeyNameLeaks(source)) hits.add(leak);
  for (const re of SECRET_VALUE_PATTERNS) {
    if (re.test(source)) hits.add(re.source);
  }
  return [...hits];
}

export function assertNoEnvKeysInExport(source: string): void {
  const leaks = findEnvLeaksInExport(source);
  if (leaks.length) {
    throw new Error(
      `Pipeline export blocked: output contains env or secret patterns (${leaks.slice(0, 4).join(", ")}${leaks.length > 4 ? ", …" : ""}). Remove them from step code or prompts before exporting.`,
    );
  }
}
