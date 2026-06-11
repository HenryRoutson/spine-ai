"use client"

import { useState } from "react"
import {
  Plus,
  Trash2,
  ChevronRight,
  Zap,
  FileInput,
  Shuffle,
  Sparkle,
  FileOutput,
  ArrowUp,
  ArrowDown,
  FileText,
  Merge,
  Code2,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react"
import { useStore, uid } from "@/lib/store"
import { computeInvalid } from "@/lib/validity"
import { moduleMetrics } from "@/lib/billing"
import { combinePairIds, segmentPipeline } from "@/lib/pipeline-layout"
import {
  INPUT_TYPES,
  MODULE_META,
  type InputType,
  type ModuleKind,
  type PipelineModule,
  type StructureModel,
} from "@/lib/types"
import { WindowHeader } from "@/components/window-header"
import { ModelSelector } from "@/components/model-selector"
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

// AI : batch llm is a 2×2 sparkle grid so it reads as "many calls" vs single Sparkle.
function BatchSparkleIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-grid grid-cols-2 gap-px leading-none [&_svg]:size-[42%]",
        className,
      )}
    >
      <Sparkle />
      <Sparkle />
      <Sparkle />
      <Sparkle />
    </span>
  )
}

type ModuleIcon = LucideIcon | typeof BatchSparkleIcon

const KIND_ICON: Record<ModuleKind, ModuleIcon> = {
  input: FileInput,
  "doc-to-text": FileText,
  llm: Sparkle,
  "llm-batch": BatchSparkleIcon,
  transform: Shuffle,
  combine: Merge,
  "custom-code": Code2,
  output: FileOutput,
}

const KIND_COLOR: Record<ModuleKind, string> = {
  input: "text-chart-2",
  "doc-to-text": "text-chart-3",
  llm: "text-primary",
  "llm-batch": "text-primary",
  transform: "text-chart-3",
  combine: "text-chart-3",
  "custom-code": "text-chart-1",
  output: "text-chart-4",
}

const ADDABLE: ModuleKind[] = [
  "input",
  "doc-to-text",
  "llm",
  "llm-batch",
  "transform",
  "combine",
  "custom-code",
  "output",
]

// AI : llm + llm-batch share the prompt/model inspector fields and add-defaults.
const LLM_KINDS: ModuleKind[] = ["llm", "llm-batch"]

function modelName(models: StructureModel[], id?: string) {
  return models.find((m) => m.id === id)?.name
}

export function PipelineBuilder() {
  const { modules, setModules, models, model: globalModel, runs } = useStore()
  const [selectedId, setSelectedId] = useState<string>(modules[0]?.id ?? "")

  const selected = modules.find((m) => m.id === selectedId)
  // AI : de-mocked — invalid check is the shared server definition; latency/cost are
  // AI : recomputed from real run history (falls back to seeded avgs before any run).
  const invalid = computeInvalid(modules)
  const metrics = moduleMetrics(runs)
  const avgMsOf = (m: PipelineModule) => metrics.get(m.id)?.avgMs ?? m.avgMs
  const avgCostOf = (m: PipelineModule) => metrics.get(m.id)?.avgCostCents ?? m.avgCostCents
  const totalMs = modules.reduce((a, m) => a + (m.cached ? 0 : avgMsOf(m)), 0)
  const totalCost = modules.reduce((a, m) => a + (m.cached ? 0 : avgCostOf(m)), 0)
  const cachedCount = modules.filter((m) => m.cached).length

  function addModule(kind: ModuleKind) {
    const isLlm = LLM_KINDS.includes(kind)
    const m: PipelineModule = {
      id: uid(),
      kind,
      label: MODULE_META[kind].label,
      cached: false,
      avgMs: isLlm ? 2500 : kind === "doc-to-text" ? 450 : 200,
      avgCostCents: isLlm ? 8 : kind === "doc-to-text" ? 1 : 0,
      inputType: kind === "input" ? "pdf" : undefined,
      outStructureId: kind === "input" || isLlm ? models[0]?.id : undefined,
      inStructureId: kind !== "input" ? models[0]?.id : undefined,
      prompt: isLlm ? "" : undefined,
      code: kind === "custom-code" ? "(input) => input" : undefined,
      model: isLlm ? globalModel : undefined,
    }
    setModules([...modules, m])
    setSelectedId(m.id)
  }

  function update(id: string, patch: Partial<PipelineModule>) {
    setModules(modules.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }

  function remove(id: string) {
    const drop = new Set(combinePairIds(modules, id))
    const next = modules.filter((m) => !drop.has(m.id))
    setModules(next)
    if (drop.has(selectedId)) setSelectedId(next[0]?.id ?? "")
  }

  function move(id: string, dir: -1 | 1) {
    const ids = combinePairIds(modules, id)
    const block = ids.map((x) => modules.find((m) => m.id === x)!)
    const rest = modules.filter((m) => !ids.includes(m.id))
    const at = modules.findIndex((m) => m.id === ids[0])
    const insertAt = dir === -1 ? at - 1 : at + ids.length
    if (insertAt < 0 || insertAt > rest.length) return
    const next = [...rest.slice(0, insertAt), ...block, ...rest.slice(insertAt)]
    setModules(next)
  }

  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        step="02 / Pipeline"
        title="Linear Pipeline"
        description="Each step declares its input and output model. Mismatched I/O is flagged — there is no explicit validation step."
        actions={
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span className="text-muted-foreground">~{(totalMs / 1000).toFixed(1)}s avg</span>
            <span className="text-muted-foreground">${(totalCost / 100).toFixed(2)}/run</span>
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Zap className="h-3 w-3 text-primary" /> {cachedCount} cached
            </Badge>
            {invalid.size > 0 && (
              <Badge variant="outline" className="gap-1 border-destructive/50 text-[10px] text-destructive">
                <AlertTriangle className="h-3 w-3" /> {invalid.size} invalid
              </Badge>
            )}
          </div>
        }
      />

      <div className="flex min-h-0 flex-1">
        {/* canvas */}
        <div className="min-w-0 flex-1 overflow-auto">
          <div className="flex min-h-full flex-col items-center gap-0 px-6 py-8">
            <PipelineNode label="Start" subtle />
            {segmentPipeline(modules).map((seg) => {
              if (seg.kind === "combine") {
                const { combine, input, index } = seg
                const isInvalid = invalid.has(combine.id)
                const pipelineModel = modelName(models, combine.inStructureId)
                const outModel = modelName(models, combine.outStructureId)
                const groupSelected = selectedId === combine.id || selectedId === input.id
                return (
                  <div key={combine.id} className="flex flex-col items-center">
                    <Connector invalid={isInvalid} />
                    <div
                      className={cn(
                        "w-80 rounded-lg border-2 border-dashed px-3.5 py-3 transition-colors",
                        isInvalid
                          ? "border-destructive/70 bg-destructive/5"
                          : groupSelected
                            ? "border-primary bg-primary/5"
                            : "border-chart-3/40 bg-chart-3/5",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedId(combine.id)}
                        className="flex w-full items-center gap-2 text-left"
                      >
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <KindIcon kind="combine" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{combine.label}</p>
                          <p className="truncate font-mono text-[10px] text-muted-foreground">
                            {pipelineModel ?? "pipeline"}
                            <span className="text-muted-foreground/60"> + </span>
                            document
                            <span className="text-muted-foreground/60"> → </span>
                            {outModel ?? "·"}
                          </p>
                        </div>
                        {combine.cached && <Zap className="h-3.5 w-3.5 shrink-0 text-primary" />}
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </button>
                      {combine.note && (
                        <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
                          {combine.note}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedId(input.id)}
                        className={cn(
                          "mt-2 flex w-full items-center gap-3 rounded-md border bg-card px-3 py-2.5 text-left transition-colors",
                          selectedId === input.id
                            ? "border-primary"
                            : "border-border hover:border-muted-foreground/40",
                        )}
                      >
                        <KindIcon kind="input" size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{input.label}</p>
                          <p className="truncate font-mono text-[10px] text-muted-foreground">
                            {input.inputType ?? "·"}
                            <span className="text-muted-foreground/60"> → </span>
                            {modelName(models, input.outStructureId) ?? "·"}
                          </p>
                        </div>
                      </button>
                    </div>
                    {isInvalid && (
                      <p className="mt-1 max-w-80 text-center font-mono text-[10px] text-destructive">
                        combine expects {pipelineModel}, upstream emits{" "}
                        {modelName(models, modules[index - 2]?.outStructureId) ?? "?"}
                      </p>
                    )}
                  </div>
                )
              }

              const m = seg.module
              const i = seg.index
              const isInvalid = invalid.has(m.id)
              return (
                <div key={m.id} className="flex flex-col items-center">
                  <Connector invalid={isInvalid} />
                  <button
                    onClick={() => setSelectedId(m.id)}
                    className={cn(
                      "group relative flex w-80 items-center gap-3 rounded-lg border bg-card px-3.5 py-3 text-left transition-colors",
                      isInvalid
                        ? "border-destructive/70"
                        : m.id === selectedId
                          ? "border-primary"
                          : "border-border hover:border-muted-foreground/40",
                    )}
                  >
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <KindIcon kind={m.kind} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.label}</p>
                      <p className="truncate font-mono text-[10px] text-muted-foreground">
                        {modelName(models, m.inStructureId) ?? (m.inputType ?? "·")}
                        <span className="text-muted-foreground/60"> → </span>
                        {modelName(models, m.outStructureId) ?? "·"}
                      </p>
                    </div>
                    {m.kind === "llm" && m.model && (
                      <Badge variant="outline" className="shrink-0 font-mono text-[9px]">
                        {m.model}
                      </Badge>
                    )}
                    {m.cached && <Zap className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    {isInvalid ? (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                  {isInvalid && (
                    <p className="mt-1 max-w-80 text-center font-mono text-[10px] text-destructive">
                      input expects {modelName(models, m.inStructureId)}, upstream emits{" "}
                      {modelName(models, modules[i - 1]?.outStructureId) ?? "?"}
                    </p>
                  )}
                </div>
              )
            })}
            <Connector />
            <PipelineNode label="End" subtle />

            <div className="mt-6 flex flex-wrap items-start justify-center gap-2">
              {ADDABLE.map((k) => {
                const Icon = KIND_ICON[k]
                return (
                  <Button
                    key={k}
                    variant="outline"
                    size="sm"
                    className="h-auto flex-col gap-1 bg-transparent px-3 py-2"
                    onClick={() => addModule(k)}
                  >
                    <Icon className={cn("h-4 w-4", KIND_COLOR[k])} />
                    <span className="max-w-16 text-center text-[10px] leading-tight">
                      {MODULE_META[k].label}
                    </span>
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
                  {MODULE_META[selected.kind].label}
                </span>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(selected.id, -1)}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(selected.id, 1)}>
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

              <p className="mb-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
                {MODULE_META[selected.kind].description}
              </p>

              <Field label="Label">
                <Input
                  value={selected.label}
                  onChange={(e) => update(selected.id, { label: e.target.value })}
                  className="h-8 text-sm"
                />
              </Field>

              {(selected.kind === "doc-to-text" ||
                selected.kind === "combine" ||
                LLM_KINDS.includes(selected.kind)) && (
                <Field label="Annotation / purpose">
                  <Input
                    value={selected.note ?? ""}
                    onChange={(e) => update(selected.id, { note: e.target.value })}
                    placeholder="describe what this step does…"
                    className="h-8 text-xs"
                  />
                </Field>
              )}

              {selected.kind === "input" && (
                <Field label="Input type">
                  <Select
                    value={selected.inputType}
                    onValueChange={(v) => update(selected.id, { inputType: v as InputType })}
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

              {selected.kind !== "input" && (
                <Field label="Input model">
                  <Select
                    value={selected.inStructureId}
                    onValueChange={(v) => update(selected.id, { inStructureId: v ?? undefined })}
                  >
                    <SelectTrigger className="h-8 font-mono text-xs">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="font-mono text-xs">
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              <Field label="Output model">
                <Select
                  value={selected.outStructureId}
                  onValueChange={(v) => update(selected.id, { outStructureId: v ?? undefined })}
                >
                  <SelectTrigger className="h-8 font-mono text-xs">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="font-mono text-xs">
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {LLM_KINDS.includes(selected.kind) && (
                <>
                  <Field label="Model">
                    <ModelSelector
                      value={selected.model ?? globalModel}
                      onChange={(v) => update(selected.id, { model: v })}
                    />
                  </Field>
                  <Field label="Prompt">
                    <Textarea
                      value={selected.prompt ?? ""}
                      onChange={(e) => update(selected.id, { prompt: e.target.value })}
                      placeholder="Instruction for this step…"
                      className="min-h-24 text-xs leading-relaxed"
                    />
                  </Field>
                </>
              )}

              {selected.kind === "custom-code" && (
                <Field label="TypeScript · (input) => output">
                  <Textarea
                    value={selected.code ?? ""}
                    onChange={(e) => update(selected.id, { code: e.target.value })}
                    className="min-h-32 bg-[oklch(0.14_0.004_264)] font-mono text-[11px] leading-relaxed"
                    spellCheck={false}
                  />
                </Field>
              )}

              <div className="mt-4 flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2.5">
                <div>
                  <p className="text-xs font-medium">Cache results</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    skip recompute &amp; billing
                  </p>
                </div>
                <Switch
                  checked={selected.cached}
                  onCheckedChange={(v) => update(selected.id, { cached: v })}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Stat label="avg latency" value={`${avgMsOf(selected)}ms`} />
                <Stat label="avg cost" value={`$${(avgCostOf(selected) / 100).toFixed(2)}`} />
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

function KindIcon({ kind, size = "md" }: { kind: ModuleKind; size?: "sm" | "md" }) {
  const Icon = KIND_ICON[kind]
  return (
    <div className="flex w-14 shrink-0 flex-col items-center gap-0.5">
      <Icon className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4", KIND_COLOR[kind])} />
      <span className="text-center text-[8px] leading-tight text-muted-foreground">
        {MODULE_META[kind].label}
      </span>
    </div>
  )
}

function Connector({ invalid }: { invalid?: boolean }) {
  return <div className={cn("h-6 w-px", invalid ? "bg-destructive" : "bg-border")} />
}

function PipelineNode({ label, subtle }: { label: string; subtle?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-wider",
        subtle ? "border-border text-muted-foreground" : "border-primary text-primary",
      )}
    >
      {label}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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
