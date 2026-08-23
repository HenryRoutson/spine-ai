// AI : Human-readable error and warning messages for pipeline validation issues.
import { ModuleKind, type PipelineModule, type StructureModel } from "./types";
import {
  InvalidKind,
  PipelineWarningKind,
  type InvalidStep,
  type PipelineWarning,
  modelName,
} from "./validity-types";

export function invalidStepMessage(
  issue: InvalidStep,
  models: StructureModel[],
  modules: PipelineModule[],
): string {
  if (issue.kind === InvalidKind.NoOutput) {
    const m = modules.find((x) => x.id === issue.moduleId);
    if (m?.kind === ModuleKind.Output) return "select a structure to materialize";
    if (m?.kind === ModuleKind.Assert) return "select passthrough structure";
    if (m?.kind === ModuleKind.HumanReview) return "select passthrough structure for review";
    return "select an output model";
  }
  if (issue.kind === InvalidKind.IoMismatch) {
    const m = modules.find((x) => x.id === issue.moduleId);
    const expected = issue.expectsType ?? modelName(models, issue.expects);
    if (m?.kind === ModuleKind.Combine && issue.expects) {
      if (!issue.upstreamEmits) {
        return `pipeline state has no ${expected ?? "structure"} — no upstream step has emitted this structure`;
      }
      const upstream = issue.upstreamType ?? modelName(models, issue.upstreamEmits) ?? "?";
      return `pipeline state expects ${expected}, spine carries ${upstream}`;
    }
    const upstream = issue.upstreamType ?? modelName(models, issue.upstreamEmits) ?? "?";
    return `input expects ${expected ?? "?"}, upstream emits ${upstream}`;
  }
  if (issue.kind === InvalidKind.CardinalityMismatch) {
    return `input expects ${issue.expectsType ?? "?"}, upstream emits ${issue.upstreamType ?? "?"}`;
  }
  if (issue.kind === InvalidKind.StateKeyMissing) {
    return `references unknown step label "${issue.missingLabel ?? "?"}" — no prior step has this label`;
  }
  if (issue.kind === InvalidKind.TransformListWrap) {
    const m = modules.find((x) => x.id === issue.moduleId);
    const inName = modelName(models, issue.expects) ?? "item";
    const outName = modelName(models, issue.upstreamEmits) ?? "output";
    return `list[${inName}] → ${outName} needs a list field (prefer list[model] ref ${inName}) or custom TS code`;
  }
  if (issue.kind === InvalidKind.EmptyLabel) {
    return "step label is required — labels key the accumulated pipeline state";
  }
  if (issue.kind === InvalidKind.DuplicateLabel) {
    const step = modules.find((x) => x.id === issue.moduleId);
    return `duplicate label "${step?.label ?? "?"}" — each step label must be unique`;
  }
  if (issue.kind === InvalidKind.UnusedOutput) {
    const name = modelName(models, issue.expects) ?? "output";
    return `${name} is never consumed by a downstream step`;
  }
  if (issue.kind === InvalidKind.DuplicateInputStruct) {
    const name = modelName(models, issue.expects) ?? "structure";
    return `multiple input steps emit ${name} — use distinct structures or a combine step`;
  }
  if (issue.kind === InvalidKind.DuplicateOutputStruct) {
    const m = modules.find((x) => x.id === issue.moduleId);
    const name = modelName(models, m?.inStructureId) ?? "structure";
    return `multiple output steps materialize ${name}`;
  }
  if (issue.kind === InvalidKind.MissingInputDescription) {
    return "input description is required — describe what data this step expects";
  }
  if (issue.kind === InvalidKind.MissingNote) {
    return "annotation / purpose is required — describe what this step does or handles";
  }
  if (issue.kind === InvalidKind.MissingStructure) {
    const name = modelName(models, issue.expects) ?? issue.expects ?? "structure";
    return `references missing structure "${name}" — restore the model or rewire this step`;
  }
  if (issue.kind === InvalidKind.CodeCompileError) {
    return issue.compileError ?? "code does not compile";
  }
  if (issue.kind === InvalidKind.JsonInputMismatch) {
    return "Excel/JSON-only inputs must use a structure — direct JSON parse is available for these types";
  }
  if (issue.kind === InvalidKind.StructureField) {
    return issue.structureMessage ?? "structure field error";
  }
  if (issue.kind === InvalidKind.MissingCombineBeforeInput) {
    return "prior pipeline state is dropped on the spine — use input → … → combine (side input immediately before combine) or assemble (zip two parsed outputs), not input → code → input";
  }
  if (issue.kind === InvalidKind.MissingWebhookUrl) {
    return "set a webhook URL (HTTPS or env:VAR)";
  }
  if (issue.kind === InvalidKind.MissingN8nNodeType) {
    return "pick an n8n piece (Set, Filter, CSV, …) — list_pieces names them";
  }
  return "invalid step";
}

export function warningStepMessage(
  issue: PipelineWarning,
  models: StructureModel[],
  modules: PipelineModule[],
): string {
  if (issue.kind === PipelineWarningKind.NoPrompt) return "no prompt — schema-only call at runtime";
  if (issue.kind === PipelineWarningKind.JsonInputType) return "JSON file type is not typed — set I/O model to a structure";
  if (issue.kind === PipelineWarningKind.QuoteNoFields) return "output model has no quote fields";
  if (issue.kind === PipelineWarningKind.PromptQuoteMismatch) {
    return issue.detail ?? "prompt asks to quote a field that is not a quote type";
  }
  if (issue.kind === PipelineWarningKind.TransformMultiList) {
    const m = modules.find((x) => x.id === issue.moduleId);
    const name = modelName(models, m?.outStructureId) ?? "output";
    return `upstream list → ${name} only auto-unwraps one item — add a list field or custom TS if batch size may exceed 1`;
  }
  if (issue.kind === PipelineWarningKind.UnusedModel) {
    return issue.detail ?? "structure is never used by any step";
  }
  if (issue.kind === PipelineWarningKind.PromptListVsItem) {
    return issue.detail ?? "prompt asks for a list of rows but this step emits one object per input — use a wrapper + flatten";
  }
  return "warning";
}

export function warningStepMessages(
  issues: PipelineWarning[] | undefined,
  models: StructureModel[],
  modules: PipelineModule[],
): string[] {
  return (issues ?? []).map((issue) => warningStepMessage(issue, models, modules));
}

