"use client"
// AI : parity ids — pipeline.export
// AI : bundle is POST /api/pipeline-export/documents — never import lib/server generators here.

// AI : TODO export UI — bundled Supabase SQL + Next.js inference shell alongside connector files.

import { useEffect, useMemo, useState } from "react"
import { zipSync } from "fflate"
import { AlertTriangle, Check, Code2, Download, FileText, Loader2, X } from "lucide-react"
import { ReadonlyCodeViewer, type CodeViewerLanguage } from "@/components/code-viewer"
import { Button } from "@/components/ui/button"
import { apiJson, JSON_HEADERS } from "@/lib/api-client"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"
import { downloadBlob } from "@/lib/download-blob"
import { API_ROUTES } from "@/lib/api-routes"
import type { HostedSiteOptions } from "@/lib/shared-link-types"
import type { Project, StructureModel, TypeAlias, PipelineModule } from "@/lib/types"
import { cn } from "@/lib/utils"

type ExportTabId =
  | "typescript"
  | "python"
  | "rust"
  | "go"
  | "baml"
  | "windmill"
  | "json-schema"
  | "proto"
  | "ui"
  | "hosted-html"
  | "hosted-auth"
  | "hosted-css"
  | "hosted-env"
  | "connector-ts"
  | "connector-py"
  | "env"
  | "readme"
  | "setup"
  | "requirements"
  | "run-ts"
  | "run-py"

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
  "windmill",
  "json-schema",
  "python",
  "rust",
  "go",
  "baml",
  "proto",
  "ui",
  "hosted-html",
  "hosted-auth",
  "hosted-css",
  "hosted-env",
  "connector-ts",
  "connector-py",
  "env",
  "requirements",
  "run-ts",
  "run-py",
  "readme",
  "setup",
]

function setupFileTabMeta(filename: string): { id: ExportTabId; label: string; language?: ExportFile["language"] } {
  if (filename.endsWith("_pipeline.ts")) return { id: "typescript", label: "TypeScript", language: "typescript" }
  if (filename.endsWith("_pipeline.py")) return { id: "python", label: "Python", language: "python" }
  if (filename.endsWith("_pipeline.rs")) return { id: "rust", label: "Rust", language: "rust" }
  if (filename.endsWith("_pipeline.go")) return { id: "go", label: "Go", language: "go" }
  if (filename.endsWith("_pipeline.baml")) return { id: "baml", label: "BAML", language: "baml" }
  if (filename.endsWith("_flow.json")) return { id: "windmill", label: "Windmill OpenFlow", language: "json" }
  if (filename.endsWith("_schema.json")) return { id: "json-schema", label: "JSON Schema", language: "json" }
  switch (filename) {
    case ".env.example":
      return { id: "env", label: ".env.example", language: "plaintext" }
    case "requirements.txt":
      return { id: "requirements", label: "requirements.txt", language: "plaintext" }
    case "README.md":
      return { id: "readme", label: "README.md", language: "markdown" }
    case "SETUP.md":
      return { id: "setup", label: "SETUP.md", language: "markdown" }
    case "run_example.ts":
      return { id: "run-ts", label: "run_example.ts", language: "typescript" }
    case "run_example.py":
      return { id: "run-py", label: "run_example.py", language: "python" }
    case "pipeline_connector.proto":
      return { id: "proto", label: "connector.proto", language: "plaintext" }
    case "inference_ui.html":
      return { id: "ui", label: "inference UI", language: "plaintext" }
    case "hosted/index.html":
      return { id: "hosted-html", label: "hosted app", language: "plaintext" }
    case "hosted/auth.html":
      return { id: "hosted-auth", label: "hosted sign-in", language: "plaintext" }
    case "hosted/styles.css":
      return { id: "hosted-css", label: "hosted CSS", language: "plaintext" }
    case "hosted/.env.example":
      return { id: "hosted-env", label: "hosted .env", language: "plaintext" }
    case "connector_server.ts":
      return { id: "connector-ts", label: "connector (TS)", language: "typescript" }
    case "connector_server.py":
      return { id: "connector-py", label: "connector (Py)", language: "python" }
    default:
      if (/^hosted\/.+\.html$/.test(filename)) {
        return { id: `hosted:${filename}` as ExportTabId, label: filename.replace(/^hosted\//, ""), language: "plaintext" }
      }
      return { id: "setup", label: filename, language: "plaintext" }
  }
}

export function PipelineExportDialog({
  project,
  modules,
  models,
  typeAliases,
  siteOptions,
}: {
  project: Project
  modules: PipelineModule[]
  models: StructureModel[]
  typeAliases: TypeAlias[]
  siteOptions?: HostedSiteOptions
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
  const exportBody = useMemo(
    () => (siteOptions ? { ...exportProject, siteOptions } : exportProject),
    [exportProject, siteOptions],
  )

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setGenError(null)
    void (async () => {
      try {
        const bundle = await apiJson<{ filename: string; content: string; mime: string }[]>(
          API_ROUTES.pipelineExportDocuments,
          {
            method: "POST",
            headers: JSON_HEADERS,
            body: JSON.stringify(exportBody),
          },
        )
        const next: ExportFile[] = bundle.map((f) => {
          const meta = setupFileTabMeta(f.filename)
          return {
            id: meta.id,
            label: meta.label,
            filename: f.filename,
            content: f.content,
            mime: f.mime,
            language: meta.language,
          }
        })
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
  }, [open, exportBody])

  const active = files.find((f) => f.id === tab) ?? files[0]
  const lineCount = active?.content.split("\n").length ?? 0
  const previewLanguage =
    active?.language === "typescript" ||
    active?.language === "python" ||
    active?.language === "rust" ||
    active?.language === "go" ||
    active?.language === "baml"
      ? active.language
      : "plaintext"

  function downloadFile(file: ExportFile) {
    downloadBlob(file.filename, file.content, file.mime)
    setDownloaded(file.filename)
    setTimeout(() => setDownloaded(null), COPY_FEEDBACK_MS)
  }

  function downloadAll() {
    if (!files.length) return
    const enc = new TextEncoder()
    const entries: Record<string, Uint8Array> = {}
    for (const file of files) entries[file.filename] = enc.encode(file.content)
    const zipped = zipSync(entries)
    downloadBlob(
      `${projectSlug(project.name)}_export.zip`,
      zipped,
      "application/zip",
    )
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
        title="View and download pipeline code, hosted app, and setup files"
        spineId="pipeline.export"
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
                Pipeline code, hosted app (HTML/CSS + env placeholders), gRPC connector, inference UI, sample documents, and setup files. No secrets in generated code — wire env in your runner.
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
                  {files
                    .filter((f) => !TAB_ORDER.includes(f.id))
                    .map((file) => (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => setTab(file.id)}
                        className={cn(
                          "rounded px-2 py-1 font-mono text-[10px] transition-colors",
                          tab === file.id
                            ? "bg-secondary text-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {file.label}
                      </button>
                    ))}
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
                  {files.length} files · start with README.md · hosted/ + documents/ · open inference_ui.html against connector
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
