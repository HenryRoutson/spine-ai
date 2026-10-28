import { allModelsToPydantic } from "./pydantic";
import { flattenPipelineModules } from "@/lib/fork-pipeline";
import { emitStepBody } from "./pipeline_export_dispatch";
import {
  exportFileMetaComments,
  exportSectionComment,
  indentExportBlock,
  stepBodyUsesPipelineState,
  stepBodyUsesInput,
  stepFnNameFromLabel,
  withExportLineCountMeta,
  exportSpineInPy,
  exportSpineOutPy,
  generateOrchestratorPy,
  pipelineStatePyTypedDictForExport,
  prepareExportProject,
} from "./pipeline_export_shared";
import { analyzeExportRuntimeNeeds } from "./pipeline_export_setup";
import { exportRuntimeImportPy } from "./pipeline_export_runtime_lib";
import { MODULE_META, ModuleKind } from "./types";
import type { PipelineModule, Project } from "./types";

// AI : TODO (linter-first) — exported .py is the lint target (pyright on full pipeline export + user custom code).
// AI : TODO (arch-export-file) — generatePipelineSource* assemble the same sections; one assembler + lang adapters.

const C = "#" as const;

function generateStepFn(m: PipelineModule, project: Project, index: number): string {
  const fn = stepFnNameFromLabel(m, index);
  const inPy = exportSpineInPy(m, project, index);
  const outPy = exportSpineOutPy(m, project, index);
  const meta = MODULE_META[m.kind];
  const body = emitStepBody("py", { m, project, inType: inPy, outType: outPy });
  const stateParam = stepBodyUsesPipelineState(C, body, m) ? "state" : "_state";
  const inputParam = stepBodyUsesInput(C, body) ? "input" : "_input";
  const docLines = [
    m.label,
    `Kind: ${meta.label}`,
    ...(m.note ? [m.note] : []),
    ...(m.model ? [`Model: ${m.model}`] : []),
    ...(m.cached ? ["Cached: true"] : []),
  ];
  const header = [
    `async def ${fn}(${inputParam}: ${inPy}, ${stateParam}: PipelineState) -> ${outPy}:`,
    `    """${docLines.join(" · ").replace(/"""/g, "''")}"""`,
  ];
  return [...header, indentExportBlock(body, 4), "", ""].join("\n");
}

// AI : single-file Python export — models + step bodies + orchestrator for LOC comparison.
export function generatePipelineSourcePy(project: Project): string {
  const prepared = prepareExportProject(project);
  const needs = analyzeExportRuntimeNeeds(prepared);
  const runtimeImport = exportRuntimeImportPy({
    ...needs,
    llmBatch: flattenPipelineModules(prepared.modules).some((m) => m.kind === ModuleKind.LlmBatch),
  });
  const sections: string[] = [];
  const flat = flattenPipelineModules(prepared.modules);
  const stepFns = flat.map((m, i) => generateStepFn(m, prepared, i)).join("\n");
  const orchestrator = generateOrchestratorPy(prepared, stepFnNameFromLabel);

  sections.push(
    '"""Generated pipeline export — models, steps, orchestrator (runtime: pipeline_runtime.py)"""',
    ...exportFileMetaComments(C, prepared),
    "",
    "from __future__ import annotations",
    "",
    "import json",
    "import asyncio",
    "from typing import Any, TypedDict, cast",
    "",
    "from pydantic import BaseModel, Field",
    "",
    runtimeImport,
    "",
    exportSectionComment(C, "structures"),
    allModelsToPydantic(prepared.models, prepared.typeAliases ?? [], { includeImports: false }),
    "",
    exportSectionComment(C, "pipeline state"),
    pipelineStatePyTypedDictForExport(prepared),
    "",
    exportSectionComment(C, "steps"),
    stepFns,
    exportSectionComment(C, "orchestrator"),
    orchestrator,
  );

  return withExportLineCountMeta(sections.join("\n"), prepared, "#");
}

export { assertNoEnvKeysInExport, findEnvLeaksInExport } from "./pipeline_export_shared";
