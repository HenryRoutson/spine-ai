import { runBilledCents } from "@/lib/run-metrics";
import { RunSource, type BillingPoint, type ModuleId, type PipelineRun, modelOption } from "./types";

type DayLabel = string; // e.g. "Jun 11"

function dayOf(ts: number): DayLabel {
  return new Date(ts).toLocaleString("en-US", { month: "short", day: "2-digit" });
}

// AI : input OCR steps bill their vision model; legacy doc-to-text runs may still appear in history.
export function billingFromRuns(runs: PipelineRun[]): BillingPoint[] {
  // AI : bug fix — sorting parsed "Jun 11" labels breaks across a year boundary;
  // AI : track the earliest real timestamp per day and sort on that instead.
  const byDay = new Map<DayLabel, { ts: number; spend: Record<string, number> }>();
  for (const run of runs) {
    const day = dayOf(run.startedAt);
    const bucket = byDay.get(day) ?? { ts: run.startedAt, spend: {} };
    bucket.ts = Math.min(bucket.ts, run.startedAt);
    for (const step of run.steps) {
      if (step.costCents <= 0) continue;
      const key =
        run.source === RunSource.Assistant
          ? "project assistant"
          : run.source === RunSource.SharedLink
            ? "shared link"
            : step.kind === "doc-to-text" && !step.model
              ? "doc-parse svc"
              : modelOption(step.model ?? run.model).label;
      bucket.spend[key] = +((bucket.spend[key] ?? 0) + step.costCents).toFixed(4);
    }
    byDay.set(day, bucket);
  }
  return [...byDay.entries()]
    .sort((a, b) => a[1].ts - b[1].ts)
    .map(([day, { spend }]) => ({ day, ...spend }));
}

// AI : cache savings = cents avoided by cache hits (cross-checks Logging savedCents).
export function totalSaved(runs: PipelineRun[]): number {
  return +runs.reduce((a, r) => a + r.savedCents, 0).toFixed(4);
}

// AI : sum run-level billed totals — matches billRunUsage deductions (sub-cent safe).
export function totalUsageFromRuns(runs: PipelineRun[]): number {
  return +runs.reduce((a, r) => a + runBilledCents(r), 0).toFixed(4);
}

// AI : real run history only — empty until the user has pipeline runs.
export function billingSeries(runs: PipelineRun[]): BillingPoint[] {
  return billingFromRuns(runs);
}

// AI : chart recharts layer expects USD floats — prefer formatCents(cents) at the UI boundary instead.
export function billingPointsUsd(points: BillingPoint[]): BillingPoint[] {
  return points.map((point) => {
    const out: BillingPoint = { day: point.day };
    for (const [k, v] of Object.entries(point)) {
      if (k === "day") continue;
      out[k] = +(Number(v) / 100).toFixed(4);
    }
    return out;
  });
}

// AI : metrics — recompute per-module avgMs/avgCostCents from historical runs (Pipeline tab).
// AI : lives here (pure module) rather than run_engine so the client bundle can import it.
export function moduleMetrics(runs: PipelineRun[]): Map<ModuleId, { avgMs: number; avgCostCents: number }> {
  const agg = new Map<ModuleId, { ms: number; cents: number; n: number }>();
  for (const r of runs) {
    for (const s of r.steps) {
      // AI : skip cached/error steps — only count real executions (status ok).
      if (s.status !== "ok") continue;
      const cur = agg.get(s.moduleId) ?? { ms: 0, cents: 0, n: 0 };
      agg.set(s.moduleId, { ms: cur.ms + s.ms, cents: cur.cents + s.costCents, n: cur.n + 1 });
    }
  }
  const out = new Map<ModuleId, { avgMs: number; avgCostCents: number }>();
  for (const [id, v] of agg) out.set(id, { avgMs: Math.round(v.ms / v.n), avgCostCents: +(v.cents / v.n).toFixed(2) });
  return out;
}
