"use client"

// AI : TODO export UI — zip download (single archive) instead of sequential downloadBlob calls.
// AI : TODO export UI — bundled Supabase SQL + Next.js inference shell alongside connector files.

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Check, Code2, Download, FileText, Loader2, X } from "lucide-react"
import { ReadonlyCodeViewer, type CodeViewerLanguage } from "@/components/code-viewer"
import { Button } from "@/components/ui/button"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"
import { downloadBlob } from "@/lib/download-blob"
import type { Project, StructureModel, TypeAlias } from "@/lib/types"
import type { PipelineModule } from "@/lib/types"
import { cn } from "@/lib/utils"

type ExportTabId =
  | "typescript"
  | "python"
  | "rust"
  | "proto"
  | "ui"
  | "connector-ts"
  | "connector-py"
  | "env"
  | "setup"
  | "requirements"

type ExportFile = {
  id: ExportTabId
  label: string
  filename: string
  content: string
  mime: string
  language?: CodeViewerLanguage | "markdown" | "plaintext"
}

function projectSlug(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "pipeline"
  )
}

const TAB_ORDER: ExportTabId[] = [
  "typescript",
  "python",
  "rust",
  "proto",
  "ui",
  "connector-ts",
  "connector-py",
  "env",
  "requirements",
  "setup",
]

function setupFileTabMeta(filename: string): { id: ExportTabId; label: string; language?: ExportFile["language"] } {
  switch (filename) {
    case ".env.example":
      return { id: "env", label: ".env.example", language: "plaintext" }
    case "requirements.txt":
      return { id: "requirements", label: "requirements.txt", language: "plaintext" }
    case "SETUP.md":
      return { id: "setup", label: "SETUP.md", language: "markdown" }
    case "pipeline_connector.proto":
      return { id: "proto", label: "connector.proto", language: "plaintext" }
    case "inference_ui.html":
      return { id: "ui", label: "inference UI", language: "plaintext" }
    case "connector_server.ts":
      return { id: "connector-ts", label: "connector (TS)", language: "typescript" }
    case "connector_server.py":
      return { id: "connector-py", label: "connector (Py)", language: "python" }
    default:
      return { id: "setup", label: filename, language: "plaintext" }
  }
}

export function PipelineExportDialog({
  project,
  modules,
  models,
  typeAliases,
}: {
  project: Project
  modules: PipelineModule[]
  models: StructureModel[]
  typeAliases: TypeAlias[]
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<ExportTabId>("typescript")
  const [downloaded, setDownloaded] = useState<string | null>(null)
  const [genError, setGenError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [files, setFiles] = useState<ExportFile[]>([])

  const exportProject = useMemo(
    () => ({ ...project, modules, models, typeAliases }),
    [project, modules, models, typeAliases],
  )

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setGenError(null)
    void (async () => {
      try {
        const { generatePipelineSourceTs } = await import("@/lib/server/pipeline_ts_export")
        const { generatePipelineSourcePy } = await import("@/lib/server/pipeline_py_export")
        const { generatePipelineSourceRust } = await import("@/lib/server/pipeline_rs_export")
        const { generatePipelineSetupFiles, assertNoSecretValuesInExport } = await import(
          "@/lib/server/pipeline_export_setup"
        )
        const { generatePipelineConnectorFiles } = await import("@/lib/server/pipeline_export_connector")
        const slug = projectSlug(project.name)
        const setupFiles = generatePipelineSetupFiles(exportProject)
        const connectorFiles = generatePipelineConnectorFiles(exportProject)
        for (const f of connectorFiles) assertNoSecretValuesInExport(f.content)
        const next: ExportFile[] = [
          {
            id: "typescript",
            label: "TypeScript",
            filename: `${slug}_pipeline.ts`,
            content: generatePipelineSourceTs(exportProject),
            mime: "text/typescript",
            language: "typescript",
          },
          {
            id: "python",
            label: "Python",
            filename: `${slug}_pipeline.py`,
            content: generatePipelineSourcePy(exportProject),
            mime: "text/x-python",
            language: "python",
          },
          {
            id: "rust",
            label: "Rust",
            filename: `${slug}_pipeline.rs`,
            content: generatePipelineSourceRust(exportProject),
            mime: "text/x-rust",
            language: "rust",
          },
          ...setupFiles.map((f) => {
            const meta = setupFileTabMeta(f.filename)
            return {
              id: meta.id,
              label: meta.label,
              filename: f.filename,
              content: f.content,
              mime: f.mime,
              language: meta.language,
            }
          }),
          ...connectorFiles.map((f) => {
            const meta = setupFileTabMeta(f.filename)
            return {
              id: meta.id,
              label: meta.label,
              filename: f.filename,
              content: f.content,
              mime: f.mime,
              language: meta.language,
            }
          }),
        ]
        if (!cancelled) setFiles(next)
      } catch (e) {
        if (!cancelled) {
          setFiles([])
          setGenError((e as Error).message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, exportProject, project.name])

  const active = files.find((f) => f.id === tab) ?? files[0]
  const lineCount = active?.content.split("\n").length ?? 0
  const previewLanguage =
    active?.language === "typescript" || active?.language === "python" || active?.language === "rust"
      ? active.language
      : "plaintext"

  function downloadFile(file: ExportFile) {
    downloadBlob(file.filename, file.content, file.mime)
    setDownloaded(file.filename)
    setTimeout(() => setDownloaded(null), COPY_FEEDBACK_MS)
  }

  function downloadAll() {
    // AI : TODO export UI — bundle files into one .zip (JSZip or server route).
    for (const file of files) downloadBlob(file.filename, file.content, file.mime)
    setDownloaded("__all__")
    setTimeout(() => setDownloaded(null), COPY_FEEDBACK_MS)
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-[10px]"
        onClick={() => setOpen((o) => !o)}
        title="View and download pipeline code + setup files"
      >
        <Code2 className="h-3.5 w-3.5" />
        Export code
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 flex w-[min(44rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Pipeline export</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Pipeline code, gRPC connector, inference UI, and setup files. No secrets in generated code — wire env in your runner.
              </p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {genError ? (
            <div className="flex items-start gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>{genError}</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-16 font-mono text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating export…
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
                <div className="flex flex-wrap rounded-md border border-border p-0.5">
                  {TAB_ORDER.map((id) => {
                    const file = files.find((f) => f.id === id)
                    if (!file) return null
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setTab(id)}
                        className={cn(
                          "rounded px-2 py-1 font-mono text-[10px] transition-colors",
                          tab === id
                            ? "bg-secondary text-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {file.label}
                      </button>
                    )
                  })}
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">{lineCount} lines</span>
              </div>

              <div className="h-[min(28rem,50vh)] min-h-48">
                {active && tab === "ui" ? (
                  // AI : TODO security — sandbox allow-scripts runs export HTML in-browser; downloaded
                  // AI : inference_ui.html executes arbitrary JS when opened locally — document risk.
                  <iframe
                    title="Inference UI preview"
                    srcDoc={active.content}
                    className="h-full w-full border-0 bg-background"
                    sandbox="allow-scripts"
                  />
                ) : active ? (
                  <ReadonlyCodeViewer
                    value={active.content}
                    language={previewLanguage}
                    filename={active.filename}
                    badge="read-only"
                    className="h-full"
                  />
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
                <p className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  {files.length} files · start with SETUP.md · open inference_ui.html against connector
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 font-mono text-[10px]"
                    disabled={!files.length}
                    onClick={downloadAll}
                  >
                    {downloaded === "__all__" ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    {downloaded === "__all__" ? "Downloaded" : "Download all"}
                  </Button>
                  {active && (
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 font-mono text-[10px]"
                      disabled={!files.length}
                      onClick={() => downloadFile(active)}
                    >
                      {downloaded === active.filename ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      {downloaded === active.filename ? "Downloaded" : `Download ${active.filename}`}
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
