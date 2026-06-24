"use client"

import { useState, useRef } from "react"
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  FileJson,
  File,
  CheckCircle2,
  Loader2,
  Circle,
  Zap,
  RotateCcw,
} from "lucide-react"
import { usePipeline } from "@/lib/store"
import { allModelsToPydantic } from "@/lib/pydantic"
import type { InputType, PipelineModule } from "@/lib/types"
import { WindowHeader } from "@/components/window-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface DroppedFile {
  name: string
  type: InputType
}

type StepStatus = "idle" | "running" | "done" | "cached"

const INPUT_ICON: Record<InputType, typeof FileText> = {
  pdf: FileText,
  excel: FileSpreadsheet,
  word: FileText,
  json: FileJson,
  text: FileText,
  image: File,
}

function guessType(name: string): InputType {
  const n = name.toLowerCase()
  if (n.endsWith(".pdf")) return "pdf"
  if (n.endsWith(".xlsx") || n.endsWith(".csv")) return "excel"
  if (n.endsWith(".docx") || n.endsWith(".doc")) return "word"
  if (n.endsWith(".json")) return "json"
  if (n.match(/\.(png|jpg|jpeg|webp)$/)) return "image"
  return "text"
}

const SAMPLES: DroppedFile[] = [
  { name: "gdpr_articles.pdf", type: "pdf" },
  { name: "acme_corp_policies.docx", type: "word" },
]

export function Inference() {
  const { modules, models } = usePipeline()
  const [files, setFiles] = useState<DroppedFile[]>([])
  const [dragging, setDragging] = useState(false)
  const [statuses, setStatuses] = useState<Record<string, StepStatus>>({})
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const inputModules = modules.filter((m) => m.kind === "input")

  function addFiles(list: DroppedFile[]) {
    setFiles((prev) => {
      const merged = [...prev]
      for (const f of list) {
        if (!merged.some((x) => x.name === f.name)) merged.push(f)
      }
      return merged.slice(0, inputModules.length || 4)
    })
    setDone(false)
    setStatuses({})
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const dropped = Array.from(e.dataTransfer.files).map((f) => ({
      name: f.name,
      type: guessType(f.name),
    }))
    if (dropped.length) addFiles(dropped)
  }

  async function run() {
    if (files.length === 0) return
    setRunning(true)
    setDone(false)
    const initial: Record<string, StepStatus> = {}
    modules.forEach((m) => (initial[m.id] = "idle"))
    setStatuses(initial)

    for (const m of modules) {
      if (m.cached) {
        setStatuses((s) => ({ ...s, [m.id]: "cached" }))
        await wait(140)
        continue
      }
      setStatuses((s) => ({ ...s, [m.id]: "running" }))
      await wait(Math.min(1400, 300 + m.avgMs / 4))
      setStatuses((s) => ({ ...s, [m.id]: "done" }))
    }
    setRunning(false)
    setDone(true)
  }

  function reset() {
    setStatuses({})
    setDone(false)
  }

  const billed = modules
    .filter((m) => !m.cached)
    .reduce((a, m) => a + m.avgCostCents, 0)
  const saved = modules
    .filter((m) => m.cached)
    .reduce((a, m) => a + m.avgCostCents, 0)

  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        step="04 / Inference"
        title="Run Pipeline"
        description="Drop your documents onto the inputs and execute the pipeline end to end."
        actions={
          <div className="flex items-center gap-2">
            {done && (
              <Button size="sm" variant="outline" className="bg-transparent" onClick={reset}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
              </Button>
            )}
            <Button
              size="sm"
              onClick={run}
              disabled={running || files.length === 0}
            >
              {running ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="mr-1.5 h-3.5 w-3.5" />
              )}
              {running ? "Running…" : "Run pipeline"}
            </Button>
          </div>
        }
      />

      <div className="flex min-h-0 flex-1">
        {/* left: drop zone + inputs */}
        <div className="flex w-80 shrink-0 flex-col gap-4 border-r border-border p-4">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors",
              dragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50",
            )}
          >
            <UploadCloud
              className={cn(
                "h-6 w-6",
                dragging ? "text-primary" : "text-muted-foreground",
              )}
            />
            <p className="text-xs font-medium">Drop documents here</p>
            <p className="font-mono text-[10px] text-muted-foreground">
              pdf · excel · word · json
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const list = Array.from(e.target.files ?? []).map((f) => ({
                  name: f.name,
                  type: guessType(f.name),
                }))
                if (list.length) addFiles(list)
              }}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Sample files
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLES.map((s) => (
                <button
                  key={s.name}
                  onClick={() => addFiles([s])}
                  className="rounded-md border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground hover:border-primary hover:text-foreground"
                >
                  + {s.name}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Loaded ({files.length})
            </span>
            <div className="mt-2 space-y-1.5">
              {files.length === 0 && (
                <p className="text-xs text-muted-foreground">No files yet.</p>
              )}
              {files.map((f) => {
                const Icon = INPUT_ICON[f.type]
                return (
                  <div
                    key={f.name}
                    className="flex items-center gap-2 rounded-md border border-border px-2.5 py-2"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-chart-2" />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">
                      {f.name}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {f.type}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* center: execution trace */}
        <div className="min-w-0 flex-1 overflow-y-auto p-5">
          <div className="mx-auto max-w-2xl">
            <h3 className="mb-3 text-sm font-medium">Execution trace</h3>
            <div className="space-y-0">
              {modules.map((m, i) => {
                const st = statuses[m.id] ?? "idle"
                return (
                  <TraceRow
                    key={m.id}
                    index={i}
                    module={m}
                    status={st}
                    modelName={
                      models.find((x) => x.id === m.structureId)?.name
                    }
                    last={i === modules.length - 1}
                  />
                )
              })}
            </div>

            {done && (
              <div className="mt-5 rounded-lg border border-primary/40 bg-primary/5 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-medium">Output</h4>
                  <Badge className="ml-auto bg-primary/15 text-primary hover:bg-primary/15">
                    valid
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Summary label="billed" value={`$${(billed / 100).toFixed(2)}`} />
                  <Summary
                    label="cache saved"
                    value={`$${(saved / 100).toFixed(2)}`}
                    accent
                  />
                  <Summary label="schema" value="passed" />
                </div>
                <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-[oklch(0.14_0.004_264)] p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                  <code>{sampleOutput(models)}</code>
                </pre>
              </div>
            )}

            {!done && !running && (
              <p className="mt-4 font-mono text-[11px] text-muted-foreground">
                validating against:{" "}
                {models.map((m) => m.name).join(", ") || "—"}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function TraceRow({
  index,
  module: m,
  status,
  modelName,
  last,
}: {
  index: number
  module: PipelineModule
  status: StepStatus
  modelName?: string
  last: boolean
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <StatusDot status={status} />
        {!last && (
          <div
            className={cn(
              "w-px flex-1",
              status === "done" || status === "cached"
                ? "bg-primary/50"
                : "bg-border",
            )}
          />
        )}
      </div>
      <div className="flex-1 pb-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="text-sm font-medium">{m.label}</span>
          {m.cached && (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Zap className="h-2.5 w-2.5 text-primary" /> cached
            </Badge>
          )}
        </div>
        <p className="font-mono text-[10px] text-muted-foreground">
          {m.kind}
          {modelName ? ` → ${modelName}` : ""}
          {status === "running" ? " · executing…" : ""}
          {status === "cached" ? " · served from cache (0ms, $0.00)" : ""}
          {status === "done" ? ` · ${m.avgMs}ms` : ""}
        </p>
      </div>
    </div>
  )
}

function StatusDot({ status }: { status: StepStatus }) {
  if (status === "running")
    return <Loader2 className="h-4 w-4 animate-spin text-primary" />
  if (status === "done")
    return <CheckCircle2 className="h-4 w-4 text-primary" />
  if (status === "cached") return <Zap className="h-4 w-4 text-primary" />
  return <Circle className="h-4 w-4 text-muted-foreground/40" />
}

function Summary({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <p className="font-mono text-[10px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-mono text-sm",
          accent ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  )
}

function sampleOutput(models: { name: string }[]): string {
  const root = models[models.length - 1]?.name ?? "Result"
  return `{
  "model": "${root}",
  "results": [
    {
      "rule": { "rule_id": "GDPR-5.1.c", "severity": 4 },
      "compliant": false,
      "rationale": "No data minimization policy found in outline.",
      "liability_usd": 240000.0
    },
    {
      "rule": { "rule_id": "GDPR-17.1", "severity": 3 },
      "compliant": true,
      "rationale": "Right-to-erasure workflow documented.",
      "liability_usd": null
    }
  ]
}`
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
