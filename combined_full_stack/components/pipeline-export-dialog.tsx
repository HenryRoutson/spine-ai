"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Check, Code2, Download, Loader2, X } from "lucide-react"
import { CODE_LANG_LABEL, ReadonlyCodeViewer, type CodeViewerLanguage } from "@/components/code-viewer"
import { Button } from "@/components/ui/button"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"
import { downloadBlob } from "@/lib/download-blob"
import type { Project, StructureModel, TypeAlias } from "@/lib/types"
import type { PipelineModule } from "@/lib/types"
import { cn } from "@/lib/utils"

type ExportLang = CodeViewerLanguage

function projectSlug(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "pipeline"
  )
}

type ExportSource = {
  language: ExportLang
  filename: string
  content: string
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
  const [lang, setLang] = useState<ExportLang>("typescript")
  const [downloaded, setDownloaded] = useState<ExportLang | null>(null)
  const [genError, setGenError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sources, setSources] = useState<ExportSource[]>([])

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
        const slug = projectSlug(project.name)
        const next: ExportSource[] = [
          {
            language: "typescript",
            filename: `${slug}_pipeline.ts`,
            content: generatePipelineSourceTs(exportProject),
          },
          {
            language: "python",
            filename: `${slug}_pipeline.py`,
            content: generatePipelineSourcePy(exportProject),
          },
        ]
        if (!cancelled) setSources(next)
      } catch (e) {
        if (!cancelled) {
          setSources([])
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

  const active = sources.find((s) => s.language === lang) ?? sources[0]
  const lineCount = active?.content.split("\n").length ?? 0

  function download(language: ExportLang) {
    const source = sources.find((s) => s.language === language)
    if (!source) return
    const mime = language === "typescript" ? "text/typescript" : "text/x-python"
    downloadBlob(source.filename, source.content, mime)
    setDownloaded(language)
    setTimeout(() => setDownloaded(null), COPY_FEEDBACK_MS)
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 text-[10px]"
        onClick={() => setOpen((o) => !o)}
        title="View and download pipeline as TypeScript or Python"
      >
        <Code2 className="h-3.5 w-3.5" />
        Export code
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 flex w-[min(42rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Pipeline code export</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Equivalent single-file representation — types, steps, and orchestrator. No env keys included.
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
              <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
                <div className="flex rounded-md border border-border p-0.5">
                  {(["typescript", "python"] as const).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setLang(id)}
                      className={cn(
                        "rounded px-2.5 py-1 font-mono text-[10px] transition-colors",
                        lang === id
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {CODE_LANG_LABEL[id]}
                    </button>
                  ))}
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">{lineCount} lines</span>
              </div>

              <div className="h-[min(28rem,50vh)] min-h-48">
                {active && (
                  <ReadonlyCodeViewer
                    value={active.content}
                    language={active.language}
                    filename={active.filename}
                    badge="read-only"
                    className="h-full"
                  />
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 font-mono text-[10px]"
                  disabled={!sources.length}
                  onClick={() => download("typescript")}
                >
                  {downloaded === "typescript" ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  {downloaded === "typescript" ? "Downloaded" : "Download TS"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 font-mono text-[10px]"
                  disabled={!sources.length}
                  onClick={() => download("python")}
                >
                  {downloaded === "python" ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  {downloaded === "python" ? "Downloaded" : "Download Py"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
