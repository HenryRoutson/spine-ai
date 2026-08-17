import { allModelsToGo } from "./pydantic";
import { emitStepBody } from "./pipeline_export_dispatch";
import {
  exportFileMetaComments,
  exportSectionComment,
  indentExportBlock,
  makeUniqueStepFnName,
  stepBodyUsesPipelineState,
  withExportLineCountMeta,
  exportSpineInGo,
  exportSpineOutGo,
  generateOrchestratorGo,
  prepareExportProject,
} from "./pipeline_export_shared";
import { analyzeExportRuntimeNeeds, type ExportRuntimeNeeds } from "./pipeline_export_setup";
import { pipelineStateGoType } from "./pipeline_state";
import { MODULE_META, ModuleKind } from "./types";
import type { PipelineModule, Project } from "./types";

// AI : TODO (arch-export-file) — generatePipelineSource* assemble the same sections; one assembler + lang adapters.

const C = "//" as const;

function goImports(needs: ExportRuntimeNeeds, project: Project): string {
  const pkgs = new Set<string>(["encoding/json"]);
  const needsFmt =
    needs.llm ||
    needs.llmBatch ||
    needs.visionOcr ||
    needs.docToText ||
    needs.quote ||
    needs.humanReview ||
    needs.exampleSelect ||
    project.modules.some((m) => m.kind === ModuleKind.Combine);
  if (needsFmt) pkgs.add("fmt");
  const sorted = [...pkgs].sort();
  return ["import (", ...sorted.map((p) => `\t"${p}"`), ")"].join("\n");
}

// AI : indentExportBlock uses spaces — convert leading spaces to tabs for idiomatic Go.
function indentGoBlock(code: string): string {
  return code
    .split("\n")
    .map((line) => {
      const m = /^( +)/.exec(line);
      if (!m) return line;
      const tabs = "\t".repeat(Math.ceil(m[1]!.length / 4) || 1);
      return tabs + line.slice(m[1]!.length);
    })
    .join("\n");
}

function generateStepFnGo(
  m: PipelineModule,
  project: Project,
  index: number,
  stepFnName: (m: PipelineModule, index: number) => string,
): string {
  const fn = stepFnName(m, index);
  const inGo = exportSpineInGo(m, project, index);
  const outGo = exportSpineOutGo(m, project, index);
  const meta = MODULE_META[m.kind];
  const body = emitStepBody("go", { m, project, inType: inGo, outType: outGo });
  const stateParam = stepBodyUsesPipelineState(C, body, m) ? "state" : "_state";
  const docLines = [
    `// ${m.label.replace(/\*\//g, "*\\/")}`,
    `// Kind: ${meta.label}`,
    ...(m.note ? [`// ${m.note.replace(/\*\//g, "*\\/")}`] : []),
    ...(m.model ? [`// Model: ${m.model}`] : []),
    ...(m.cached ? [`// Cached: true`] : []),
  ];
  return [
    ...docLines,
    `func ${fn}(input ${inGo}, ${stateParam} PipelineState) (${outGo}, error) {`,
    indentGoBlock(indentExportBlock(body, 4)),
    "}",
    "",
  ].join("\n");
}

// AI : single-file Go export — structs + step bodies + orchestrator for LOC comparison.
export function generatePipelineSourceGo(project: Project): string {
  const prepared = prepareExportProject(project);
  const needs = analyzeExportRuntimeNeeds(prepared);
  const sections: string[] = [];
  const stepFnName = makeUniqueStepFnName();
  const stepFns = prepared.modules.map((m, i) => generateStepFnGo(m, prepared, i, stepFnName)).join("\n");
  const orchestrator = generateOrchestratorGo(prepared, stepFnName);

  sections.push(
    "// Generated pipeline export — equivalent Go representation",
    ...exportFileMetaComments(C, prepared, ["Stdlib: encoding/json, net/http (see README.md)"]),
    "",
    "package pipeline",
    "",
    goImports(needs, prepared),
    "",
    exportSectionComment(C, "structures"),
    allModelsToGo(prepared.models, prepared.typeAliases ?? []),
    "",
    exportSectionComment(C, "pipeline state"),
    pipelineStateGoType(prepared),
    "",
    exportSectionComment(C, "steps"),
    stepFns,
    exportSectionComment(C, "orchestrator"),
    orchestrator,
  );

  return withExportLineCountMeta(sections.join("\n"), prepared, "//");
}

export { assertNoEnvKeysInExport, findEnvLeaksInExport } from "./pipeline_export_shared";
