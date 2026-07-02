"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import {
  CODE_LANG_LABEL,
  CODE_LANG_LINT_HINT,
  CodeFileTabs,
  CodeLanguageSwitch,
  MonacoCodeEditor,
  type CodeViewerLanguage,
} from "@/components/code-viewer"
import { JSON_HEADERS } from "@/lib/api-client"
import { API_ROUTES } from "@/lib/api-routes"
import { useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import type { GeneratedTypeFile, ProjectTypesResponse } from "@/lib/project-types"

type FileKind = "models" | "pipeline"

const FILE_TABS: { id: FileKind; label: string }[] = [
  { id: "models", label: "Models" },
  { id: "pipeline", label: "Pipeline" },
]

const FILE_NAMES: Record<CodeViewerLanguage, Record<FileKind, string>> = {
  typescript: { models: "models.d.ts", pipeline: "pipeline_types.d.ts" },
  python: { models: "models.py", pipeline: "pipeline_types.py" },
}

// AI : server-generated TS/Python stubs for linting — includes pipeline step I/O types.
export function GeneratedTypesPanel() {
  const { project } = useStore()
  const [files, setFiles] = useState<GeneratedTypeFile[]>([])
  const [activeLang, setActiveLang] = useState<CodeViewerLanguage>("typescript")
  const [activeFileKind, setActiveFileKind] = useState<FileKind>("models")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const activeFileName = FILE_NAMES[activeLang][activeFileKind]

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(API_ROUTES.projectTypes(project.id), { headers: JSON_HEADERS })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? `Failed to load types (${res.status})`)
      }
      const data = (await res.json()) as ProjectTypesResponse
      setFiles(data.files)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load types")
    } finally {
      setLoading(false)
    }
  }, [project.id])

  useEffect(() => {
    void load()
  }, [load])

  const activeContent = useMemo(
    () => files.find((f) => f.name === activeFileName)?.content ?? "",
    [files, activeFileName],
  )

  const langOptions = (["typescript", "python"] as const).map((id) => ({
    id,
    label: CODE_LANG_LABEL[id],
  }))

  const fileTabs = FILE_TABS.map((tab) => ({
    ...tab,
    sublabel: FILE_NAMES[activeLang][tab.id],
  }))

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[oklch(0.14_0.004_264)]">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="font-mono text-[10px] text-muted-foreground">
          Generated stubs — lint with {CODE_LANG_LINT_HINT[activeLang]}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 font-mono text-[10px]"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>

      <div className="border-b border-border px-4 py-3">
        <CodeLanguageSwitch
          value={activeLang}
          onChange={setActiveLang}
          options={langOptions}
          variant="pill"
        />
      </div>

      <CodeFileTabs value={activeFileKind} onChange={setActiveFileKind} tabs={fileTabs} />

      {error ? (
        <div className="p-4 font-mono text-xs text-destructive">{error}</div>
      ) : loading && !files.length ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <MonacoCodeEditor value={activeContent} language={activeLang} readOnly />
      )}
    </div>
  )
}
