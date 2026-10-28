import { docsForProject, dedupeDocsNewestByName } from "@/lib/project-docs";
import { isSlimPipelineRun } from "@/lib/run-metrics";
import type { DocRef, PipelineRun, Project, RunStep } from "./types";

// AI : NDJSON wire events for GET /api/state — client can paint projects before runs arrive.
export const STATE_STREAM_EVENT = {
  PROJECTS: "projects",
  MODEL_OPTIONS: "modelOptions",
  DOCS: "docs",
  RUNS: "runs",
  DONE: "done",
  ERROR: "error",
} as const;

export type StateStreamEventType = (typeof STATE_STREAM_EVENT)[keyof typeof STATE_STREAM_EVENT];

// AI : only ship docs linked via seedDocNames — drops orphaned hashes from the payload.
export function docsLinkedToProjects(projects: Project[], allDocs: DocRef[]): DocRef[] {
  const linked = new Set<string>();
  for (const p of projects) {
    for (const name of p.seedDocNames ?? []) linked.add(name);
  }
  if (!linked.size) return [];
  return dedupeDocsNewestByName(allDocs.filter((d) => linked.has(d.name)));
}

function slimRunStep(step: RunStep): RunStep {
  return {
    moduleId: step.moduleId,
    kind: step.kind,
    label: step.label,
    model: step.model,
    status: step.status,
    ms: step.ms,
    costCents: step.costCents,
    savedCostCents: step.savedCostCents,
    docId: step.docId,
    inputDescription: step.inputDescription,
    // AI : keep short previews for error badges in the run list — omit outputJson / llmCalls / serverLogs.
    inputPreview: step.inputPreview,
    outputPreview: step.status === "error" ? step.outputPreview : "",
    failures: step.failures,
    inputDescriptionCheck: step.inputDescriptionCheck,
  };
}

// AI : list + billing aggregation — full step payloads load via GET /api/runs/:id on demand.
export function slimPipelineRun(run: PipelineRun): PipelineRun {
  return {
    ...run,
    steps: run.steps.map(slimRunStep),
  };
}

export function slimPipelineRuns(runs: PipelineRun[]): PipelineRun[] {
  return runs.map(slimPipelineRun);
}

export { isSlimPipelineRun };

// AI : project-scoped docs for a single active project — smaller than account-wide linked docs.
export function docsForActiveProject(projects: Project[], allDocs: DocRef[], projectId: string | null): DocRef[] {
  if (!projectId) return docsLinkedToProjects(projects, allDocs);
  const project = projects.find((p) => p.id === projectId);
  if (!project) return docsLinkedToProjects(projects, allDocs);
  return docsForProject(allDocs, project);
}
