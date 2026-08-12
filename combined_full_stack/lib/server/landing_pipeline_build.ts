// AI : landing page — build a full pipeline from a task description, then run it on example files.

import { uid } from "@/lib/id";
import { UNNAMED_PROJECT_NAME } from "@/lib/project-assistant-types";
import {
  LANDING_DEMO_MAX_PROMPT_CHARS,
  LANDING_DEMO_MODEL,
  LANDING_DEMO_RESERVE_CENTS,
  LANDING_DEMO_RUN_RESERVE_CENTS,
  LANDING_DEMO_TAG_BUILD_PIPELINE,
  LANDING_DEMO_TAG_RUN_PIPELINE,
} from "@/lib/landing_demo_config";
import {
  recordLandingUsage,
  releaseLandingBudgetReservation,
  reserveLandingBudget,
} from "@/lib/server/landing_page_demo";
import type { landing_demo_stream_phase } from "@/lib/landing-demo-stream";
import { proposePipelineChange, type ProjectAssistantDocSpec } from "@/lib/server/pipeline_assistant";
import { blankProject } from "@/lib/server/seed";
import { logger } from "@/lib/server/server_logger";
import { migrateProjectModules } from "@/lib/server/validity";
import { putLandingBuild } from "@/lib/server/demo_store";
import { mintLandingBuildAccessToken } from "@/lib/server/landing_build_access";
import {
  materializeLandingExampleDocs,
  runLandingPipelineWithExamples,
  type LandingRunTrace,
} from "@/lib/server/landing_pipeline_run";
import { buildLandingRunDiagnostic } from "@/lib/server/landing_run_diagnostic";
import { RunStatus, type ProjectId, type RunId } from "@/lib/server/types";

const buildLog = logger("landing-build");

export type LandingBuildResult = {
  buildId: ProjectId;
  // AI : SECURITY — HMAC token required by /api/demo/state when loading this build.
  accessToken: string;
  message: string;
  projectName: string;
  moduleCount: number;
  modelCount: number;
  latencyMs: number;
  exampleDocNames: string[];
  run: LandingRunTrace | null;
};

// AI : optional stream hooks — landing page paints tokens as the agent thinks / writes.
export type LandingBuildStreamHooks = {
  onThinkingDelta?: (delta: string) => void;
  onThinkingDone?: (text: string) => void;
  onMessageDelta?: (delta: string) => void;
  onPhase?: (phase: landing_demo_stream_phase) => void;
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
}

export async function buildLandingPipelineFromTask(
  task: string,
  ip: string,
  hooks?: LandingBuildStreamHooks,
): Promise<LandingBuildResult> {
  const trimmed = task.trim();
  if (!trimmed) throw new Error("task required");
  if (trimmed.length > LANDING_DEMO_MAX_PROMPT_CHARS) {
    throw new Error(`task exceeds ${LANDING_DEMO_MAX_PROMPT_CHARS} characters`);
  }

  await reserveLandingBudget(LANDING_DEMO_RESERVE_CENTS);
  const started = Date.now();
  const buildId = uid<ProjectId>("p_land_");
  let project = blankProject(buildId);
  let agentDocs: ProjectAssistantDocSpec[] = [];

  try {
    const result = await proposePipelineChange(project, trimmed, [], LANDING_DEMO_MODEL, {
      onThinkingDelta: hooks?.onThinkingDelta,
      onThinkingDone: hooks?.onThinkingDone,
      onMessageDelta: hooks?.onMessageDelta,
      onPhase: hooks?.onPhase
        ? (phase) => {
            // AI : landing stream has no "observing" wire phase — skip silently.
            if (phase === "observing") return
            hooks.onPhase?.(phase)
          }
        : undefined,
    });
    const proposal = result.proposal;

    if (proposal) {
      project = migrateProjectModules({
        ...project,
        name: proposal.projectName ?? (trimmed.slice(0, 80) || UNNAMED_PROJECT_NAME),
        modules: proposal.changed.modules ? proposal.modules : project.modules,
        models: proposal.changed.models ? proposal.models : project.models,
        typeAliases: proposal.changed.typeAliases ? proposal.typeAliases : (project.typeAliases ?? []),
        documentation: proposal.changed.documentation ? proposal.documentation : project.documentation,
      });
      if (proposal.changed.docs) agentDocs = proposal.docs;
    }

    const exampleDocs = materializeLandingExampleDocs(project, agentDocs, trimmed);
    project = {
      ...project,
      seedDocNames: exampleDocs.map((d) => d.ref.name),
    };
    putLandingBuild(project, exampleDocs);

    const latencyMs = Date.now() - started;

    await recordLandingUsage({
      prompt: trimmed,
      outputPreview: result.message.slice(0, LANDING_DEMO_MAX_PROMPT_CHARS),
      tag: LANDING_DEMO_TAG_BUILD_PIPELINE,
      buildId,
      projectName: project.name,
      model: LANDING_DEMO_MODEL,
      costCents: result.usageCents,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      latencyMs,
      ip,
      budgetReserveCents: LANDING_DEMO_RESERVE_CENTS,
    });

    buildLog.info("landing pipeline built", {
      buildId,
      moduleCount: project.modules.length,
      latencyMs,
      usageCents: result.usageCents,
      exampleDocCount: exampleDocs.length,
    });

    let run: LandingRunTrace | null = null;
    try {
      await reserveLandingBudget(LANDING_DEMO_RUN_RESERVE_CENTS);
      hooks?.onPhase?.("running");
      const runStarted = Date.now();
      run = await runLandingPipelineWithExamples(project, exampleDocs);
      await recordLandingUsage({
        prompt: `run:${trimmed}`,
        // AI : output_preview stays short; full dump in diagnostic_text/json for reconstruction.
        outputPreview: run.diagnosticSummary
          ?? (run.error ? run.error.slice(0, 240) : `status=${run.status} steps via ${run.exampleDocNames.join(", ")}`),
        diagnosticText: run.error,
        diagnosticJson: run.diagnosticJson as Record<string, unknown> | undefined,
        tag: LANDING_DEMO_TAG_RUN_PIPELINE,
        buildId,
        projectName: project.name,
        model: LANDING_DEMO_MODEL,
        costCents: run.billedCents,
        promptTokens: 0,
        completionTokens: 0,
        latencyMs: Date.now() - runStarted,
        ip,
        budgetReserveCents: LANDING_DEMO_RUN_RESERVE_CENTS,
      });
      buildLog.info("landing pipeline ran", {
        buildId,
        runId: run.runId,
        status: run.status,
        billedCents: run.billedCents,
      });
    } catch (runErr) {
      await releaseLandingBudgetReservation(LANDING_DEMO_RUN_RESERVE_CENTS);
      const diagnostic = buildLandingRunDiagnostic({
        err: runErr,
        project,
        exampleDocs,
        title: "=== Landing pipeline run error (outer) ===",
      });
      buildLog.warn("landing pipeline run failed", { buildId, error: diagnostic.summary });
      run = {
        runId: "run_land_failed" as RunId,
        status: RunStatus.Error,
        totalMs: 0,
        billedCents: 0,
        savedCents: 0,
        model: LANDING_DEMO_MODEL,
        exampleDocNames: exampleDocs.map((d) => d.ref.name),
        steps: [],
        modules: project.modules.map((m) => ({
          id: m.id,
          kind: m.kind,
          label: m.label,
          note: m.note,
          model: m.model,
          prompt: m.prompt,
        })),
        // AI : fallback HTML when the run wrapper throws before a PipelineRun exists.
        traceHtml: `<!doctype html><html><body><h1>Run failed</h1><pre>${escapeHtml(diagnostic.text)}</pre></body></html>`,
        error: diagnostic.text,
        diagnosticJson: diagnostic.json,
        diagnosticSummary: diagnostic.summary,
      };
      // AI : still persist full diagnostic even when the run wrapper itself throws.
      try {
        await recordLandingUsage({
          prompt: `run:${trimmed}`,
          outputPreview: diagnostic.summary,
          diagnosticText: diagnostic.text,
          diagnosticJson: diagnostic.json as unknown as Record<string, unknown>,
          tag: LANDING_DEMO_TAG_RUN_PIPELINE,
          buildId,
          projectName: project.name,
          model: LANDING_DEMO_MODEL,
          costCents: 0,
          promptTokens: 0,
          completionTokens: 0,
          latencyMs: 0,
          ip,
          budgetReserveCents: 0,
        });
      } catch {
        /* budget already released — don't mask the run error */
      }
    }

    return {
      buildId,
      accessToken: mintLandingBuildAccessToken(buildId),
      message: result.message,
      projectName: project.name,
      moduleCount: project.modules.length,
      modelCount: project.models.length,
      latencyMs,
      exampleDocNames: exampleDocs.map((d) => d.ref.name),
      run,
    };
  } catch (err) {
    await releaseLandingBudgetReservation(LANDING_DEMO_RESERVE_CENTS);
    throw err;
  }
}
