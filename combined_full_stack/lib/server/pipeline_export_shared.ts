import { orderedInputModules } from "@/lib/inference-input";
import { usesPassthroughStructure } from "@/lib/module-kinds";
import { BUILTIN_DOCUMENT_ID, withSharedModels } from "./builtin_models";
import { labelAsStateKey } from "./pipeline_state";
import { stepSpineInType, stepSpineOutType, typeExprToPy, typeExprToTs } from "./type_expr";
import { FieldType, ModuleKind } from "./types";
import type { StepLabel } from "../run-types";
import type { PipelineModule, Project, StructureModelId, TypeExpr } from "./types";

export type PipelineSetupFile = {
  filename: string;
  content: string;
  mime: string;
};

// AI : normalize project models before codegen so built-in Document resolves everywhere.
export function prepareExportProject(project: Project): Project {
  return { ...project, models: withSharedModels(project.models) };
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

function inputOutputsDocument(m: PipelineModule): boolean {
  return m.outStructureId === BUILTIN_DOCUMENT_ID;
}

function tsCustomCodeCall(code: string, outTs: string): string {
  const unary = /^\(\s*input\s*\)\s*=>/.test(code) || /^\s*input\s*=>/.test(code);
  return unary ? `return __fn(input) as ${outTs};` : `return __fn(input, state) as ${outTs};`;
}

function pyCustomCodeCall(code: string): string {
  if (/^\s*def\s+\w+\s*\(/.test(code)) {
    return "return transform(input, state)  # type: ignore[name-defined]";
  }
  const unary = /^\(\s*input\s*\)\s*=>/.test(code) || /^\s*input\s*=>/.test(code);
  return unary ? "return __fn(input)" : "return __fn(input, state)";
}

export function generateInputStepBodyTs(m: PipelineModule, outTs: string): string {
  // AI : TODO export — emit input-description LLM guard when checkInputDescription is enabled.
  // AI : TODO export — emit output-description LLM guard when checkOutputDescription ships (spec § pipeline).
  const lines = [
    "// Parse uploaded file — built-in parser or vision OCR when enabled",
    ...(m.inputDescription
      ? [
          `// Input guard: ${JSON.stringify(m.inputDescription)}${m.checkInputDescription === false ? " (disabled)" : ""}`,
        ]
      : []),
    ...(m.inputNameContains ? [`// Filename must contain: ${JSON.stringify(m.inputNameContains)}`] : []),
    ...(m.useOcr ? ["// Vision OCR enabled for PDF/image uploads"] : []),
    "const doc = input as Document;",
  ];
  if (inputOutputsDocument(m)) {
    lines.push("return { content: doc.content, filename: doc.filename };");
    return lines.join("\n");
  }
  if (m.outIsList) {
    lines.push(`const parsed = JSON.parse(doc.content) as unknown;`);
    lines.push(`return (Array.isArray(parsed) ? parsed : [parsed]) as ${outTs};`);
  } else {
    lines.push(`return JSON.parse(doc.content) as ${outTs};`);
  }
  return lines.join("\n");
}

export function generateInputStepBodyPy(m: PipelineModule): string {
  const lines = [
    "# Parse uploaded file — built-in parser or vision OCR when enabled",
    ...(m.inputDescription
      ? [
          `# Input guard: ${JSON.stringify(m.inputDescription)}${m.checkInputDescription === false ? " (disabled)" : ""}`,
        ]
      : []),
    ...(m.inputNameContains ? [`# Filename must contain: ${JSON.stringify(m.inputNameContains)}`] : []),
    ...(m.useOcr ? ["# Vision OCR enabled for PDF/image uploads"] : []),
    "doc = input",
  ];
  if (inputOutputsDocument(m)) {
    lines.push('return {"content": doc["content"], "filename": doc["filename"]}');
    return lines.join("\n");
  }
  if (m.outIsList) {
    lines.push("parsed = json.loads(doc['content'])");
    lines.push("return parsed if isinstance(parsed, list) else [parsed]");
  } else {
    lines.push("return json.loads(doc['content'])");
  }
  return lines.join("\n");
}

export function generateCombineStepBodyTs(m: PipelineModule, project: Project, outTs: string): string {
  const out = project.models.find((x) => x.id === m.outStructureId);
  const inName = modelName(project, m.inStructureId);
  const upstreamLabel = upstreamLabelForCombine(m, project);
  const upstreamKey = upstreamLabel ? JSON.stringify(upstreamLabel) : "/* upstream label */";
  const fieldExprs =
    out?.fields.map((f) => {
      if (f.type === FieldType.Document) return `${f.name}: newDoc as Document`;
      return `${f.name}: state[${upstreamKey}]`;
    }) ?? [];
  return [
    `// Merge uploaded document with upstream ${inName ?? "pipeline data"} from pipeline state`,
    "const newDoc = Array.isArray(input) ? input[0] : input;",
    `const merged = { ${fieldExprs.join(", ")} };`,
    `return merged as ${outTs};`,
  ].join("\n");
}

export function generateCombineStepBodyPy(m: PipelineModule, project: Project): string {
  const out = project.models.find((x) => x.id === m.outStructureId);
  const inName = modelName(project, m.inStructureId);
  const upstreamLabel = upstreamLabelForCombine(m, project);
  const upstreamKey = upstreamLabel ? JSON.stringify(upstreamLabel) : '"upstream"';
  const fieldExprs =
    out?.fields.map((f) => {
      if (f.type === FieldType.Document) return `"${f.name}": new_doc`;
      return `"${f.name}": state[${upstreamKey}]`;
    }) ?? [];
  return [
    `# Merge uploaded document with upstream ${inName ?? "pipeline data"} from pipeline state`,
    "new_doc = input[0] if isinstance(input, list) else input",
    `return {${fieldExprs.join(", ")}}`,
  ].join("\n");
}

export type OrchestratorLang = "ts" | "py";

function orchestratorInputMods(project: Project): PipelineModule[] {
  return orderedInputModules(project.modules);
}

function orchestratorInvokeLine(
  m: PipelineModule,
  fn: string,
  lang: OrchestratorLang,
  singleInput: boolean,
): string {
  const label = labelAsStateKey(m.label);
  if (m.kind !== ModuleKind.Input) {
    return lang === "ts" ? `  spine = await ${fn}(spine!, state);` : `    spine = await ${fn}(spine, state)`;
  }
  if (singleInput) {
    return lang === "ts" ? `  spine = await ${fn}(initialInput, state);` : `    spine = await ${fn}(initial_input, state)`;
  }
  const key = lang === "ts" ? JSON.stringify(label) : JSON.stringify(label);
  return lang === "ts"
    ? `  spine = await ${fn}(inputs[${key}], state);`
    : `    spine = await ${fn}(inputs[${key}], state)`;
}

export function generateOrchestratorTs(project: Project, stepFnName: (m: PipelineModule, i: number) => string): string {
  const inputMods = orchestratorInputMods(project);
  const multi = inputMods.length > 1;
  const lines: string[] = [];

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

  lines.push("  const state: PipelineState = {};", "  let spine: unknown;", "");

  for (let i = 0; i < project.modules.length; i++) {
    const m = project.modules[i]!;
    const fn = stepFnName(m, i);
    const label = labelAsStateKey(m.label);
    lines.push(`  // ${i + 1}. ${m.label}`);
    lines.push(orchestratorInvokeLine(m, fn, "ts", !multi));
    if (label) lines.push(`  state[${JSON.stringify(label)}] = spine;`);
    lines.push("");
  }

  lines.push("  return spine;", "}", "");
  return lines.join("\n");
}

export function generateOrchestratorPy(project: Project, stepFnName: (m: PipelineModule, i: number) => string): string {
  const inputMods = orchestratorInputMods(project);
  const multi = inputMods.length > 1;
  const lines: string[] = [];

  if (multi) {
    lines.push("async def run_pipeline(inputs: dict[str, Document]) -> Any:");
  } else {
    lines.push("async def run_pipeline(initial_input: Document) -> Any:");
  }

  lines.push("    state: PipelineState = {}", "    spine: Any = None", "");

  for (let i = 0; i < project.modules.length; i++) {
    const m = project.modules[i]!;
    const fn = stepFnName(m, i);
    const label = labelAsStateKey(m.label);
    lines.push(`    # ${i + 1}. ${m.label}`);
    lines.push(orchestratorInvokeLine(m, fn, "py", !multi));
    if (label) lines.push(`    state[${JSON.stringify(label)}] = spine`);
    lines.push("");
  }

  lines.push("    return spine", "");
  return lines.join("\n");
}

export { tsCustomCodeCall, pyCustomCodeCall };

// AI : block exports that reference runtime secrets or env wiring.
// AI : TODO export — add generatePipelineSourceRust alongside TS/Py.
// AI : TODO export — optional Supabase hooks in orchestrator (persist run metadata + per-step spine snapshots).
// AI : TODO export — emit cache lookup/store around LLM steps when module.cached or runtime.enableCache is set.
const ENV_ACCESS_PATTERNS: RegExp[] = [
  /\bprocess\.env\b/,
  /\bprocess\[["']env["']\]/,
  /\bos\.environ\b/,
  /\bos\.getenv\s*\(/,
  /\bgetenv\s*\(/,
  /\bDeno\.env\b/,
  /\bimport\.meta\.env\b/,
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
