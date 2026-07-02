import { allModelsToPydantic } from "./pydantic";
import {
  pipelineStatePyTypedDict,
  pipelineStateFields,
  labelAsStateKey,
  pipelineStateTsInterface,
} from "./pipeline_state";
import type { Project, PipelineModule, StructureModel } from "./types";
import { fieldTypeToExpr } from "./type_expr";
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

function modelToDts(model: StructureModel, models: StructureModel[]): string {
  const lines = model.fields
    .filter((f) => f.name.trim())
    .map((f) => {
      let t = typeExprToTs(fieldTypeToExpr(f), models);
      if (f.optional) t = `${t} | undefined`;
      return `  ${f.name}: ${t};`;
    });
  return `export type ${model.name} = {\n${lines.join("\n")}\n};`;
}

export function generateModelsDts(models: StructureModel[]): string {
  const header = [
    "export type Quote = { doc_id: string; start: number; end: number };",
    "export type TextQuote = { text: string; quote: Quote };",
    "export type Document = { content: string; filename: string };",
    "export type FileInput = Document;",
    "",
  ].join("\n");
  const user = models.map((m) => modelToDts(m, models)).join("\n\n");
  return `${header}${user}\n`;
}

function stepFunctionName(m: PipelineModule, index: number): string {
  const key = labelToPyKey(m.label);
  return key !== "_empty" ? `step_${key}` : `step_${index}`;
}

export function generatePipelineTypes(project: Project): GeneratedPipelineTypes {
  const modelsPy = allModelsToPydantic(project.models);
  const modelsDts = generateModelsDts(project.models);
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
