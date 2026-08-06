import { orderedInputModules } from "@/lib/inference-input";
import { labelAsStateKey } from "./pipeline_state";
import type { PipelineSetupFile } from "./pipeline_export_shared";
import type { InferencePreset, Project } from "./types";

function projectSlug(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "pipeline"
  );
}

// AI : client-safe — use persisted project presets only (no seed/fs lookup).
function inferencePresets(project: Project): InferencePreset[] {
  return project.inferencePresets ?? [];
}

export function generateRunExampleTs(project: Project, slug: string): string {
  const inputMods = orderedInputModules(project.modules);
  const multi = inputMods.length > 1;
  const presets = inferencePresets(project);
  const defaultInputs = presets[0]?.inputs;

  const loadLines = multi
    ? inputMods.map((m) => {
        const label = labelAsStateKey(m.label);
        const file =
          (typeof defaultInputs?.[label] === "string" ? defaultInputs[label] : null) ??
          m.inputNameContains?.trim() ??
          "input.txt";
        return `    ${JSON.stringify(label)}: readDoc(${JSON.stringify(`documents/${file}`)}),`;
      })
    : [
        `  const doc = readDoc(${JSON.stringify(
          `documents/${
            (typeof defaultInputs?.[labelAsStateKey(inputMods[0]!.label)] === "string"
              ? defaultInputs[labelAsStateKey(inputMods[0]!.label)]
              : null) ??
            inputMods[0]?.inputNameContains?.trim() ??
            "input.txt"
          }`,
        )});`,
      ];

  return [
    "// Generated runner — load .env, read documents/, call runPipeline.",
    "// npm install dotenv tsx",
    "// npx tsx run_example.ts",
    'import "dotenv/config";',
    'import { readFileSync } from "node:fs";',
    `import { configurePipelineRuntime, runPipeline, getLastRunTrace } from "./${slug}_pipeline";`,
    "",
    "function readDoc(path: string) {",
    '  const content = readFileSync(path, "utf8");',
    '  return { content, filename: path.split("/").pop() ?? path };',
    "}",
    "",
    "configurePipelineRuntime({",
    "  openRouterApiKey: process.env.OPENROUTER_API_KEY,",
    "  openRouterModel: process.env.OPENROUTER_MODEL,",
    "});",
    "",
    "async function main() {",
    ...(multi
      ? ["  const result = await runPipeline({", ...loadLines, "  });"]
      : [...loadLines, "  const result = await runPipeline(doc);"]),
    "  console.log(JSON.stringify(result, null, 2));",
    '  console.log("\\n--- step trace ---");',
    "  for (const step of getLastRunTrace()) {",
    "    console.log(`\\n[${step.label}]`);",
    "    console.log(JSON.stringify(step.output, null, 2).slice(0, 1200));",
    "  }",
    "}",
    "",
    "main().catch((e) => {",
    "  console.error(e);",
    "  process.exit(1);",
    "});",
    "",
  ].join("\n");
}

export function generateRunExamplePy(project: Project, slug: string): string {
  const inputMods = orderedInputModules(project.modules);
  const multi = inputMods.length > 1;
  const presets = inferencePresets(project);
  const defaultInputs = presets[0]?.inputs;

  const loadBlock = multi
    ? [
        "inputs = {",
        ...inputMods.map((m) => {
          const label = labelAsStateKey(m.label);
          const file =
            (typeof defaultInputs?.[label] === "string" ? defaultInputs[label] : null) ??
            m.inputNameContains?.trim() ??
            "input.txt";
          return `    ${JSON.stringify(label)}: read_doc(${JSON.stringify(`documents/${file}`)}),`;
        }),
        "}",
        "result = await run_pipeline(inputs)",
      ]
    : [
        `doc = read_doc(${JSON.stringify(
          `documents/${
            (typeof defaultInputs?.[labelAsStateKey(inputMods[0]!.label)] === "string"
              ? defaultInputs[labelAsStateKey(inputMods[0]!.label)]
              : null) ??
            inputMods[0]?.inputNameContains?.trim() ??
            "input.txt"
          }`,
        )})`,
        "result = await run_pipeline(doc)",
      ];

  return [
    "# Generated runner — load .env, read documents/, call run_pipeline.",
    "# python run_example.py",
    "from __future__ import annotations",
    "",
    "import asyncio",
    "import json",
    "import os",
    "from pathlib import Path",
    "",
    "from dotenv import load_dotenv",
    "",
    `from ${slug}_pipeline import configure_pipeline_runtime, get_last_run_trace, run_pipeline`,
    "",
    "load_dotenv()",
    "",
    "def read_doc(path: str) -> dict[str, str]:",
    '    content = Path(path).read_text(encoding="utf-8")',
    '    return {"content": content, "filename": Path(path).name}',
    "",
    "async def main() -> None:",
    "    configure_pipeline_runtime(",
    '        open_router_api_key=os.environ.get("OPENROUTER_API_KEY"),',
    '        open_router_model=os.environ.get("OPENROUTER_MODEL"),',
    "    )",
    ...loadBlock.map((line) => `    ${line}`),
    "    print(json.dumps(result, indent=2))",
    '    print("\\n--- step trace ---")',
    "    for step in get_last_run_trace():",
    '        print(f"\\n[{step[\'label\']}]")',
    '        print(json.dumps(step["output"], indent=2)[:1200])',
    "",
    "",
    'if __name__ == "__main__":',
    "    asyncio.run(main())",
    "",
  ].join("\n");
}

export function generatePipelineRunnerFiles(project: Project): PipelineSetupFile[] {
  const slug = projectSlug(project.name);
  return [
    {
      filename: "run_example.ts",
      content: generateRunExampleTs(project, slug),
      mime: "text/typescript",
    },
    {
      filename: "run_example.py",
      content: generateRunExamplePy(project, slug),
      mime: "text/x-python",
    },
  ];
}
