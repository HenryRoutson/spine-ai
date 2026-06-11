"use client"

import { useState } from "react"
import {
  Plus,
  Trash2,
  ChevronRight,
  Database,
  Zap,
  FileInput,
  Shuffle,
  Brain,
  ShieldCheck,
  FileOutput,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import { usePipeline, uid } from "@/lib/store"
import {
  INPUT_TYPES,
  MODULE_META,
  type InputType,
  type ModuleKind,
  type PipelineModule,
} from "@/lib/types"
import { WindowHeader } from "@/components/window-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const KIND_ICON: Record<ModuleKind, typeof Brain> = {
  input: FileInput,
  extract: Database,
  transform: Shuffle,
  llm: Brain,
  validate: ShieldCheck,
  output: FileOutput,
}

const KIND_COLOR: Record<ModuleKind, string> = {
  input: "text-chart-2",
  extract: "text-chart-3",
  transform: "text-chart-3",
  llm: "text-primary",
  validate: "text-chart-2",
  output: "text-chart-4",
}

const ADDABLE: ModuleKind[] = [
  "input",
  "extract",
  "transform",
  "llm",
  "validate",
  "output",
]

export function PipelineBuilder() {
  const { modules, setModules, models } = usePipeline()
  const [selectedId, setSelectedId] = useState<string>(modules[0]?.id ?? "")

  const selected = modules.find((m) => m.id === selectedId)
  const totalMs = modules.reduce((a, m) => a + (m.cached ? 0 : m.avgMs), 0)
  const totalCost = modules.reduce(
    (a, m) => a + (m.cached ? 0 : m.avgCostCents),
    0,
  )
  const cachedCount = modules.filter((m) => m.cached).length

  function addModule(kind: ModuleKind) {
    const m: PipelineModule = {
      id: uid(),
      kind,
      label: MODULE_META[kind].label,
      cached: false,
      avgMs: kind === "llm" ? 2500 : 200,
      avgCostCents: kind === "llm" ? 20 : 0,
      inputType: kind === "input" ? "pdf" : undefined,
      structureId: kind === "llm" || kind === "validate" ? models[0]?.id : undefined,
      prompt: kind === "llm" ? "" : undefined,
    }
    setModules([...modules, m])
    setSelectedId(m.id)
  }

  function update(id: string, patch: Partial<PipelineModule>) {
    setModules(modules.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }

  function remove(id: string) {
    const next = modules.filter((m) => m.id !== id)
    setModules(next)
    if (selectedId === id) setSelectedId(next[0]?.id ?? "")
  }

  function move(id: string, dir: -1 | 1) {
    const i = modules.findIndex((m) => m.id === id)
    const j = i + dir
    if (j < 0 || j >= modules.length) return
    const next = [...modules]
    ;[next[i], next[j]] = [next[j], next[i]]
    setModules(next)
  }

  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        step="02 / Pipeline"
        title="Linear Pipeline"
        description="Compose modules from input to output. Cache steps to avoid recomputing and re-billing."
        actions={
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span className="text-muted-foreground">
              ~{(totalMs / 1000).toFixed(1)}s
            </span>
            <span className="text-muted-foreground">
              ${(totalCost / 100).toFixed(2)}/run
            </span>
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Zap className="h-3 w-3 text-primary" /> {cachedCount} cached
            </Badge>
          </div>
        }
      />

      <div className="flex min-h-0 flex-1">
        {/* canvas */}
        <div className="min-w-0 flex-1 overflow-auto">
          <div className="flex min-h-full flex-col items-center gap-0 px-6 py-8">
            <PipelineNode label="Start" subtle />
            {modules.map((m, i) => {
              const Icon = KIND_ICON[m.kind]
              return (
                <div key={m.id} className="flex flex-col items-center">
                  <Connector />
                  <button
                    onClick={() => setSelectedId(m.id)}
                    className={cn(
                      "group relative flex w-72 items-center gap-3 rounded-lg border bg-card px-3.5 py-3 text-left transition-colors",
                      m.id === selectedId
                        ? "border-primary"
                        : "border-border hover:border-muted-foreground/40",
                    )}
                  >
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <Icon className={cn("h-4 w-4 shrink-0", KIND_COLOR[m.kind])} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.label}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {m.kind}
                        {m.inputType ? ` · ${m.inputType}` : ""}
                        {m.structureId
                          ? ` · ${models.find((x) => x.id === m.structureId)?.name ?? "?"}`
                          : ""}
                      </p>
                    </div>
                    {m.cached && (
                      <Zap className="h-3.5 w-3.5 shrink-0 text-primary" />
                    )}
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </button>
                </div>
              )
            })}
            <Connector />
            <PipelineNode label="End" subtle />

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {ADDABLE.map((k) => {
                const Icon = KIND_ICON[k]
                return (
                  <Button
                    key={k}
                    variant="outline"
                    size="sm"
                    className="bg-transparent"
                    onClick={() => addModule(k)}
                  >
                    <Icon className={cn("mr-1.5 h-3.5 w-3.5", KIND_COLOR[k])} />
                    {MODULE_META[k].label}
                  </Button>
                )
              })}
            </div>
          </div>
        </div>

        {/* inspector */}
        <aside className="flex w-80 shrink-0 flex-col border-l border-border">
          {selected ? (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {MODULE_META[selected.kind].label} module
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => move(selected.id, -1)}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => move(selected.id, 1)}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(selected.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <Field label="Label">
                <Input
                  value={selected.label}
                  onChange={(e) => update(selected.id, { label: e.target.value })}
                  className="h-8 text-sm"
                />
              </Field>

              {selected.kind === "input" && (
                <Field label="Input type">
                  <Select
                    value={selected.inputType}
                    onValueChange={(v) =>
                      update(selected.id, { inputType: v as InputType })
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INPUT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              {(selected.kind === "llm" || selected.kind === "validate") && (
                <Field label="Output structure">
                  <Select
                    value={selected.structureId}
                    onValueChange={(v) =>
                      update(selected.id, { structureId: v })
                    }
                  >
                    <SelectTrigger className="h-8 font-mono text-xs">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((m) => (
                        <SelectItem
                          key={m.id}
                          value={m.id}
                          className="font-mono text-xs"
                        >
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              {selected.kind === "llm" && (
                <Field label="Prompt">
                  <Textarea
                    value={selected.prompt ?? ""}
                    onChange={(e) =>
                      update(selected.id, { prompt: e.target.value })
                    }
                    placeholder="Instruction for this step…"
                    className="min-h-24 text-xs leading-relaxed"
                  />
                </Field>
              )}

              <div className="mt-4 flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2.5">
                <div>
                  <p className="text-xs font-medium">Cache results</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    skip recompute & billing
                  </p>
                </div>
                <Switch
                  checked={selected.cached}
                  onCheckedChange={(v) => update(selected.id, { cached: v })}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Stat label="avg latency" value={`${selected.avgMs}ms`} />
                <Stat
                  label="avg cost"
                  value={`$${(selected.avgCostCents / 100).toFixed(2)}`}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center">
              <p className="text-xs text-muted-foreground">
                Add a module and select it to configure.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function Connector() {
  return <div className="h-6 w-px bg-border" />
}

function PipelineNode({ label, subtle }: { label: string; subtle?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-wider",
        subtle
          ? "border-border text-muted-foreground"
          : "border-primary text-primary",
      )}
    >
      {label}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-3">
      <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <p className="font-mono text-[10px] text-muted-foreground">{label}</p>
      <p className="font-mono text-sm">{value}</p>
    </div>
  )
}
