#!/usr/bin/env node
// AI : Spine pinpoint MCP — isolate which pipeline step diverged from pinned *_testing.json outputs.

import { resolve } from "node:path"
import "./bootstrap-env.js"

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import {
  compareRunToTestReport,
  listProjectTests,
  parseTestFileCommand,
  pinpointFailure,
  validateTestFile,
} from "./spine-pinpoint.js"
import {
  deriveStepPrompt,
  describePipelineSteps,
  exportPydanticProject,
  validatePipelineWiring,
  validateStepOutputValue,
} from "./spine-step-models.js"

const REPO_ROOT = process.env.SPINE_REPO_ROOT ?? resolve(process.cwd(), "..")

function textContent(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  }
}

const runSourceSchema = {
  runPath: z
    .string()
    .optional()
    .describe("Path to a pipeline run JSON file (from Logging export or /api/runs)"),
  runJson: z
    .string()
    .optional()
    .describe("Inline pipeline run JSON when runPath is not set"),
}

const server = new McpServer({
  name: "spine-pinpoint",
  version: "0.1.0",
})

server.tool(
  "pinpoint_failure",
  "Compare a finished pipeline run against a *_testing.json file and return the first diverging step with isolated field diffs (expected vs actual only — no cache, no full pipeline dump). Use this to quickly find which step is wrong.",
  {
    projectSeedPath: z.string().describe("Path to the project seed JSON (e.g. seeds/homework_grader.json)"),
    testFilePath: z.string().describe("Path to the *_testing.json file with pinned per-step outputs"),
    ...runSourceSchema,
  },
  async (args) => textContent(pinpointFailure(args, REPO_ROOT)),
)

server.tool(
  "compare_run_to_test",
  "Full per-step deterministic comparison between a run and a test file. Returns every pinned step status plus failure field records.",
  {
    projectSeedPath: z.string(),
    testFilePath: z.string(),
    ...runSourceSchema,
  },
  async (args) => textContent(compareRunToTestReport(args, REPO_ROOT)),
)

server.tool(
  "validate_test",
  "Validate a *_testing.json file against the current pipeline (labels, types, inputs) — same rules as the Testing tab.",
  {
    projectSeedPath: z.string(),
    testFilePath: z.string(),
  },
  async (args) => textContent(validateTestFile(args, REPO_ROOT)),
)

server.tool(
  "parse_test",
  "Parse a *_testing.json file without a project context.",
  {
    testFilePath: z.string(),
  },
  async (args) => textContent(parseTestFileCommand(args.testFilePath, REPO_ROOT)),
)

server.tool(
  "list_project_tests",
  "List all *_testing.json files referenced by a project seed.",
  {
    projectSeedPath: z.string(),
  },
  async (args) => textContent({ tests: listProjectTests(args.projectSeedPath, REPO_ROOT) }),
)

server.tool(
  "describe_pipeline_steps",
  "Break a pipeline into per-step pydantic models: spine I/O types, JSON schemas, structure defs, and derived LLM prompts. Filter with stepLabel to inspect one step.",
  {
    projectSeedPath: z.string(),
    stepLabel: z.string().optional().describe("Optional step label — omit to list all steps"),
  },
  async (args) => textContent(describePipelineSteps(args, REPO_ROOT)),
)

server.tool(
  "validate_step_output",
  "Validate a JSON value against a step's pydantic / pipeline-state schema — same rules as runtime step output validation.",
  {
    projectSeedPath: z.string(),
    stepLabel: z.string(),
    valueJson: z.string().describe("JSON value to validate as this step's output"),
  },
  async (args) => textContent(validateStepOutputValue(args, REPO_ROOT)),
)

server.tool(
  "derive_step_prompt",
  "Derive the structured LLM prompt for an llm or llm-batch step (user prompt + JSON Schema suffix). Optional sampleInputJson fills the input block.",
  {
    projectSeedPath: z.string(),
    stepLabel: z.string(),
    sampleInputJson: z.string().optional(),
  },
  async (args) => textContent(deriveStepPrompt(args, REPO_ROOT)),
)

server.tool(
  "validate_pipeline_wiring",
  "Check linear spine I/O validity across all steps — same computeInvalid rules as the pipeline editor.",
  {
    projectSeedPath: z.string(),
  },
  async (args) => textContent(validatePipelineWiring(args, REPO_ROOT)),
)

server.tool(
  "export_pydantic",
  "Export all structure models as pydantic Python plus generated per-step pipeline signatures.",
  {
    projectSeedPath: z.string(),
    includePipelineSignatures: z.boolean().optional().describe("Include generated step function stubs (default true)"),
  },
  async (args) => textContent(exportPydanticProject(args, REPO_ROOT)),
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
