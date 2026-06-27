import { type BillingPoint, type ModuleId, type PipelineRun, modelOption } from "./types";

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
        step.kind === "doc-to-text" && !step.model
          ? "doc-parse svc"
          : modelOption(step.model ?? run.model).label;
      bucket.spend[key] = +((bucket.spend[key] ?? 0) + step.costCents).toFixed(4);
      if (run.source === "shared_link") {
        bucket.spend["shared link"] = +((bucket.spend["shared link"] ?? 0) + step.costCents).toFixed(4);
      }
    }
    byDay.set(day, bucket);
  }
  return [...byDay.entries()]
    .sort((a, b) => a[1].ts - b[1].ts)
    .map(([day, { spend }]) => ({ day, ...spend }));
}

// AI : split spend into cheap/open vs frontier models (Billing tab).
export function spendSplit(runs: PipelineRun[]): { cheapCents: number; frontierCents: number } {
  let cheapCents = 0;
  let frontierCents = 0;
  for (const run of runs) {
    for (const step of run.steps) {
      if (step.kind === "doc-to-text" && !step.model) continue;
      const opt = modelOption(step.model ?? run.model);
      if (opt.cheap) cheapCents += step.costCents;
      else frontierCents += step.costCents;
    }
  }
  return { cheapCents: +cheapCents.toFixed(4), frontierCents: +frontierCents.toFixed(4) };
}

// AI : cache savings = cents avoided by cache hits (cross-checks Logging savedCents).
export function totalSaved(runs: PipelineRun[]): number {
  return +runs.reduce((a, r) => a + r.savedCents, 0).toFixed(4);
}

// AI : real run history only — empty until the user has pipeline runs.
export function billingSeries(runs: PipelineRun[]): BillingPoint[] {
  return billingFromRuns(runs);
}

// AI : chart/stats display — internal cents → USD (Billing tab recharts + stat cards).
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
// AI : TODO bug — averages include cached (ms=0, cost=0) and error steps, dragging the
// AI : Pipeline tab's "avg latency / avg cost" below the real execution numbers.
export function moduleMetrics(runs: PipelineRun[]): Map<ModuleId, { avgMs: number; avgCostCents: number }> {
  const agg = new Map<ModuleId, { ms: number; cents: number; n: number }>();
  for (const r of runs) {
    for (const s of r.steps) {
      // AI : cached/error steps skew averages toward 0 — only count real executions.
      if (s.status !== "ok") continue;
      const cur = agg.get(s.moduleId) ?? { ms: 0, cents: 0, n: 0 };
      agg.set(s.moduleId, { ms: cur.ms + s.ms, cents: cur.cents + s.costCents, n: cur.n + 1 });
    }
  }
  const out = new Map<ModuleId, { avgMs: number; avgCostCents: number }>();
  for (const [id, v] of agg) out.set(id, { avgMs: Math.round(v.ms / v.n), avgCostCents: +(v.cents / v.n).toFixed(2) });
  return out;
}
