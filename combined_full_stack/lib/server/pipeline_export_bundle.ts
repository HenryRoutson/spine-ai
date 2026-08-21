import { generatePipelineSourceBaml } from "./pipeline_baml_export";
import { generatePipelineConnectorFiles } from "./pipeline_export_connector";
import { generatePipelineDocumentFiles } from "./pipeline_export_documents";
import { exportRuntimeLibraryFiles } from "./pipeline_export_runtime_files";
import type { PipelineSetupFile } from "./pipeline_export_shared";
import {
  assertNoSecretValuesInExport,
  generatePipelineSetupFiles,
  projectSlug,
} from "./pipeline_export_setup";
import { generatePipelineSourceGo } from "./pipeline_go_export";
import { generatePipelineSourcePy } from "./pipeline_py_export";
import { generatePipelineSourceRust } from "./pipeline_rs_export";
import { generatePipelineSourceTs } from "./pipeline_ts_export";
import type { Project } from "./types";

// AI : full zip contents — must stay server-side (fs for documents + runtime libraries).
export function generatePipelineExportBundle(project: Project): PipelineSetupFile[] {
  const slug = projectSlug(project.name);
  const pipelineFiles: PipelineSetupFile[] = [
    { filename: `${slug}_pipeline.ts`, content: generatePipelineSourceTs(project), mime: "text/typescript" },
    { filename: `${slug}_pipeline.py`, content: generatePipelineSourcePy(project), mime: "text/x-python" },
    { filename: `${slug}_pipeline.rs`, content: generatePipelineSourceRust(project), mime: "text/x-rust" },
    { filename: `${slug}_pipeline.go`, content: generatePipelineSourceGo(project), mime: "text/x-go" },
    { filename: `${slug}_pipeline.baml`, content: generatePipelineSourceBaml(project), mime: "text/plain" },
  ];
  const setupFiles = generatePipelineSetupFiles(project);
  const connectorFiles = generatePipelineConnectorFiles(project);
  for (const f of connectorFiles) assertNoSecretValuesInExport(f.content);
  return [
    ...pipelineFiles,
    ...setupFiles,
    ...connectorFiles,
    ...generatePipelineDocumentFiles(project),
    ...exportRuntimeLibraryFiles(),
    // AI : TODO (media-view-C-export) — visualizers/*.html from Project.visualizers (not documents/).
  ];
}
