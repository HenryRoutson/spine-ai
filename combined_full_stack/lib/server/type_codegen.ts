import { allModelsToPydantic, allModelsToDts } from "./pydantic";
import {
  pipelineStatePyTypedDict,
  pipelineStateFields,
  labelAsStateKey,
  pipelineStateTsInterface,
} from "./pipeline_state";
import type { Project, PipelineModule } from "./types";
import {
  formatTypeExpr,
  labelToPyKey,
  stepSpineInType,
  stepSpineOutType,
  typeExprToPy,
  typeExprToTs,
} from "./type_expr";

export type GeneratedPipelineTypes = {
  modelsPy: string;
  modelsDts: string;
  pipelinePy: string;
  pipelineDts: string;
};

export function generateModelsDts(
  models: Project["models"],
  typeAliases: Project["typeAliases"] = [],
): string {
  return allModelsToDts(models, typeAliases ?? []);
}

function stepFunctionName(m: PipelineModule, index: number): string {
  const key = labelToPyKey(m.label);
  return key !== "_empty" ? `step_${key}` : `step_${index}`;
}

export function generatePipelineTypes(project: Project): GeneratedPipelineTypes {
  const typeAliases = project.typeAliases ?? [];
  const modelsPy = allModelsToPydantic(project.models, typeAliases);
  const modelsDts = generateModelsDts(project.models, typeAliases);
  const statePy = pipelineStatePyTypedDict(project);

  const pySteps: string[] = [];
  const dtsSteps: string[] = [];
  const dtsFns: string[] = [];

  for (let i = 0; i < project.modules.length; i++) {
    const m = project.modules[i]!;
    const fn = stepFunctionName(m, i);
    const inType = stepSpineInType(m);
    const outType = stepSpineOutType(m);
    const inPy = inType ? typeExprToPy(inType, project.models) : "Any";
    const outPy = outType ? typeExprToPy(outType, project.models) : "Any";
    const inTs = inType ? typeExprToTs(inType, project.models) : "unknown";
    const outTs = outType ? typeExprToTs(outType, project.models) : "unknown";

    pySteps.push(
      [
        `# module: ${m.id} · kind: ${m.kind} · label: ${JSON.stringify(m.label)}`,
        `def ${fn}(input: ${inPy}, state: PipelineState) -> ${outPy}:`,
        `    """${m.note ?? m.label}"""`,
        "    ...",
        "",
      ].join("\n"),
    );

    dtsFns.push(
      `/** ${m.note ?? m.label} · ${m.kind} */`,
      `export declare function ${fn}(input: ${inTs}, state: PipelineState): ${outTs};`,
      "",
    );

    dtsSteps.push(`  ${JSON.stringify(labelAsStateKey(m.label))}: ${outTs};`);
  }

  const pipelinePy = [
    "from __future__ import annotations",
    "from typing import Any",
    "from typing_extensions import TypedDict",
    "",
    "# generated pipeline step signatures — run pyright on this file to typecheck wiring.",
    statePy,
    "",
    ...pySteps,
  ].join("\n");

  const pipelineDts = [
    "// generated pipeline step signatures — run tsc to typecheck wiring.",
    'import type { Document, FileInput, Quote, TextQuote } from "./models";',
    "",
    pipelineStateTsInterface(project),
    "",
    ...dtsFns,
    "export type StepOutputs = {",
    ...dtsSteps.map((l) => l),
    "};",
    "",
  ].join("\n");

  return { modelsPy, modelsDts, pipelinePy, pipelineDts };
}

export function formatPipelineTypeSummary(project: Project): string {
  const lines: string[] = [];
  for (const field of pipelineStateFields(project)) {
    lines.push(`  ${field.label}: ${field.type ? formatTypeExpr(field.type, project.models) : "?"}`);
  }
  return lines.join("\n");
}
