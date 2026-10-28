import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isLlmKind } from "@/lib/module-kinds";
import { flattenPipelineModules } from "@/lib/fork-pipeline";
import { dataDir } from "../config";
import { type LiveStep, progressHtml } from "../logging";
import type { ModelId, Project, RunStep } from "../types";

export const LIVE_HTML_PATH = join(dataDir(), "live", "run_live.html");

export function createWriteLive(
  project: Project,
  model: ModelId,
  steps: RunStep[],
  enabled: boolean,
): (runningIndex: number) => void {
  return (runningIndex: number) => {
    if (!enabled) return;
    const display: LiveStep[] = flattenPipelineModules(project.modules).map((m, idx) => {
      const done = steps.find((s) => s.moduleId === m.id);
      if (done) {
        const inLabel = isLlmKind(m.kind) ? "prompt" : "in";
        return {
          label: m.label,
          kind: m.kind,
          status: done.status,
          ms: done.ms,
          costCents: done.costCents,
          detail: [`${inLabel}: ${done.inputPreview}`, `out: ${done.outputJson ?? done.outputPreview}`],
        };
      }
      return { label: m.label, kind: m.kind, status: idx === runningIndex ? "running" : "pending", ms: 0, costCents: 0 };
    });
    const at = Math.min(steps.length + 1, display.length);
    mkdirSync(join(dataDir(), "live"), { recursive: true });
    writeFileSync(
      LIVE_HTML_PATH,
      progressHtml(
        `${project.name} — ${runningIndex === -1 ? "run finished" : "running"}`,
        `${model} · step ${at}/${display.length}`,
        display,
        runningIndex !== -1,
      ),
    );
  };
}
