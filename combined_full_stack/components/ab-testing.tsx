"use client"

import { useState } from "react"
import { Play, Loader2, Trophy, Cpu, AlertTriangle } from "lucide-react"
import { useStore } from "@/lib/store"
import { STRATEGY_META, type Strategy } from "@/lib/types"
// AI : type-only — erased at compile time, no server code reaches the client bundle.
import type { BenchmarkOutcome, JudgeVerdict } from "@/lib/strategies"
import { WindowHeader } from "@/components/window-header"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type Metric = "accuracy" | "passRate" | "latencyMs" | "costCents"

export function AbTesting() {
  const { project, strategies, setStrategies, refreshBilling } = useStore()
  const [running, setRunning] = useState(false)
  const [hasRun, setHasRun] = useState(true)
  const [verdict, setVerdict] = useState<JudgeVerdict | null>(null)
  const [error, setError] = useState<string | null>(null)

  const enabled = strategies.filter((s) => s.enabled)

  function toggle(id: string) {
    setStrategies(
      strategies.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    )
  }

  // AI : de-mocked — POST /api/abtest runs every enabled LLL environment for real on the
  // AI : cheap model (Sonnet fallback if none work) and the LLM judge scores them; results
  // AI : are written back into project.strategies so they persist.
  async function run() {
    setRunning(true)
    setHasRun(false)
    setError(null)
    try {
      const res = await fetch("/api/abtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `benchmark failed (${res.status})`)
      refreshBilling().catch(console.error)
      const outcome = (await res.json()) as BenchmarkOutcome
      setStrategies(
        strategies.map((s) => {
          const r = outcome.results.find((x) => x.kind === s.kind)
          return r
            ? { ...s, model: r.model, accuracy: r.accuracy, passRate: r.passRate, latencyMs: r.latencyMs, costCents: r.costCents }
            : s
        }),
      )
      setVerdict(outcome.verdict)
    } catch (e) {
      setError((e as Error).message)
    }
    setRunning(false)
    setHasRun(true)
  }

  // AI : prefer the real judge's pick; fall back to the local heuristic for seeded values.
  const best = (verdict && enabled.find((s) => s.kind === verdict.winnerKind)) ?? bestStrategy(enabled)

  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        step="03 / A/B Test"
        title="Strategy Comparison"
        description="Benchmark approaches on the same pipeline task. Pick the best accuracy/cost trade-off."
        actions={
          <Button size="sm" onClick={run} disabled={running || enabled.length === 0}>
            {running ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="mr-1.5 h-3.5 w-3.5" />
            )}
            {running ? "Benchmarking…" : "Run benchmark"}
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-5 py-5">
          {error ? (
            <p className="mb-3 flex items-center gap-1.5 font-mono text-[11px] text-destructive">
              <AlertTriangle className="h-3 w-3" /> {error}
            </p>
          ) : (
            <p className="mb-3 font-mono text-[11px] text-muted-foreground">
              {verdict
                ? "Real benchmark — every environment ran live; the LLM judge scored the outputs."
                : running
                  ? "Benchmarking — running every enabled environment live, then judging. This takes a minute or two."
                  : "Seeded values — hit Run benchmark to execute every enabled environment for real."}
            </p>
          )}

          {/* strategy cards */}
          <div className="grid gap-3 sm:grid-cols-2">
            {strategies.map((s) => (
              <StrategyCard
                key={s.id}
                strategy={s}
                onToggle={() => toggle(s.id)}
                running={running && s.enabled}
                isBest={hasRun && best?.id === s.id}
              />
            ))}
          </div>

          {/* comparison bars */}
          {enabled.length > 0 && (
            <div className="mt-6 rounded-lg border border-border">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <h3 className="text-sm font-medium">Comparison</h3>
                {hasRun && best && (
                  <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                    <Trophy className="h-3 w-3 text-primary" />
                    {best.name} chosen by LLM judge
                  </span>
                )}
              </div>
              <div className="grid gap-5 p-4 md:grid-cols-2">
                <MetricChart
                  title="Accuracy"
                  unit="%"
                  metric="accuracy"
                  strategies={enabled}
                  higherIsBetter
                />
                <MetricChart
                  title="Schema pass rate"
                  unit="%"
                  metric="passRate"
                  strategies={enabled}
                  higherIsBetter
                />
                <MetricChart
                  title="Latency"
                  unit="ms"
                  metric="latencyMs"
                  strategies={enabled}
                  higherIsBetter={false}
                  format={(v) => `${(v / 1000).toFixed(1)}s`}
                />
                <MetricChart
                  title="Cost per run"
                  unit="$"
                  metric="costCents"
                  strategies={enabled}
                  higherIsBetter={false}
                  format={(v) => `$${(v / 100).toFixed(2)}`}
                />
              </div>
              {verdict && (
                <div className="border-t border-border px-4 py-3">
                  <p className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    <Trophy className="h-3 w-3 text-primary" /> judge rationale
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{verdict.rationale}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StrategyCard({
  strategy,
  onToggle,
  running,
  isBest,
}: {
  strategy: Strategy
  onToggle: () => void
  running: boolean
  isBest: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 transition-colors",
        strategy.enabled ? "border-border" : "border-border opacity-55",
        isBest && "border-primary",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <Cpu className="mt-0.5 h-4 w-4 text-primary" />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">{strategy.name}</h3>
              {isBest && (
                <Badge className="gap-1 bg-primary/15 text-primary hover:bg-primary/15">
                  <Trophy className="h-3 w-3" /> best
                </Badge>
              )}
            </div>
            <p className="font-mono text-[10px] text-muted-foreground">
              {strategy.model}
            </p>
          </div>
        </div>
        <Switch checked={strategy.enabled} onCheckedChange={onToggle} />
      </div>

      <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
        {STRATEGY_META[strategy.kind].description}
      </p>

      <div className="mt-3 grid grid-cols-4 gap-2 border-t border-border pt-3">
        <Mini label="acc" value={running ? "…" : `${strategy.accuracy}%`} />
        <Mini label="pass" value={running ? "…" : `${strategy.passRate}%`} />
        <Mini
          label="lat"
          value={running ? "…" : `${(strategy.latencyMs / 1000).toFixed(1)}s`}
        />
        <Mini
          label="cost"
          value={running ? "…" : `$${(strategy.costCents / 100).toFixed(2)}`}
        />
      </div>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] text-muted-foreground">{label}</p>
      <p className="font-mono text-xs">{value}</p>
    </div>
  )
}

function MetricChart({
  title,
  metric,
  strategies,
  higherIsBetter,
  format,
}: {
  title: string
  unit: string
  metric: Metric
  strategies: Strategy[]
  higherIsBetter: boolean
  format?: (v: number) => string
}) {
  const values = strategies.map((s) => s[metric] as number)
  const max = Math.max(...values, 1)
  const bestVal = higherIsBetter ? Math.max(...values) : Math.min(...values)

  return (
    <div>
      <h4 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      <div className="space-y-2">
        {strategies.map((s) => {
          const v = s[metric] as number
          const pct = (v / max) * 100
          const isBest = v === bestVal
          return (
            <div key={s.id} className="flex items-center gap-2">
              <span className="w-24 shrink-0 truncate text-[11px] text-muted-foreground">
                {s.name}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    isBest ? "bg-primary" : "bg-muted-foreground/50",
                  )}
                  style={{ width: `${Math.max(4, pct)}%` }}
                />
              </div>
              <span
                className={cn(
                  "w-12 shrink-0 text-right font-mono text-[11px]",
                  isBest ? "text-primary" : "text-foreground",
                )}
              >
                {format ? format(v) : v}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function bestStrategy(list: Strategy[]): Strategy | undefined {
  if (list.length === 0) return undefined
  // simple score: accuracy + passRate weighted, penalize cost
  return [...list].sort((a, b) => score(b) - score(a))[0]
}
function score(s: Strategy) {
  return s.accuracy * 0.5 + s.passRate * 0.3 - (s.costCents / 100) * 4
}
