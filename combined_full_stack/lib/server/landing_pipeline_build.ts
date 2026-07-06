// AI : landing page — build a full pipeline from a task description (cheap model, budgeted).

import { uid } from "@/lib/id";
import { UNNAMED_PROJECT_NAME } from "@/lib/project-assistant-types";
import {
  LANDING_DEMO_MAX_PROMPT_CHARS,
  LANDING_DEMO_MODEL,
} from "@/lib/landing_demo_config";
import { assertLandingBudget, recordLandingUsage } from "@/lib/server/landing_page_demo";
import { proposePipelineChange } from "@/lib/server/pipeline_assistant";
import { blankProject } from "@/lib/server/seed";
import { logger } from "@/lib/server/server_logger";
import { migrateProjectModules } from "@/lib/server/validity";
import { putLandingBuild } from "@/lib/server/demo_store";
import type { Project, ProjectId } from "@/lib/server/types";

const buildLog = logger("landing-build");

export type LandingBuildResult = {
  buildId: ProjectId;
  message: string;
  projectName: string;
  moduleCount: number;
  modelCount: number;
  latencyMs: number;
};

export async function buildLandingPipelineFromTask(task: string, ip: string): Promise<LandingBuildResult> {
  const trimmed = task.trim();
  if (!trimmed) throw new Error("task required");
  if (trimmed.length > LANDING_DEMO_MAX_PROMPT_CHARS) {
    throw new Error(`task exceeds ${LANDING_DEMO_MAX_PROMPT_CHARS} characters`);
  }

  await assertLandingBudget();
  const started = Date.now();
  const buildId = uid<ProjectId>("p_land_");
  let project = blankProject(buildId);

  const prompt = `Design a complete Spine pipeline to automate this task. Include input step(s), processing (llm / transform / combine as needed), and output step(s). Name structures clearly.

Task: ${trimmed}`;

  const result = await proposePipelineChange(project, prompt, [], LANDING_DEMO_MODEL);
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
  }

  putLandingBuild(project);

  const latencyMs = Date.now() - started;

  await recordLandingUsage({
    prompt: trimmed,
    outputPreview: result.message.slice(0, LANDING_DEMO_MAX_PROMPT_CHARS),
    model: LANDING_DEMO_MODEL,
    costCents: result.usageCents,
    latencyMs,
    ip,
  });

  buildLog.info("landing pipeline built", {
    buildId,
    moduleCount: project.modules.length,
    latencyMs,
    usageCents: result.usageCents,
  });

  return {
    buildId,
    message: result.message,
    projectName: project.name,
    moduleCount: project.modules.length,
    modelCount: project.models.length,
    latencyMs,
  };
}
