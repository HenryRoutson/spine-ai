import { describe, expect, it } from "vitest"
import { diagnosisForMissingSecrets } from "@/lib/diagnosis-missing-secret"
import { ModuleKind, RunStatus, RunStepStatus, type ModuleId, type PipelineRun, type Project, type ProjectId, type RunId } from "@/lib/types"

describe("diagnosisForMissingSecrets", () => {
  const project = {
    id: "p_clip" as ProjectId,
    name: "Generate clip",
    kind: "media-demo",
    models: [],
    modules: [
      {
        id: "mod_generate" as ModuleId,
        kind: ModuleKind.Webhook,
        label: "Generate",
        note: "",
        cached: false,
        avgMs: 0,
        avgCostCents: 0,
        webhookUrl: "env:HIGGSFIELD_GENERATE_URL",
        webhookAuthEnv: "HIGGSFIELD_API_KEY",
      },
    ],
  } as Project

  it("returns Library → Secrets guidance when the run log names a missing key", () => {
    const run = {
      id: "run_1" as RunId,
      projectId: project.id,
      status: RunStatus.Error,
      startedAt: 1,
      steps: [
        {
          moduleId: "mod_generate" as ModuleId,
          label: "Generate",
          kind: ModuleKind.Webhook,
          status: RunStepStatus.Error,
          outputPreview: "HIGGSFIELD_API_KEY is not set. Add it in Library → Secrets, or as an environment variable.",
        },
      ],
    } as PipelineRun

    const text = diagnosisForMissingSecrets(project, run)
    expect(text).toContain("## Root cause")
    expect(text).toContain("HIGGSFIELD_API_KEY")
    expect(text).toContain("Library → Secrets")
    expect(text).toContain("Generate")
  })

  it("returns null for unrelated failures", () => {
    const run = {
      id: "run_2" as RunId,
      projectId: project.id,
      status: RunStatus.Error,
      startedAt: 1,
      steps: [
        {
          moduleId: "mod_generate" as ModuleId,
          label: "Generate",
          kind: ModuleKind.Webhook,
          status: RunStepStatus.Error,
          outputPreview: "webhook 401 Unauthorized",
        },
      ],
    } as PipelineRun
    expect(diagnosisForMissingSecrets(project, run)).toBeNull()
  })
})
