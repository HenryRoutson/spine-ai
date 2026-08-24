"use client"

// AI : reusable .env import — file pick, paste, preview, bulk POST /api/secrets.
import { useMemo, useRef, useState } from "react"
import { FileUp, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson } from "@/lib/api-client"
import { isDemoMode } from "@/lib/demo-mode"
import { parseEnvFileText, type env_entry } from "@/lib/parse-env-file"
import { notifySecretsChanged } from "@/lib/secrets-changed"
import type { SecretScope } from "@/lib/secret-scope"
import { FileDropZone } from "@/components/file-drop-zone"

type EnvSecretsImportProps = {
  projectId: string
  teamId?: string | null
  canEditTeam?: boolean
  projectPrefix?: string | null
  /** When set, only these logical secret names are imported */
  filterNames?: string[]
  compact?: boolean
  defaultScope?: SecretScope
  onImported?: () => void
}

type ImportApiResponse = {
  imported: { name: string; scope: string }[]
  count: number
}

export function EnvSecretsImport({
  projectId,
  teamId = null,
  canEditTeam = false,
  projectPrefix = null,
  filterNames,
  compact = false,
  defaultScope = "project",
  onImported,
}: EnvSecretsImportProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [scope, setScope] = useState<SecretScope>(defaultScope)
  const [paste, setPaste] = useState("")
  const [entries, setEntries] = useState<env_entry[]>([])
  const [skipped, setSkipped] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const filterSet = useMemo(
    () => (filterNames?.length ? new Set(filterNames) : null),
    [filterNames],
  )

  const readyEntries = useMemo(
    () => (filterSet ? entries.filter((e) => filterSet.has(e.name)) : entries),
    [entries, filterSet],
  )

  function loadText(text: string) {
    const parsed = parseEnvFileText(text, { projectPrefix })
    setEntries(parsed.entries)
    setSkipped(parsed.skipped)
    setResult(null)
    setError(null)
  }

  async function readFile(file: File) {
    try {
      const text = await file.text()
      setPaste(text)
      loadText(text)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function importEntries() {
    if (!readyEntries.length) return
    setImporting(true)
    setError(null)
    setResult(null)
    try {
      const data = await apiJson<ImportApiResponse>(API_ROUTES.secrets, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: readyEntries,
          scope,
          projectId,
          teamId: scope === "team" ? teamId ?? undefined : undefined,
          linkToProject: scope === "personal",
        }),
      })
      setResult(`Imported ${data.count} ${data.count === 1 ? "secret" : "secrets"}`)
      setPaste("")
      setEntries([])
      setSkipped([])
      notifySecretsChanged()
      onImported?.()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setImporting(false)
    }
  }

  if (isDemoMode()) return null

  const scopeDisabled = scope === "team" && (!teamId || !canEditTeam)

  return (
    <div className={compact ? "space-y-2" : "space-y-3 rounded-md border border-border bg-muted/10 px-3 py-3"}>
      {!compact ? (
        <div>
          <p className="text-[11px] font-medium text-foreground">Import from .env</p>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            Drop a .env file or paste contents — keys import as{" "}
            {scope === "project" && projectPrefix ? `${projectPrefix}_NAME` : "logical names"}.
          </p>
        </div>
      ) : (
        <p className="font-mono text-[10px] text-muted-foreground">Or import from a .env file</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["project", "This project"],
            ["personal", "Personal (link)"],
            ["team", "Team"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            disabled={id === "team" && (!teamId || !canEditTeam)}
            onClick={() => setScope(id)}
            className={`rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors ${
              scope === id
                ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {compact ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 font-mono text-[11px]"
            disabled={importing}
            onClick={() => inputRef.current?.click()}
          >
            <FileUp className="h-3.5 w-3.5" />
            Choose .env
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".env,.env.local,.env.example,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void readFile(file)
              e.target.value = ""
            }}
          />
        </div>
      ) : (
        <FileDropZone
          compact
          multiple={false}
          accept=".env,.env.local,.env.example,text/plain"
          label="Drop .env here"
          browseLabel="Choose .env"
          disabled={importing}
          onFiles={(files) => {
            const file = files[0]
            if (file) void readFile(file)
          }}
        />
      )}

      <textarea
        value={paste}
        onChange={(e) => {
          setPaste(e.target.value)
          loadText(e.target.value)
        }}
        placeholder="Or paste .env contents…"
        rows={compact ? 3 : 4}
        className="w-full resize-y rounded-md border border-border bg-background px-2.5 py-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground"
        spellCheck={false}
      />

      {readyEntries.length > 0 ? (
        <div className="space-y-1">
          <p className="font-mono text-[10px] text-muted-foreground">
            {readyEntries.length} {readyEntries.length === 1 ? "key" : "keys"} ready
            {filterSet && entries.length > readyEntries.length
              ? ` (${entries.length - readyEntries.length} skipped — not required for this pipeline)`
              : ""}
          </p>
          <ul className="max-h-28 overflow-y-auto rounded-md border border-border divide-y divide-border">
            {readyEntries.map((entry) => (
              <li key={entry.name} className="px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground">
                {entry.name} · …{entry.value.slice(-4)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {skipped.length > 0 ? (
        <p className="font-mono text-[10px] text-muted-foreground">
          Skipped invalid keys: {skipped.slice(0, 6).join(", ")}
          {skipped.length > 6 ? ` +${skipped.length - 6} more` : ""}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={importing || !readyEntries.length || scopeDisabled}
          onClick={() => void importEntries()}
        >
          {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
          Import {readyEntries.length ? readyEntries.length : ""}
        </Button>
        {result ? <span className="font-mono text-[10px] text-chart-2">{result}</span> : null}
      </div>

      {error ? <p className="font-mono text-[11px] text-destructive">{error}</p> : null}
    </div>
  )
}
