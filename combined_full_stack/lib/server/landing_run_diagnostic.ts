// AI : shared landing-run diagnostic — denormalized text + JSON so UI, DB, and dashboard can reconstruct.

import { customCodeEntriesForModule } from "@/lib/custom_code_entries";
import { formatModuleSpineIn, formatModuleSpineOut } from "@/lib/server/spine_types";
import { computeInvalid, formatInvalidMapErrors } from "@/lib/server/validity";
import type { DocRef, Project, PipelineRun } from "@/lib/server/types";

// AI : local shape — avoid importing landing_pipeline_run (circular with diagnostic consumers).
export type LandingDiagnosticExampleDoc = { ref: DocRef; content: string };

export type LandingRunDiagnosticJson = {
  kind: "landing_pipeline_run_error";
  version: 1;
  project: { id: string; name: string };
  counts: { modules: number; models: number; typeAliases: number; exampleDocs: number };
  exampleDocNames: string[];
  error: { message: string; stack?: string; name?: string };
  validationReport: string;
  modules: Array<{
    id: string;
    kind: string;
    label: string;
    inStructureId?: string;
    outStructureId?: string;
    outIsList?: boolean;
    spineIn: string;
    spineOut: string;
    inputType?: unknown;
    inputNameContains?: string;
    note?: string;
    prompt?: string;
    codeEntries?: Array<{ language: string; code: string }>;
  }>;
  models: Array<{
    id: string;
    name: string;
    fields: Array<{ name: string; type: string; ref?: string }>;
  }>;
  typeAliases: Array<{ id: string; name: string; expr: unknown }>;
  exampleDocuments: Array<{
    id: string;
    name: string;
    type: string;
    label: string;
    bytes: number;
    content: string;
  }>;
  // AI : denormalized run steps when we have a partial/failed PipelineRun.
  runSteps?: Array<{
    moduleId: string;
    kind: string;
    label: string;
    status: string;
    ms: number;
    outputPreview?: string;
    outputJson?: string;
  }>;
  pause?: {
    stepIndex: number;
    moduleId: string;
    label: string;
    kind: string;
    hasCode: boolean;
  };
};

export type LandingRunDiagnostic = {
  text: string;
  json: LandingRunDiagnosticJson;
  // AI : short line for dashboards / output_preview column.
  summary: string;
};

function captureErr(err: unknown): { message: string; stack?: string; name?: string } {
  if (err instanceof Error) return { message: err.message, stack: err.stack, name: err.name };
  return { message: String(err) };
}

export function buildLandingRunDiagnostic(opts: {
  err: unknown;
  project: Project;
  exampleDocs: LandingDiagnosticExampleDoc[];
  run?: PipelineRun | null;
  pause?: LandingRunDiagnosticJson["pause"];
  title?: string;
}): LandingRunDiagnostic {
  const { project, exampleDocs, run, pause } = opts;
  const captured = captureErr(opts.err);
  const models = project.models ?? [];
  const typeAliases = project.typeAliases ?? [];
  const invalid = computeInvalid(project.modules, models, { typeAliases });
  const validationReport = formatInvalidMapErrors(invalid, project.modules, models);

  const moduleRows = project.modules.map((m) => {
    const entries = customCodeEntriesForModule(m);
    return {
      id: m.id,
      kind: m.kind,
      label: m.label,
      inStructureId: m.inStructureId,
      outStructureId: m.outStructureId,
      outIsList: m.outIsList,
      spineIn: formatModuleSpineIn(m, models),
      spineOut: formatModuleSpineOut(m, models),
      inputType: m.inputType,
      inputNameContains: m.inputNameContains,
      note: m.note?.trim() || undefined,
      prompt: m.prompt?.trim() || undefined,
      codeEntries: entries.length
        ? entries.map((e) => ({ language: e.language, code: e.code }))
        : undefined,
    };
  });

  const modelRows = models.map((model) => ({
    id: model.id,
    name: model.name,
    fields: (model.fields ?? []).map((f) => ({
      name: f.name,
      type: String(f.type),
      ref: f.ref,
    })),
  }));

  const aliasRows = typeAliases.map((a) => ({
    id: a.id,
    name: a.name,
    expr: a.expr,
  }));

  const docRows = exampleDocs.map((d) => ({
    id: d.ref.id,
    name: d.ref.name,
    type: String(d.ref.type),
    label: String(d.ref.label),
    bytes: d.content.length,
    // AI : full example content — denormalized so DB can reconstruct the failing run.
    content: d.content,
  }));

  const runSteps = run?.steps.map((s) => ({
    moduleId: s.moduleId,
    kind: s.kind,
    label: s.label,
    status: s.status,
    ms: s.ms,
    outputPreview: s.outputPreview,
    outputJson: s.outputJson,
  }));

  const json: LandingRunDiagnosticJson = {
    kind: "landing_pipeline_run_error",
    version: 1,
    project: { id: project.id, name: project.name },
    counts: {
      modules: project.modules.length,
      models: models.length,
      typeAliases: typeAliases.length,
      exampleDocs: exampleDocs.length,
    },
    exampleDocNames: exampleDocs.map((d) => d.ref.name),
    error: captured,
    validationReport,
    modules: moduleRows,
    models: modelRows,
    typeAliases: aliasRows,
    exampleDocuments: docRows,
    runSteps,
    pause,
  };

  const title = opts.title ?? "=== Landing pipeline run error ===";
  const text = formatLandingRunDiagnosticText(json, title);
  return {
    text,
    json,
    summary: captured.message.slice(0, 240),
  };
}

export function formatLandingRunDiagnosticText(
  d: LandingRunDiagnosticJson,
  title = "=== Landing pipeline run error ===",
): string {
  const moduleLines = d.modules.map((m, i) => {
    const codeBlock =
      m.codeEntries?.length
        ? m.codeEntries
            .map(
              (e, j) =>
                `      code[${j}] (${e.language}):\n${e.code
                  .split("\n")
                  .map((line) => `        ${line}`)
                  .join("\n")}`,
            )
            .join("\n")
        : null;
    return [
      `  [${i}] id=${m.id} kind=${m.kind} label=${JSON.stringify(m.label)}`,
      `      inStructureId=${m.inStructureId ?? "—"} outStructureId=${m.outStructureId ?? "—"} outIsList=${m.outIsList ?? false}`,
      `      spineIn=${m.spineIn} spineOut=${m.spineOut}`,
      m.inputType != null ? `      inputType=${JSON.stringify(m.inputType)}` : null,
      m.inputNameContains ? `      inputNameContains=${JSON.stringify(m.inputNameContains)}` : null,
      m.note ? `      note=${JSON.stringify(m.note)}` : null,
      m.prompt ? `      prompt=${JSON.stringify(m.prompt)}` : null,
      codeBlock,
    ]
      .filter(Boolean)
      .join("\n");
  });

  const modelLines = d.models.map((model, i) => {
    const fields = model.fields.map((f) => `${f.name}:${f.type}${f.ref ? `→${f.ref}` : ""}`).join(", ");
    return `  [${i}] id=${model.id} name=${JSON.stringify(model.name)} fields=[${fields}]`;
  });

  const aliasLines = d.typeAliases.map(
    (a, i) => `  [${i}] id=${a.id} name=${JSON.stringify(a.name)} expr=${JSON.stringify(a.expr)}`,
  );

  const docLines = d.exampleDocuments.map((doc, i) => {
    const body = doc.content
      .split("\n")
      .map((line) => `        ${line}`)
      .join("\n");
    return [
      `  [${i}] id=${doc.id} name=${JSON.stringify(doc.name)} type=${doc.type} label=${doc.label} bytes=${doc.bytes}`,
      `      content:`,
      body,
    ].join("\n");
  });

  const stepLines =
    d.runSteps?.map(
      (s, i) =>
        `  [${i}] ${s.label} (${s.kind}) status=${s.status} ms=${s.ms}` +
        (s.outputPreview ? `\n      preview=${JSON.stringify(s.outputPreview)}` : "") +
        (s.outputJson ? `\n      outputJson=${s.outputJson}` : ""),
    ) ?? [];

  const sections = [
    title,
    `project: ${d.project.name} (${d.project.id})`,
    `modules: ${d.counts.modules} · models: ${d.counts.models} · typeAliases: ${d.counts.typeAliases}`,
    `exampleDocs: ${d.exampleDocNames.join(", ") || "(none)"}`,
    d.pause
      ? `pausedAt: step[${d.pause.stepIndex}] ${d.pause.label} (${d.pause.kind}) moduleId=${d.pause.moduleId} hasCode=${d.pause.hasCode}`
      : null,
    "",
    "--- error.message ---",
    d.error.message,
    d.error.stack ? `\n--- error.stack ---\n${d.error.stack}` : null,
    d.validationReport
      ? `\n--- validation report (recomputed) ---\n${d.validationReport}`
      : "\n--- validation report (recomputed) ---\n(none)",
    stepLines.length ? `\n--- run steps (partial) ---\n${stepLines.join("\n")}` : null,
    "",
    "--- modules ---",
    moduleLines.join("\n") || "(none)",
    "",
    "--- models ---",
    modelLines.join("\n") || "(none)",
    aliasLines.length ? `\n--- typeAliases ---\n${aliasLines.join("\n")}` : null,
    "",
    "--- example documents ---",
    docLines.join("\n") || "(none)",
  ];

  return sections.filter((s) => s !== null).join("\n");
}
