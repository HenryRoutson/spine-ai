import { allModelsToBaml } from "./pydantic";
import { providerModelFor } from "./model_catalog";
import {
  exportStringLiteral,
  makeUniqueStepFnName,
  modelName,
  prepareExportProject,
  withExportLineCountMeta,
  exportSpineInType,
  exportSpineOutType,
} from "./pipeline_export_shared";
import { analyzeExportRuntimeNeeds } from "./pipeline_export_setup";
import { typeExprToBaml } from "./type_expr";
import { DEFAULT_MODEL, MODULE_META } from "./types";
import type { PipelineModule, Project } from "./types";

// AI : BAML function names must start with a capital letter.
function bamlFnName(raw: string, index: number): string {
  const parts = raw
    .replace(/^step_/, "")
    .split(/_+/g)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
  const base = parts.join("") || `Step${index}`;
  return /^[A-Z]/.test(base) ? base : `Step${base}`;
}

function providerModelSlug(model: string | undefined): string {
  return providerModelFor(model ?? DEFAULT_MODEL);
}

function clientNameForModel(model: string | undefined, used: Set<string>): string {
  const slug = providerModelSlug(model);
  const raw = slug
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .split("_")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
  let name = raw ? `OpenRouter${raw}` : "OpenRouterDefault";
  if (!/^[A-Z]/.test(name)) name = `Client${name}`;
  let out = name;
  let n = 2;
  while (used.has(out)) {
    out = `${name}${n}`;
    n += 1;
  }
  used.add(out);
  return out;
}

function spineTypeBaml(m: PipelineModule, project: Project, index: number, which: "in" | "out"): string {
  const t = which === "in" ? exportSpineInType(m, project, index) : exportSpineOutType(m, project, index);
  return t ? typeExprToBaml(t, project.models) : "string";
}

function escapeBamlBlock(s: string): string {
  // AI : avoid closing the #" ... "# prompt fence early.
  return s.replace(/"#/g, "'#");
}

function generateLlmFunction(
  m: PipelineModule,
  project: Project,
  index: number,
  fnName: string,
  clientName: string,
  batch: boolean,
): string {
  const inType = spineTypeBaml(m, project, index, "in");
  let outType = spineTypeBaml(m, project, index, "out");
  // AI : batch steps return a list — BAML function is per-item; host calls .batch().
  if (batch && outType.endsWith("[]")) outType = outType.slice(0, -2);
  const prompt = escapeBamlBlock(m.prompt ?? "Process the input.");
  const outName = modelName(project, m.outStructureId);
  const meta = MODULE_META[m.kind];
  const paramName = batch ? "item" : "input";
  const paramType = batch ? (inType.endsWith("[]") ? inType.slice(0, -2) : "string") : inType;
  return [
    `// ${m.label} · ${meta.label}${outName ? ` → ${outName}` : ""}${batch ? " (call via .batch on host)" : ""}`,
    ...(m.note ? [`// ${m.note}`] : []),
    `function ${fnName}(${paramName}: ${paramType}) -> ${outType} {`,
    `  client ${clientName}`,
    `  prompt #"`,
    `    ${prompt}`,
    ``,
    `    {{ _.role("user") }}`,
    `    {{ ${paramName} }}`,
    ``,
    `    {{ ctx.output_format }}`,
    `  "#`,
    `}`,
    "",
  ].join("\n");
}

function commentStep(m: PipelineModule, index: number, stepKey: string): string {
  const meta = MODULE_META[m.kind];
  return [
    `// --- step ${index}: ${m.label} (${meta.label}) — host language, not BAML ---`,
    `// wire in Python/TS via baml_client after non-LLM steps (${stepKey})`,
    ...(m.note ? [`// note: ${m.note}`] : []),
    "",
  ].join("\n");
}

// AI : BAML export — classes + OpenRouter clients + LLM functions (https://github.com/boundaryml/baml).
export function generatePipelineSourceBaml(project: Project): string {
  const prepared = prepareExportProject(project);
  const needs = analyzeExportRuntimeNeeds(prepared);
  const stepFnName = makeUniqueStepFnName();
  const clientUsed = new Set<string>();
  const clients: string[] = [];
  const clientByModel = new Map<string, string>();
  const functions: string[] = [];
  const otherSteps: string[] = [];

  if (needs.llm || needs.llmBatch) {
    for (const m of prepared.modules) {
      if (m.kind !== "llm" && m.kind !== "llm-batch") continue;
      const slug = providerModelSlug(m.model);
      if (clientByModel.has(slug)) continue;
      const name = clientNameForModel(m.model, clientUsed);
      clientByModel.set(slug, name);
      clients.push(
        [
          `client<llm> ${name} {`,
          `  provider openrouter`,
          `  options {`,
          `    model ${exportStringLiteral(slug)}`,
          `    // api_key from env.OPENROUTER_API_KEY`,
          `  }`,
          `}`,
          "",
        ].join("\n"),
      );
    }
    if (!clients.length) {
      const name = clientNameForModel(undefined, clientUsed);
      clientByModel.set(providerModelSlug(undefined), name);
      clients.push(
        [
          `client<llm> ${name} {`,
          `  provider openrouter`,
          `  options {`,
            `    model ${exportStringLiteral(providerModelSlug(undefined))}`,
          `  }`,
          `}`,
          "",
        ].join("\n"),
      );
    }
  }

  prepared.modules.forEach((m, i) => {
    const key = stepFnName(m, i);
    const fn = bamlFnName(key, i);
    if (m.kind === "llm" || m.kind === "llm-batch") {
      const slug = providerModelSlug(m.model);
      const client = clientByModel.get(slug) ?? [...clientByModel.values()][0] ?? "OpenRouterDefault";
      functions.push(generateLlmFunction(m, prepared, i, fn, client, m.kind === "llm-batch"));
    } else {
      otherSteps.push(commentStep(m, i, key));
    }
  });

  const sections: string[] = [
    "// Generated pipeline export — BAML (https://github.com/boundaryml/baml)",
    `// Project: ${prepared.name}`,
    `// ${prepared.modules.length} steps · ${prepared.models.length} structures`,
    "// Setup: copy .env.example → .env (OPENROUTER_API_KEY), then `baml generate`",
    "// Host: call generated baml_client from Python or TypeScript for orchestration.",
    "",
    "// === structures ===",
    allModelsToBaml(prepared.models, prepared.typeAliases ?? []),
    "",
  ];

  if (clients.length) {
    sections.push("// === LLM clients ===", ...clients);
  }

  if (functions.length) {
    sections.push("// === LLM steps ===", ...functions);
  }

  if (otherSteps.length) {
    sections.push("// === non-LLM steps (orchestrate in host language) ===", ...otherSteps);
  }

  return withExportLineCountMeta(sections.join("\n"), prepared, "//");
}

export { assertNoEnvKeysInExport, findEnvLeaksInExport } from "./pipeline_export_shared";
