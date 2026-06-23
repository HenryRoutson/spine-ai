"use client"

import { useMemo, useState } from "react"
import {
  Plus,
  Trash2,
  ChevronRight,
  ArrowRight,
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
  Copy,
  Check,
  Link2,
  Lock,
  type LucideIcon,
} from "lucide-react"
import { useStore, uid } from "@/lib/store"
import { computeInvalid, computeWarnings, invalidStepMessage, warningStepMessage, type InvalidStep, type PipelineWarning } from "@/lib/validity"
import { inputTypeLabel, inputTypesForModule, inputNameRestrictionLabel } from "@/lib/inference-input"
import { AUTO_QUOTE_EXPLAINER, isAutoQuoteStep } from "@/lib/quote-steps"
import { llmSchemaJson } from "@/lib/structure"
import { JsonHighlight } from "@/components/highlight"
import { moduleMetrics } from "@/lib/billing"
import { combinePairIds, segmentPipeline } from "@/lib/pipeline-layout"
import {
  INPUT_TYPES,
  MODULE_META,
  type ModuleKind,
  type PipelineModule,
  type StructureModel,
} from "@/lib/types"
import { WindowHeader } from "@/components/window-header"
import { PipelineAssistant } from "@/components/pipeline-assistant"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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
  quote: Link2,
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
  quote: "text-chart-2",
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

// AI : factory for a fresh module — shared by append + colab-style insert slots.
function makeModule(
  kind: ModuleKind,
  models: StructureModel[],
  globalModel: string,
): PipelineModule {
  const isLlm = LLM_KINDS.includes(kind)
  const defaultModel = models[0]?.id
  return {
    id: uid(),
    kind,
    label: MODULE_META[kind].label,
    cached: true,
    avgMs: 0,
    avgCostCents: 0,
    inputType: kind === "input" ? "pdf" : undefined,
    outStructureId: kind === "output" ? undefined : defaultModel,
    inStructureId: kind !== "input" ? defaultModel : undefined,
    prompt: isLlm ? "" : undefined,
    code: kind === "custom-code" ? "(input) => input" : undefined,
    model: isLlm ? globalModel : undefined,
  }
}

// AI : don't offer an insert slot between a quote-emitting LLM and its locked Link Quotes step.
function blocksInsertBefore(modules: PipelineModule[], insertAt: number): boolean {
  if (insertAt <= 0 || insertAt >= modules.length) return false
  const prev = modules[insertAt - 1]
  const next = modules[insertAt]
  return LLM_KINDS.includes(prev.kind) && isAutoQuoteStep(next)
}

function insertBeforeIndex(seg: ReturnType<typeof segmentPipeline>[number]): number {
  return seg.kind === "combine" ? seg.index - 1 : seg.index
}

function insertAfterIndex(seg: ReturnType<typeof segmentPipeline>[number]): number {
  return seg.index + 1
}

type AsideTab = "inspector" | "assistant"

export function PipelineBuilder() {
  const { modules, setModules, models, model: globalModel, runs } = useStore()
  const [selectedId, setSelectedId] = useState<string>(modules[0]?.id ?? "")
  const [copied, setCopied] = useState(false)
  const [asideTab, setAsideTab] = useState<AsideTab>("inspector")

  const selected = modules.find((m) => m.id === selectedId)
  // AI : de-mocked — invalid check is the shared server definition; latency/cost are
  // AI : recomputed from real run history (falls back to seeded avgs before any run).
  const invalid = computeInvalid(modules, models)
  const warnings = computeWarnings(modules, models)
  const metrics = moduleMetrics(runs)
  const structureModelItems = useMemo(
    () => models.map((m) => ({ value: m.id, label: m.name })),
    [models],
  )
  const llmSchemaPreview = useMemo(() => {
    if (!selected || !LLM_KINDS.includes(selected.kind) || !selected.outStructureId) return null
    const out = models.find((m) => m.id === selected.outStructureId)
    if (!out) return null
    const isList = selected.outIsList || selected.kind === "llm-batch"
    return llmSchemaJson(out, models, isList)
  }, [selected, models])
  const okRuns = runs.filter((r) => r.status === "ok")
  const totalMs =
    okRuns.length > 0
      ? okRuns.reduce((a, r) => a + r.totalMs, 0) / okRuns.length
      : null
  const totalCost =
    okRuns.length > 0
      ? okRuns.reduce((a, r) => a + r.billedCents, 0) / okRuns.length
      : null
  const cachedCount = modules.filter((m) => m.cached).length

  function insertModule(kind: ModuleKind, at = modules.length) {
    const fresh: PipelineModule[] =
      kind === "combine"
        ? [
            { ...makeModule("input", models, globalModel), label: "Document Input" },
            makeModule("combine", models, globalModel),
          ]
        : [makeModule(kind, models, globalModel)]
    const next = [...modules.slice(0, at), ...fresh, ...modules.slice(at)]
    setModules(next)
    setSelectedId(fresh[fresh.length - 1].id)
  }

  const segments = segmentPipeline(modules)

  function update(id: string, patch: Partial<PipelineModule>) {
    setModules(
      modules.map((m) => {
        if (m.id !== id) return m
        const next = { ...m, ...patch }
        if (next.kind === "output" && patch.inStructureId) {
          next.outStructureId = patch.inStructureId
        }
        return next
      }),
    )
  }

  function remove(id: string) {
    const m = modules.find((x) => x.id === id)
    if (m && isAutoQuoteStep(m)) return
    const drop = new Set(combinePairIds(modules, id))
    const next = modules.filter((m) => !drop.has(m.id))
    setModules(next)
    if (drop.has(selectedId)) setSelectedId(next[0]?.id ?? "")
  }

  function move(id: string, dir: -1 | 1) {
    const m = modules.find((x) => x.id === id)
    if (m && isAutoQuoteStep(m)) return
    const ids = combinePairIds(modules, id)
    const block = ids.map((x) => modules.find((m) => m.id === x)!)
    const rest = modules.filter((m) => !ids.includes(m.id))
    const at = modules.findIndex((m) => m.id === ids[0])
    const insertAt = dir === -1 ? at - 1 : at + ids.length
    if (insertAt < 0 || insertAt > rest.length) return
    const next = [...rest.slice(0, insertAt), ...block, ...rest.slice(insertAt)]
    setModules(next)
  }

  async function copyPipelineJson() {
    const json = JSON.stringify({ models, modules }, null, 2)
    await navigator.clipboard.writeText(json)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <TooltipProvider delay={200}>
    <div className="flex h-full flex-col">
      <WindowHeader
        step="02 / Pipeline"
        title="Linear Pipeline"
        description="Each step declares its input and output model. Mismatched I/O is flagged — there is no explicit validation step."
        actions={
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-[10px]"
              onClick={() => void copyPipelineJson()}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy prompt"}
            </Button>
            <span className="text-muted-foreground">
              {totalMs != null ? `~${(totalMs / 1000).toFixed(1)}s avg` : "— avg"}
            </span>
            <span className="text-muted-foreground">
              {totalCost != null ? `$${(totalCost / 100).toFixed(2)}/run` : "—/run"}
            </span>
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Zap className="h-3 w-3 text-primary" /> {cachedCount} cached
            </Badge>
            {invalid.size > 0 && (
              <Badge variant="outline" className="gap-1 border-destructive/50 text-[10px] text-destructive">
                <AlertTriangle className="h-3 w-3" /> {invalid.size} invalid
              </Badge>
            )}
            {warnings.size > 0 && (
              <Badge variant="outline" className="gap-1 border-amber-500/50 text-[10px] text-amber-600 dark:text-amber-500">
                <AlertTriangle className="h-3 w-3" /> {warnings.size} warning{warnings.size === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,44%)]">
        {/* canvas */}
        <div className="min-w-0 overflow-auto">
          <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col items-stretch gap-0 px-6 py-8">
            <div className="mx-auto flex w-full max-w-xl flex-col items-center">
              <PipelineNode label="Start" subtle />
              {segments.length > 0 && (
                <InsertSlot insertAt={insertBeforeIndex(segments[0])} onInsert={insertModule} />
              )}
            </div>
            {segments.map((seg) => {
              if (seg.kind === "combine") {
                const { combine, input, index } = seg
                const isInvalid = invalid.has(combine.id)
                const pipelineModel = modelName(models, combine.inStructureId)
                const outModel = modelName(models, combine.outStructureId)
                const groupSelected = selectedId === combine.id || selectedId === input.id
                return (
                  <div key={combine.id} className="mx-auto flex w-full max-w-xl flex-col items-center">
                    <div
                      className={cn(
                        "w-full rounded-lg border-2 border-dashed px-3.5 py-3 transition-colors",
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
                        className="flex w-full items-start gap-2 text-left"
                      >
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <KindIcon kind="combine" />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-medium leading-snug">{combine.label}</p>
                          <p className="line-clamp-2 font-mono text-[10px] leading-snug text-muted-foreground">
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
                          "mt-2 flex w-full items-start gap-3 rounded-md border bg-card px-3 py-2.5 text-left transition-colors",
                          selectedId === input.id
                            ? "border-primary"
                            : "border-border hover:border-muted-foreground/40",
                        )}
                      >
                        <KindIcon kind="input" size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-xs font-medium leading-snug">{input.label}</p>
                          <p className="line-clamp-2 font-mono text-[10px] leading-snug text-muted-foreground">
                            {modelName(models, input.outStructureId) ?? "·"} · {inputTypeLabel(input.inputType)}
                          </p>
                        </div>
                      </button>
                    </div>
                    {isInvalid && (
                      <p className="mt-1 text-center font-mono text-[10px] text-destructive">
                        {invalidStepMessage(invalid.get(combine.id)!, models, modules)}
                      </p>
                    )}
                    <InsertSlot insertAt={insertAfterIndex(seg)} onInsert={insertModule} />
                  </div>
                )
              }

              const m = seg.module
              const i = seg.index
              const isInvalid = invalid.has(m.id)
              const stepWarning = warnings.get(m.id)
              const locked = isAutoQuoteStep(m)
              const ioName = modelName(models, m.inStructureId)

              if (m.kind === "output") {
                return (
                  <OutputForkStep
                    key={m.id}
                    m={m}
                    index={i}
                    models={models}
                    modules={modules}
                    selectedId={selectedId}
                    isInvalid={isInvalid}
                    issue={invalid.get(m.id)}
                    insertAt={insertAfterIndex(seg)}
                    onSelect={setSelectedId}
                    onInsert={insertModule}
                    blocked={blocksInsertBefore(modules, insertAfterIndex(seg))}
                  />
                )
              }

              return (
                <div key={m.id} className="mx-auto flex w-full max-w-xl flex-col items-center">
                  <button
                    onClick={() => setSelectedId(m.id)}
                    className={cn(
                      "group relative flex w-full items-start gap-3 rounded-lg border bg-card px-3.5 py-3 text-left transition-colors",
                      locked && "border-dashed border-chart-2/50 bg-chart-2/5",
                      isInvalid
                        ? "border-destructive/70"
                        : m.id === selectedId
                          ? "border-primary"
                          : !locked && "border-border hover:border-muted-foreground/40",
                    )}
                  >
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <KindIcon kind={m.kind} />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium leading-snug">{m.label}</p>
                      <p className="line-clamp-2 font-mono text-[10px] leading-snug text-muted-foreground">
                        {m.kind === "input"
                          ? `${modelName(models, m.outStructureId) ?? "·"} · ${inputTypeLabel(m.inputType)}`
                          : locked
                            ? <>{ioName ?? "·"}<span className="text-muted-foreground/60"> · same model in/out</span></>
                            : <>
                                {ioName ?? "·"}
                                <span className="text-muted-foreground/60"> → </span>
                                {modelName(models, m.outStructureId) ?? "·"}
                              </>}
                      </p>
                    </div>
                    {locked && <AutoQuoteLock />}
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
                    <p className="mt-1 text-center font-mono text-[10px] text-destructive">
                      {invalidStepMessage(invalid.get(m.id)!, models, modules)}
                    </p>
                  )}
                  {!isInvalid && stepWarning && (
                    <p className="mt-1 text-center font-mono text-[10px] text-amber-600 dark:text-amber-500">
                      {warningStepMessage(stepWarning, models, modules)}
                    </p>
                  )}
                  <InsertSlot
                    insertAt={insertAfterIndex(seg)}
                    onInsert={insertModule}
                    invalid={isInvalid}
                    blocked={blocksInsertBefore(modules, insertAfterIndex(seg))}
                  />
                </div>
              )
            })}
            <div className="mx-auto flex w-full max-w-xl flex-col items-center">
              {segments.length === 0 && (
                <InsertSlot insertAt={0} onInsert={insertModule} alwaysShow />
              )}
              <PipelineNode label="End" subtle />
              <div className="mt-6">
                <AddStepMenu insertAt={modules.length} onInsert={insertModule} variant="button" />
              </div>
            </div>
          </div>
        </div>

        {/* inspector / assistant */}
        <aside className="flex w-80 shrink-0 flex-col border-l border-border">
          <div className="flex border-b border-border">
            <button
              type="button"
              onClick={() => setAsideTab("inspector")}
              className={cn(
                "flex-1 px-3 py-2 font-mono text-[10px] uppercase tracking-wider transition-colors",
                asideTab === "inspector"
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Inspector
            </button>
            <button
              type="button"
              onClick={() => setAsideTab("assistant")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 px-3 py-2 font-mono text-[10px] uppercase tracking-wider transition-colors",
                asideTab === "assistant"
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Sparkle className="h-3 w-3" />
              Assistant
            </button>
          </div>

          {asideTab === "assistant" ? (
            <PipelineAssistant />
          ) : selected ? (
            <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {MODULE_META[selected.kind].label}
                </span>
                {isAutoQuoteStep(selected) ? (
                  <AutoQuoteLock />
                ) : (
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
                )}
              </div>

              {isAutoQuoteStep(selected) ? (
                <>
                  <p className="mb-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
                    {AUTO_QUOTE_EXPLAINER}
                  </p>
                  <Field label="Structure">
                    <p className="rounded-md border border-chart-2/30 bg-chart-2/5 px-2.5 py-2 font-mono text-xs">
                      {modelName(models, selected.inStructureId) ?? "·"}
                      <span className="text-muted-foreground"> → </span>
                      {modelName(models, selected.outStructureId) ?? "·"}
                      <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                        same model — LLM emits strings, this step attaches source spans
                      </span>
                    </p>
                  </Field>
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
                </>
              ) : (
                <>
              <p className="mb-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
                {MODULE_META[selected.kind].description}
              </p>
              {invalid.has(selected.id) && (
                <p className="mb-3 font-mono text-[10px] leading-relaxed text-destructive">
                  {invalidStepMessage(invalid.get(selected.id)!, models, modules)}
                </p>
              )}
              {warnings.has(selected.id) && (
                <p className="mb-3 font-mono text-[10px] leading-relaxed text-amber-600 dark:text-amber-500">
                  {warningStepMessage(warnings.get(selected.id)!, models, modules)}
                </p>
              )}

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
                <>
                  <Field label="Input types">
                    <div className="flex flex-wrap gap-1.5">
                      {INPUT_TYPES.map((t) => {
                        const active = inputTypesForModule(selected).includes(t.value)
                        return (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => {
                              const current = inputTypesForModule(selected)
                              const next = active
                                ? current.filter((v) => v !== t.value)
                                : [...current, t.value]
                              if (!next.length) return
                              update(selected.id, { inputType: next.length === 1 ? next[0] : next })
                            }}
                            className={cn(
                              "rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                              active
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:border-muted-foreground/40",
                            )}
                          >
                            {t.label}
                          </button>
                        )
                      })}
                    </div>
                  </Field>
                  <Field
                    label="Filename must contain"
                    hint="optional — only documents whose name includes this text can be assigned to this input"
                  >
                    <Input
                      value={selected.inputNameContains ?? ""}
                      onChange={(e) =>
                        update(selected.id, { inputNameContains: e.target.value.trim() || undefined })
                      }
                      placeholder='e.g. "legal_requirements", "company_legal_compliance"'
                      className="h-8 font-mono text-xs"
                    />
                  </Field>
                  <Field
                    label="I/O model"
                    hint={
                      invalid.has(selected.id) && invalid.get(selected.id)?.kind === "no-output"
                        ? "required — defines the structure this file is loaded into"
                        : undefined
                    }
                    hintTone={
                      invalid.has(selected.id) && invalid.get(selected.id)?.kind === "no-output"
                        ? "error"
                        : undefined
                    }
                  >
                    <Select
                      value={selected.outStructureId ?? null}
                      onValueChange={(v) => update(selected.id, { outStructureId: v ?? undefined })}
                      items={structureModelItems}
                    >
                      <SelectTrigger
                        className={cn(
                          "h-8 font-mono text-xs",
                          invalid.has(selected.id) &&
                            invalid.get(selected.id)?.kind === "no-output" &&
                            "border-destructive/70",
                        )}
                      >
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        {models.map((m) => (
                          <SelectItem key={m.id} value={m.id} label={m.name} className="font-mono text-xs">
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </>
              )}

              {selected.kind !== "input" && (
                <Field
                  label={selected.kind === "output" ? "Structure to materialize" : "Input model"}
                  hint={
                    selected.kind === "output" &&
                    invalid.has(selected.id) &&
                    invalid.get(selected.id)?.kind === "no-output"
                      ? "required — pick the structure this step snapshots"
                      : undefined
                  }
                  hintTone={
                    selected.kind === "output" &&
                    invalid.has(selected.id) &&
                    invalid.get(selected.id)?.kind === "no-output"
                      ? "error"
                      : undefined
                  }
                >
                  <Select
                    value={selected.inStructureId ?? null}
                    onValueChange={(v) => update(selected.id, { inStructureId: v ?? undefined })}
                    items={structureModelItems}
                  >
                    <SelectTrigger
                      className={cn(
                        "h-8 font-mono text-xs",
                        selected.kind === "output" &&
                          invalid.has(selected.id) &&
                          invalid.get(selected.id)?.kind === "no-output" &&
                          "border-destructive/70",
                      )}
                    >
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((m) => (
                        <SelectItem key={m.id} value={m.id} label={m.name} className="font-mono text-xs">
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              {selected.kind !== "input" && selected.kind !== "output" && (
                <Field
                  label="Output model"
                  hint={
                    invalid.has(selected.id) && invalid.get(selected.id)?.kind === "no-output"
                      ? "required — step must emit a structure"
                      : undefined
                  }
                  hintTone={
                    invalid.has(selected.id) && invalid.get(selected.id)?.kind === "no-output"
                      ? "error"
                      : undefined
                  }
                >
                  <Select
                    value={selected.outStructureId ?? null}
                    onValueChange={(v) => update(selected.id, { outStructureId: v ?? undefined })}
                    items={structureModelItems}
                  >
                    <SelectTrigger
                      className={cn(
                        "h-8 font-mono text-xs",
                        invalid.has(selected.id) &&
                          invalid.get(selected.id)?.kind === "no-output" &&
                          "border-destructive/70",
                      )}
                    >
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((m) => (
                        <SelectItem key={m.id} value={m.id} label={m.name} className="font-mono text-xs">
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              {LLM_KINDS.includes(selected.kind) && (
                <>
                  <Field label="Model">
                    <ModelSelector
                      value={selected.model ?? globalModel}
                      onChange={(v) => update(selected.id, { model: v })}
                    />
                  </Field>
                  <Field
                    label={
                      warnings.has(selected.id)
                        ? "Prompt · optional"
                        : "Prompt"
                    }
                  >
                    <Textarea
                      value={selected.prompt ?? ""}
                      onChange={(e) => update(selected.id, { prompt: e.target.value })}
                      placeholder="Extra instruction (schema below also guides the model)…"
                      className="min-h-32 resize-y text-xs leading-relaxed"
                    />
                    {warnings.has(selected.id) && warnings.get(selected.id)?.kind === "no-prompt" && (
                      <p className="mt-1 font-mono text-[9px] text-muted-foreground">
                        no custom text — JSON schema is sent as the structured output contract
                      </p>
                    )}
                    {warnings.has(selected.id) && warnings.get(selected.id)?.kind === "unused-output" && (
                      <p className="mt-1 font-mono text-[9px] text-amber-600 dark:text-amber-500">
                        {warningStepMessage(warnings.get(selected.id)!, models, modules)}
                      </p>
                    )}
                  </Field>
                  {llmSchemaPreview && (
                    <Field
                      label={
                        selected.kind === "llm-batch"
                          ? "Output schema · per item"
                          : "Output schema · Zod → JSON Schema"
                      }
                    >
                      <div className="max-h-64 min-w-0 overflow-auto rounded-md border border-border bg-[oklch(0.14_0.004_264)] p-2">
                        <JsonHighlight json={llmSchemaPreview} />
                      </div>
                    </Field>
                  )}
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
                <Stat
                  label="avg latency"
                  value={
                    metrics.has(selected.id)
                      ? `${metrics.get(selected.id)!.avgMs}ms`
                      : "—"
                  }
                />
                <Stat
                  label="avg cost"
                  value={
                    metrics.has(selected.id)
                      ? `$${(metrics.get(selected.id)!.avgCostCents / 100).toFixed(2)}`
                      : "—"
                  }
                />
              </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center">
              <p className="text-xs text-muted-foreground">
                Add a module and select it to configure, or use the Assistant tab.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
    </TooltipProvider>
  )
}

function AutoQuoteLock({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        // AI : span avoids nested <button> when this badge sits inside a module row button
        render={<span />}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-md border border-chart-2/40 bg-chart-2/10 px-1.5 py-0.5 text-chart-2",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Lock className="h-3 w-3" />
        <span className="font-mono text-[9px]">auto</span>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs text-left leading-relaxed">
        {AUTO_QUOTE_EXPLAINER}
      </TooltipContent>
    </Tooltip>
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

// AI : colab-style gap — hover the connector to reveal +, click to pick a step type.
function InsertSlot({
  insertAt,
  onInsert,
  invalid,
  alwaysShow,
  blocked,
}: {
  insertAt: number
  onInsert: (kind: ModuleKind, at: number) => void
  invalid?: boolean
  alwaysShow?: boolean
  blocked?: boolean
}) {
  if (blocked) {
    return <div className="h-4 w-px bg-border/60" aria-hidden />
  }
  return (
    <div className="group relative flex h-8 w-full items-center justify-center">
      <div
        className={cn(
          "absolute h-full w-px bg-border transition-colors group-hover:bg-muted-foreground/40",
          invalid && "bg-destructive/70",
        )}
      />
      <AddStepMenu
        insertAt={insertAt}
        onInsert={onInsert}
        variant="slot"
        alwaysShow={alwaysShow}
      />
    </div>
  )
}

function AddStepMenu({
  insertAt,
  onInsert,
  variant,
  alwaysShow,
}: {
  insertAt: number
  onInsert: (kind: ModuleKind, at: number) => void
  variant: "slot" | "button"
  alwaysShow?: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          variant === "slot"
            ? cn(
                "relative z-10 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-all hover:border-primary hover:bg-primary/10 hover:text-primary",
                alwaysShow
                  ? "opacity-100"
                  : "opacity-30 group-hover:opacity-100 data-popup-open:opacity-100",
              )
            : "inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-border bg-transparent px-3 text-xs text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-foreground",
        )}
        aria-label="Add pipeline step"
      >
        <Plus className={variant === "slot" ? "h-3 w-3" : "h-3.5 w-3.5"} />
        {variant === "button" && <span>Add step</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="min-w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-mono text-[10px] text-muted-foreground">
            Insert step
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuGroup>
          {ADDABLE.map((k) => {
            const Icon = KIND_ICON[k]
            return (
              <DropdownMenuItem key={k} onClick={() => onInsert(k, insertAt)} className="gap-2">
                <Icon className={cn("h-3.5 w-3.5", KIND_COLOR[k])} />
                <span>{MODULE_META[k].label}</span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function OutputForkStep({
  m,
  index,
  models,
  modules,
  selectedId,
  isInvalid,
  issue,
  insertAt,
  onSelect,
  onInsert,
  blocked,
}: {
  m: PipelineModule
  index: number
  models: StructureModel[]
  modules: PipelineModule[]
  selectedId: string
  isInvalid: boolean
  issue?: InvalidStep
  insertAt: number
  onSelect: (id: string) => void
  onInsert: (kind: ModuleKind, at: number) => void
  blocked?: boolean
}) {
  const structName = modelName(models, m.inStructureId)
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center">
      {/* AI : output sits on the spine — arrow exits right to signal materialization */}
      <div className="flex w-full items-center justify-center">
        <div className="relative w-full max-w-xs">
          <button
            type="button"
            onClick={() => onSelect(m.id)}
            className={cn(
              "flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-3 text-center transition-colors",
              "border-chart-4/50 bg-chart-4/5 shadow-sm",
              isInvalid && "border-destructive/70 bg-destructive/5",
              m.id === selectedId && "border-chart-4 ring-1 ring-chart-4/40",
              m.id !== selectedId && !isInvalid && "hover:border-chart-4/80 hover:bg-chart-4/10",
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-[10px] text-chart-4/80">{String(index + 1).padStart(2, "0")}</span>
              <KindIcon kind="output" />
            </div>
            <div className="min-w-0 w-full">
              <p className="line-clamp-2 text-sm font-medium leading-snug">{m.label}</p>
              <p className="line-clamp-2 font-mono text-[10px] leading-snug text-muted-foreground">
                {structName ?? "·"}
                <span className="text-chart-4/80"> · snapshot</span>
              </p>
            </div>
            {(m.cached || isInvalid) && (
              <div className="flex items-center justify-center gap-1.5">
                {m.cached && <Zap className="h-3.5 w-3.5 shrink-0 text-primary" />}
                {isInvalid && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />}
              </div>
            )}
          </button>
          <ArrowRight
            className="pointer-events-none absolute left-full top-1/2 ml-2 h-4 w-4 -translate-y-1/2 text-chart-4"
            aria-hidden
          />
        </div>
      </div>
      {isInvalid && issue && (
        <p className="mt-1 max-w-xs text-center font-mono text-[10px] text-destructive">
          {invalidStepMessage(issue, models, modules)}
        </p>
      )}
      <InsertSlot insertAt={insertAt} onInsert={onInsert} invalid={isInvalid} blocked={blocked} />
    </div>
  )
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

function Field({
  label,
  hint,
  hintTone = "warning",
  children,
}: {
  label: string
  hint?: string
  hintTone?: "warning" | "error"
  children: React.ReactNode
}) {
  return (
    <div className="mb-3 min-w-0">
      <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {hint && (
        <p
          className={cn(
            "mb-1.5 font-mono text-[10px]",
            hintTone === "error"
              ? "text-destructive"
              : "text-amber-600 dark:text-amber-500",
          )}
        >
          {hint}
        </p>
      )}
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
