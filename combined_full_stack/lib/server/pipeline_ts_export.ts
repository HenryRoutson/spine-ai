import { generateModelsDts } from "./type_codegen";
import { emitStepBody } from "./pipeline_export_dispatch";
import {
  exportFileMetaComments,
  exportSectionComment,
  indentExportBlock,
  stepBodyUsesPipelineState,
  stepFnNameFromLabel,
  withExportLineCountMeta,
  exportSpineInTs,
  exportSpineOutTs,
  generateOrchestratorTs,
  pipelineStateTsInterfaceForExport,
  prepareExportProject,
} from "./pipeline_export_shared";
import { analyzeExportRuntimeNeeds } from "./pipeline_export_setup";
import { exportRuntimeImportTs } from "./pipeline_export_runtime_lib";
import { MODULE_META, ModuleKind } from "./types";
import { flattenPipelineModules } from "@/lib/fork-pipeline";
import type { PipelineModule, Project } from "./types";

// AI : TODO export — emit only pipeline-referenced structures, not every project model.
// AI : TODO (arch-export-file) — generatePipelineSource* assemble the same sections (models, state, steps, orch).

const C = "//" as const;

function generateStepFn(m: PipelineModule, project: Project, index: number): string {
  const fn = stepFnNameFromLabel(m, index);
  const inTs = exportSpineInTs(m, project, index);
  const outTs = exportSpineOutTs(m, project, index);
  const meta = MODULE_META[m.kind];
  const body = emitStepBody("ts", { m, project, inType: inTs, outType: outTs });
  const stateParam = stepBodyUsesPipelineState(C, body, m) ? "state" : "_state";
  const header = [
    `/**`,
    ` * ${m.label.replace(/\*\//g, "*\\/")}`,
    ` * @kind ${meta.label}`,
    ...(m.note ? [` * ${m.note.replace(/\*\//g, "*\\/")}`] : []),
    ...(m.model ? [` * @model ${m.model}`] : []),
    ...(m.cached ? [` * @cached true`] : []),
    ` */`,
    `async function ${fn}(input: ${inTs}, ${stateParam}: PipelineState): Promise<${outTs}> {`,
  ];
  return [...header, indentExportBlock(body, 2), "}", ""].join("\n");
}

// AI : pipeline file is types + steps + orchestrator; runtime lives in pipeline_runtime.ts (copied, not generated).
export function generatePipelineSourceTs(project: Project): string {
  const prepared = prepareExportProject(project);
  const needs = analyzeExportRuntimeNeeds(prepared);
  const runtimeImport = exportRuntimeImportTs({
    ...needs,
    llmBatch: prepared.modules.some((m) => m.kind === ModuleKind.LlmBatch),
  });
  const sections: string[] = [];
  const flat = flattenPipelineModules(prepared.modules);
  const stepFns = flat.map((m, i) => generateStepFn(m, prepared, i)).join("\n");
  const orchestrator = generateOrchestratorTs(prepared, stepFnNameFromLabel);

  sections.push(
    "// Generated pipeline export — types, steps, orchestrator (runtime: ./pipeline_runtime)",
    ...exportFileMetaComments(C, prepared),
    "",
    runtimeImport,
    "",
    exportSectionComment(C, "structures"),
    generateModelsDts(prepared.models, prepared.typeAliases ?? []),
    "",
    exportSectionComment(C, "pipeline state"),
    pipelineStateTsInterfaceForExport(prepared),
    "",
    exportSectionComment(C, "steps"),
    stepFns,
    exportSectionComment(C, "orchestrator"),
    orchestrator,
  );

  return withExportLineCountMeta(sections.join("\n"), prepared, "//");
}

export { assertNoEnvKeysInExport, findEnvLeaksInExport } from "./pipeline_export_shared";
