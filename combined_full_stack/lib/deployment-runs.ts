import { isSharedRun } from "./shared-link-types";
import type { DeploymentRow } from "./deployment-funding";
import { RunSource, type PipelineRun } from "./types";

export function isHostedApiRun(run: { source?: RunSource; hostedApiId?: string }): boolean {
  return run.source === RunSource.HostedApi || !!run.hostedApiId;
}

export function isDeploymentRun(run: PipelineRun): boolean {
  return isSharedRun(run) || isHostedApiRun(run);
}

export function allDeploymentRuns(runs: PipelineRun[]): PipelineRun[] {
  return runs.filter(isDeploymentRun).sort((a, b) => b.startedAt - a.startedAt);
}

export function runsForDeployment(
  runs: PipelineRun[],
  item: DeploymentRow,
  limit?: number,
): PipelineRun[] {
  const id = item.row.id;
  const matched = runs
    .filter((run) =>
      item.kind === "api" ? run.hostedApiId === id : run.sharedLinkId === id,
    )
    .sort((a, b) => b.startedAt - a.startedAt);
  return limit == null ? matched : matched.slice(0, limit);
}

export function deploymentRunCallerLabel(run: PipelineRun): string {
  if (run.triggerUserEmail) return run.triggerUserEmail;
  if (run.triggerUserId) return `Signed in · ${run.triggerUserId.slice(0, 8)}…`;
  if (run.viewerName?.trim()) return `${run.viewerName.trim()} · not signed in`;
  if (run.viewerSessionId) return `Anonymous · session ${run.viewerSessionId.slice(0, 8)}…`;
  if (isHostedApiRun(run)) return "API key only · not signed in";
  return "Not signed in";
}

export function deploymentRunKindLabel(run: PipelineRun): "link" | "api" {
  return isHostedApiRun(run) ? "api" : "link";
}

export function deploymentRunTargetId(run: PipelineRun): string | undefined {
  return run.hostedApiId ?? run.sharedLinkId;
}
