import { allModelsToRust } from "./pydantic";
import { emitStepBody } from "./pipeline_export_dispatch";
import {
  exportFileMetaComments,
  exportSectionComment,
  indentExportBlock,
  makeUniqueStepFnName,
  stepBodyUsesPipelineState,
  withExportLineCountMeta,
  exportSpineInRust,
  exportSpineOutRust,
  generateOrchestratorRust,
  prepareExportProject,
} from "./pipeline_export_shared";
import { exportRuntimePreambleRust } from "./pipeline_export_runtime_lib";
import { pipelineStateRustType } from "./pipeline_state";
import { MODULE_META } from "./types";
import type { PipelineModule, Project } from "./types";

// AI : TODO (linter-first) — exported .rs is the lint target (cargo check on full pipeline export + user custom code).
// AI : TODO (arch-export-file) — generatePipelineSource* assemble the same sections; one assembler + lang adapters.

const C = "//" as const;

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
  const body = emitStepBody("rs", { m, project, inType: inRust, outType: outRust });
  const stateParam = stepBodyUsesPipelineState(C, body, m) ? "state" : "_state";
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
  const sections: string[] = [];
  const stepFnName = makeUniqueStepFnName();
  const stepFns = prepared.modules.map((m, i) => generateStepFn(m, prepared, i, stepFnName)).join("\n");
  const orchestrator = generateOrchestratorRust(prepared, stepFnName);

  sections.push(
    "// Generated pipeline export — equivalent Rust representation",
    ...exportFileMetaComments(C, prepared, ["Cargo: serde, serde_json, tokio, reqwest, anyhow (see README.md)"]),
    "",
    exportRuntimePreambleRust(),
    exportSectionComment(C, "structures"),
    allModelsToRust(prepared.models, prepared.typeAliases ?? []),
    "",
    exportSectionComment(C, "pipeline state"),
    pipelineStateRustType(prepared),
    "",
    exportSectionComment(C, "steps"),
    stepFns,
    exportSectionComment(C, "orchestrator"),
    orchestrator,
  );

  return withExportLineCountMeta(sections.join("\n"), prepared, "//");
}

export { assertNoEnvKeysInExport, findEnvLeaksInExport } from "./pipeline_export_shared";
