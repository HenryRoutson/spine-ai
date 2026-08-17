import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PipelineSetupFile } from "./pipeline_export_shared";

// AI : import.meta.url breaks once Next bundles this — cwd is combined_full_stack (dev, start, Vercel).
const RUNTIME_DIR = join(process.cwd(), "lib/export_runtime");

function readRuntime(rel: string): string {
  return readFileSync(join(RUNTIME_DIR, rel), "utf8");
}

// AI : hand-written libraries copied into the export zip — do not string-generate these.
export function exportRuntimeLibraryFiles(): PipelineSetupFile[] {
  return [
    { filename: "pipeline_runtime.ts", content: readRuntime("ts/pipeline_runtime.ts"), mime: "text/typescript" },
    { filename: "pipeline_runtime.py", content: readRuntime("py/pipeline_runtime.py"), mime: "text/x-python" },
    { filename: "pipeline_runtime.go", content: readRuntime("go/pipeline_runtime.go"), mime: "text/x-go" },
    { filename: "pipeline_runtime.rs", content: readRuntime("rs/pipeline_runtime.rs"), mime: "text/x-rust" },
  ];
}

export function exportRuntimeTsPath(): string {
  return join(RUNTIME_DIR, "ts/pipeline_runtime.ts");
}
