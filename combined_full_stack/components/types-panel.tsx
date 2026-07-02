"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { JSON_HEADERS } from "@/lib/api-client"
import { API_ROUTES } from "@/lib/api-routes"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { GeneratedTypeFile, ProjectTypesResponse } from "@/lib/project-types"

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center font-mono text-xs text-muted-foreground">
      Loading editor…
    </div>
  ),
})

type LangId = "typescript" | "python"
type FileKind = "models" | "pipeline"

type LangOption = {
  id: LangId
  label: string
  hint: string
  monacoLanguage: LangId
  files: Record<FileKind, string>
}

const LANG_OPTIONS: LangOption[] = [
  {
    id: "typescript",
    label: "TypeScript",
    hint: "tsc",
    monacoLanguage: "typescript",
    files: { models: "models.d.ts", pipeline: "pipeline_types.d.ts" },
  },
  {
    id: "python",
    label: "Python",
    hint: "pyright",
    monacoLanguage: "python",
    files: { models: "models.py", pipeline: "pipeline_types.py" },
  },
]

const FILE_TABS: { id: FileKind; label: string }[] = [
  { id: "models", label: "Models" },
  { id: "pipeline", label: "Pipeline" },
]

export function TypesPanel() {
  const { project } = useStore()
  const [files, setFiles] = useState<GeneratedTypeFile[]>([])
  const [activeLang, setActiveLang] = useState<LangId>("typescript")
  const [activeFileKind, setActiveFileKind] = useState<FileKind>("models")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const langOption = LANG_OPTIONS.find((l) => l.id === activeLang) ?? LANG_OPTIONS[0]!
  const activeFileName = langOption.files[activeFileKind]

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

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Pipeline types</h2>
          <p className="font-mono text-[10px] text-muted-foreground">
            Generated stubs — lint with {langOption.hint}
          </p>
        </div>
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

      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Language</span>
        <div className="flex gap-2">
          {LANG_OPTIONS.map((lang) => {
            const selected = activeLang === lang.id
            return (
              <button
                key={lang.id}
                type="button"
                title={lang.label}
                onClick={() => setActiveLang(lang.id)}
                className={cn(
                  "rounded-md border px-2.5 py-1.5 font-mono text-[11px] transition-colors",
                  selected
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-secondary/30 text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground",
                )}
              >
                {lang.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex border-b border-border px-4">
        {FILE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveFileKind(tab.id)}
            className={cn(
              "border-b-2 px-3 py-2 font-mono text-[10px] transition-colors",
              activeFileKind === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            <span className="ml-1.5 text-muted-foreground">{langOption.files[tab.id]}</span>
          </button>
        ))}
      </div>

      {error ? (
        <div className="p-4 font-mono text-xs text-destructive">{error}</div>
      ) : loading && !files.length ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <MonacoEditor
            height="100%"
            language={langOption.monacoLanguage}
            value={activeContent}
            theme="vs-dark"
            options={{
              readOnly: true,
              fontSize: 12,
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              lineNumbers: "on",
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              wordWrap: "off",
              automaticLayout: true,
              padding: { top: 12, bottom: 12 },
            }}
          />
        </div>
      )}
    </div>
  )
}
