import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { orderedInputModules } from "@/lib/inference-input";
import { labelAsStateKey } from "./pipeline_state";
import { DOCUMENTS_DIR } from "./config";
import type { PipelineSetupFile } from "./pipeline_export_shared";
import {
  expectedOutputsForProject,
  inferencePresetsForProject,
  resolveProjectSeed,
} from "./seed";
import type { Project } from "./types";

function walkDocumentFiles(rootDir: string): { abs: string; rel: string }[] {
  const out: { abs: string; rel: string }[] = [];
  if (!existsSync(rootDir)) return out;
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const abs = join(rootDir, entry.name);
    const rel = entry.name;
    if (entry.isDirectory()) {
      for (const nested of walkDocumentFiles(abs)) {
        out.push({ abs: nested.abs, rel: `${rel}/${nested.rel}` });
      }
      continue;
    }
    if (entry.isFile()) out.push({ abs, rel });
  }
  return out;
}

function documentFoldersForSeed(seed: NonNullable<ReturnType<typeof resolveProjectSeed>>): string[] {
  const folders = new Set<string>();
  for (const spec of seed.docSpecs) {
    const folder = dirname(spec.relativeFile);
    folders.add(folder === "." ? basename(spec.relativeFile).replace(/\.[^.]+$/, "") : folder);
  }
  return [...folders];
}

function mimeForFilename(filename: string): string {
  if (filename.endsWith(".json")) return "application/json";
  if (filename.endsWith(".md")) return "text/markdown";
  return "text/plain";
}

export function generatePipelineDocumentFiles(project: Project): PipelineSetupFile[] {
  const seed = resolveProjectSeed(project);
  if (!seed) return [];

  const files: PipelineSetupFile[] = [];
  const seen = new Set<string>();

  for (const folder of documentFoldersForSeed(seed)) {
    const folderPath = join(DOCUMENTS_DIR, folder);
    for (const { abs, rel } of walkDocumentFiles(folderPath)) {
      const exportPath = `documents/${folder}/${rel}`;
      if (seen.has(exportPath)) continue;
      seen.add(exportPath);
      files.push({
        filename: exportPath,
        content: readFileSync(abs, "utf8"),
        mime: mimeForFilename(rel),
      });
    }
  }

  const presets = inferencePresetsForProject(project);
  const defaultPreset = presets[0];
  const inputMods = orderedInputModules(project.modules);

  const inferenceSetup = {
    description: defaultPreset?.description ?? `Default inference inputs for ${project.name}`,
    presets: presets.map((p) => ({
      name: p.name,
      description: p.description,
      inputs: p.inputs,
    })),
    inputs: defaultPreset?.inputs ?? Object.fromEntries(
      inputMods.map((m) => {
        const hint = m.inputNameContains?.trim();
        const ext = m.inputType === "json" ? ".json" : ".txt";
        return [labelAsStateKey(m.label), hint ? `${hint}${ext}` : `input${ext}`];
      }),
    ),
  };

  files.push({
    filename: "documents/inference_setup.json",
    content: `${JSON.stringify(inferenceSetup, null, 2)}\n`,
    mime: "application/json",
  });

  const testingDoc = seed.docSpecs.find((d) => d.name.endsWith("_testing.json"));
  if (testingDoc && existsSync(testingDoc.path)) {
    files.push({
      filename: "documents/testing_setup.json",
      content: readFileSync(testingDoc.path, "utf8"),
      mime: "application/json",
    });
  } else {
    const expected = expectedOutputsForProject(project);
    if (Object.keys(expected).length) {
      files.push({
        filename: "documents/testing_setup.json",
        content: `${JSON.stringify(
          {
            description: `Golden fixtures for deterministic steps in ${project.name}`,
            inputs: inferenceSetup.inputs,
            expectedOutputs: expected,
          },
          null,
          2,
        )}\n`,
        mime: "application/json",
      });
    }
  }

  return files;
}
