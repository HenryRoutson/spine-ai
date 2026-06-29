// AI : IO-mismatch inspector — one-click fix hints and connector highlight logic for the pipeline canvas.
import type { ModuleId, PipelineModule, StructureModel } from "./types";
import {
  type InvalidStep,
  type InvalidMap,
  type InvalidKind,
  type IoMismatchFixKind,
  type IoMismatchFixHint,
  type IoMismatchInspectorFix,
  invalidForModule,
  modelName,
  prevModuleId,
} from "./validity-types";
import { invalidStepMessage } from "./validity-messages";

export type { IoMismatchFixKind, IoMismatchFixHint, IoMismatchInspectorFix };
export { prevModuleId };

function isSpineMismatchKind(kind: InvalidKind): boolean {
  return kind === "io-mismatch" || kind === "cardinality-mismatch";
}

// AI : when step input expects X but upstream emits Y — two one-click alignments.
export function ioMismatchFixHints(
  issue: InvalidStep,
  models: StructureModel[],
): IoMismatchFixHint[] | undefined {
  if (issue.kind !== "io-mismatch" || !issue.expects || !issue.upstreamEmits) return undefined;
  const expected = modelName(models, issue.expects);
  const upstream = modelName(models, issue.upstreamEmits);
  if (!expected || !upstream || expected === upstream) return undefined;
  return [
    { kind: "adopt-upstream", label: `${expected} → ${upstream}` },
    { kind: "align-upstream", label: `${upstream} → ${expected}` },
  ];
}

// AI : red connector / upstream border — downstream step index carries the io-mismatch invalid flag.
export function ioMismatchAtModuleIndex(
  modules: PipelineModule[],
  invalid: InvalidMap | undefined,
  moduleIndex: number,
): boolean {
  if (!invalid || moduleIndex < 0 || moduleIndex >= modules.length) return false;
  const m = modules[moduleIndex]!;
  if (m.kind === "input" && modules[moduleIndex + 1]?.kind === "combine") {
    const issue = invalidForModule(invalid, modules[moduleIndex + 1]!.id);
    return !!issue && isSpineMismatchKind(issue.kind);
  }
  const issue = invalidForModule(invalid, m.id);
  return !!issue && isSpineMismatchKind(issue.kind);
}

export function ioMismatchUpstreamOf(
  moduleId: ModuleId,
  modules: PipelineModule[],
  invalid: InvalidMap | undefined,
): boolean {
  if (!invalid) return false;
  for (const [downId, issues] of invalid) {
    for (const issue of issues) {
      if (!isSpineMismatchKind(issue.kind)) continue;
      if (prevModuleId(modules, downId) === moduleId) return true;
      const downIdx = modules.findIndex((m) => m.id === downId);
      const down = modules[downIdx];
      if (down?.kind === "combine" && downIdx >= 2 && modules[downIdx - 1]?.kind === "input") {
        if (modules[downIdx - 2]?.id === moduleId) return true;
      }
    }
  }
  return false;
}

export function stepIoMismatchLinked(
  moduleId: ModuleId,
  modules: PipelineModule[],
  invalid: InvalidMap | undefined,
): boolean {
  if (!invalid) return false;
  const issue = invalidForModule(invalid, moduleId);
  if (issue && isSpineMismatchKind(issue.kind)) return true;
  return ioMismatchUpstreamOf(moduleId, modules, invalid);
}

// AI : one inspector fix per step — downstream gets adopt-upstream, upstream gets align-upstream.
export function ioMismatchInspectorFix(
  moduleId: ModuleId,
  modules: PipelineModule[],
  invalid: InvalidMap,
  models: StructureModel[],
): IoMismatchInspectorFix | undefined {
  const own = invalidForModule(invalid, moduleId);
  if (own && isSpineMismatchKind(own.kind)) {
    const adopt = ioMismatchFixHints(own, models)?.find((h) => h.kind === "adopt-upstream");
    return {
      mismatchModuleId: moduleId,
      kind: "adopt-upstream",
      label: adopt?.label ?? "",
      message: invalidStepMessage(own, models, modules),
    };
  }

  for (const [downId, issues] of invalid) {
    for (const issue of issues) {
      if (!isSpineMismatchKind(issue.kind) || prevModuleId(modules, downId) !== moduleId) continue;
      const align = ioMismatchFixHints(issue, models)?.find((h) => h.kind === "align-upstream");
      return {
        mismatchModuleId: downId,
        kind: "align-upstream",
        label: align?.label ?? "",
        message: invalidStepMessage(issue, models, modules),
      };
    }
  }

  return undefined;
}

export function stepIoMismatchMessage(
  moduleId: ModuleId,
  modules: PipelineModule[],
  invalid: InvalidMap,
  models: StructureModel[],
): string | undefined {
  const fix = ioMismatchInspectorFix(moduleId, modules, invalid, models);
  if (fix) return fix.message;
  const own = invalidForModule(invalid, moduleId);
  if (own && isSpineMismatchKind(own.kind)) return invalidStepMessage(own, models, modules);
  return undefined;
}
