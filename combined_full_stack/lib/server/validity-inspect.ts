// AI : IO-mismatch inspector — one-click fix hints and connector highlight logic for the pipeline canvas.
import { ModuleKind, type ModuleId, type PipelineModule, type StructureModel } from "./types";
import {
  InvalidKind,
  IoMismatchFixKind,
  type InvalidStep,
  type InvalidMap,
  type IoMismatchFixHint,
  type IoMismatchInspectorFix,
  invalidForModule,
  modelName,
  prevModuleId,
} from "./validity-types";
import { invalidStepMessage } from "./validity-messages";
import { inputFeedsCombine, isCombineSideParseStep } from "./validity-sync";

export type { IoMismatchFixHint, IoMismatchInspectorFix };
export { IoMismatchFixKind, prevModuleId };

function isSpineMismatchKind(kind: InvalidKind): boolean {
  return kind === InvalidKind.IoMismatch || kind === InvalidKind.CardinalityMismatch;
}

// AI : when step input expects X but upstream emits Y — two one-click alignments.
export function ioMismatchFixHints(
  issue: InvalidStep,
  models: StructureModel[],
): IoMismatchFixHint[] | undefined {
  if (issue.kind !== InvalidKind.IoMismatch || !issue.expects || !issue.upstreamEmits) return undefined;
  const expected = modelName(models, issue.expects);
  const upstream = modelName(models, issue.upstreamEmits);
  if (!expected || !upstream || expected === upstream) return undefined;
  return [
    { kind: IoMismatchFixKind.AdoptUpstream, label: `${expected} → ${upstream}` },
    { kind: IoMismatchFixKind.AlignUpstream, label: `${upstream} → ${expected}` },
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
  if (m.kind === ModuleKind.Input && inputFeedsCombine(modules, moduleIndex)) {
    const combineAt = modules[moduleIndex + 1]?.kind === ModuleKind.Combine ? moduleIndex + 1 : moduleIndex + 2;
    const issue = invalidForModule(invalid, modules[combineAt]!.id);
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
      if (down?.kind === ModuleKind.Combine) {
        // AI : hop over the side group [input, autoParseLlm?] to the combine's spine upstream.
        const inputIdx = isCombineSideParseStep(modules, downIdx - 1) ? downIdx - 2 : downIdx - 1;
        if (modules[inputIdx]?.kind === ModuleKind.Input && modules[inputIdx - 1]?.id === moduleId) return true;
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
    const adopt = ioMismatchFixHints(own, models)?.find((h) => h.kind === IoMismatchFixKind.AdoptUpstream);
    return {
      mismatchModuleId: moduleId,
      kind: IoMismatchFixKind.AdoptUpstream,
      label: adopt?.label ?? "",
      message: invalidStepMessage(own, models, modules),
    };
  }

  for (const [downId, issues] of invalid) {
    for (const issue of issues) {
      if (!isSpineMismatchKind(issue.kind) || prevModuleId(modules, downId) !== moduleId) continue;
      const align = ioMismatchFixHints(issue, models)?.find((h) => h.kind === IoMismatchFixKind.AlignUpstream);
      return {
        mismatchModuleId: downId,
        kind: IoMismatchFixKind.AlignUpstream,
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
