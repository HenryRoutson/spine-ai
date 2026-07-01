// AI : Human-readable error and warning messages for pipeline validation issues.
import type { PipelineModule, StructureModel } from "./types";
import {
  type InvalidStep,
  type PipelineWarning,
  modelName,
} from "./validity-types";

export function invalidStepMessage(
  issue: InvalidStep,
  models: StructureModel[],
  modules: PipelineModule[],
): string {
  if (issue.kind === "no-output") {
    const m = modules.find((x) => x.id === issue.moduleId);
    if (m?.kind === "output") return "select a structure to materialize";
    if (m?.kind === "assert") return "select passthrough structure";
    if (m?.kind === "human-review") return "select passthrough structure for review";
    return "select an output model";
  }
  if (issue.kind === "io-mismatch") {
    const m = modules.find((x) => x.id === issue.moduleId);
    const expected = issue.expectsType ?? modelName(models, issue.expects);
    if (m?.kind === "combine" && issue.expects) {
      if (!issue.upstreamEmits) {
        return `pipeline state has no ${expected ?? "structure"} — no upstream step has emitted this structure`;
      }
      const upstream = issue.upstreamType ?? modelName(models, issue.upstreamEmits) ?? "?";
      return `pipeline state expects ${expected}, spine carries ${upstream}`;
    }
    const upstream = issue.upstreamType ?? modelName(models, issue.upstreamEmits) ?? "?";
    return `input expects ${expected ?? "?"}, upstream emits ${upstream}`;
  }
  if (issue.kind === "cardinality-mismatch") {
    return `input expects ${issue.expectsType ?? "?"}, upstream emits ${issue.upstreamType ?? "?"}`;
  }
  if (issue.kind === "state-key-missing") {
    return `references unknown step label "${issue.missingLabel ?? "?"}" — no prior step has this label`;
  }
  if (issue.kind === "transform-list-wrap") {
    const m = modules.find((x) => x.id === issue.moduleId);
    const inName = modelName(models, issue.expects) ?? "item";
    const outName = modelName(models, issue.upstreamEmits) ?? "output";
    return `list[${inName}] → ${outName} needs a list field (prefer list[model] ref ${inName}) or custom TS code`;
  }
  if (issue.kind === "empty-label") {
    return "step label is required — labels key the accumulated pipeline state";
  }
  if (issue.kind === "duplicate-label") {
    const step = modules.find((x) => x.id === issue.moduleId);
    return `duplicate label "${step?.label ?? "?"}" — each step label must be unique`;
  }
  if (issue.kind === "unused-output") {
    const name = modelName(models, issue.expects) ?? "output";
    return `${name} is never consumed by a downstream step`;
  }
  if (issue.kind === "duplicate-input-struct") {
    const name = modelName(models, issue.expects) ?? "structure";
    return `multiple input steps emit ${name} — use distinct structures or a combine step`;
  }
  if (issue.kind === "duplicate-output-struct") {
    const m = modules.find((x) => x.id === issue.moduleId);
    const name = modelName(models, m?.inStructureId) ?? "structure";
    return `multiple output steps materialize ${name}`;
  }
  if (issue.kind === "missing-input-description") {
    return "input description is required — describe what data this step expects";
  }
  if (issue.kind === "missing-note") {
    return "annotation / purpose is required — describe what this step does or handles";
  }
  if (issue.kind === "missing-structure") {
    const name = modelName(models, issue.expects) ?? issue.expects ?? "structure";
    return `references missing structure "${name}" — restore the model or rewire this step`;
  }
  if (issue.kind === "code-compile-error") {
    return issue.compileError ?? "code does not compile";
  }
  if (issue.kind === "json-input-mismatch") {
    return "JSON input must use a JSON structure, not the built-in Document model";
  }
  return "invalid step";
}

export function warningStepMessage(
  issue: PipelineWarning,
  models: StructureModel[],
  modules: PipelineModule[],
): string {
  if (issue.kind === "no-prompt") return "no prompt — schema-only call at runtime";
  if (issue.kind === "json-input-type") return "JSON file type is not typed — set I/O model to a structure";
  if (issue.kind === "quote-no-fields") return "output model has no quote fields";
  if (issue.kind === "transform-multi-list") {
    const m = modules.find((x) => x.id === issue.moduleId);
    const name = modelName(models, m?.outStructureId) ?? "output";
    return `upstream list → ${name} only auto-unwraps one item — add a list field or custom TS if batch size may exceed 1`;
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

