import type { ModelId, ModuleKind, PipelineRun, RunId } from "./types";

// AI : TODO — runToHtml / runToMarkdown should emit inputPreviewItems when present (multi-doc / llm-batch).
export interface RunFilter {
  model?: ModelId;
  kind?: ModuleKind;
  runId?: RunId;
}

// AI : query/filter run history (Logging tab filters by model / step / id).
export function filterRuns(runs: PipelineRun[], f: RunFilter): PipelineRun[] {
  return runs.filter((r) => {
    if (f.runId && r.id !== f.runId) return false;
    if (f.model && r.model !== f.model && !r.steps.some((s) => s.model === f.model)) return false;
    if (f.kind && !r.steps.some((s) => s.kind === f.kind)) return false;
    return true;
  });
}

// AI : download payload — full per-step trace as markdown.
export function runToMarkdown(run: PipelineRun): string {
  const lines = [
    `# Run ${run.id}`,
    ``,
    `- **Status:** ${run.status}`,
    `- **Model:** ${run.model}`,
    `- **Total:** ${run.totalMs}ms · billed ${run.billedCents.toFixed(2)}c · saved ${run.savedCents.toFixed(2)}c`,
    ...(run.notes ? [`- **Notes:** ${run.notes}`, ``] : []),
    `## Steps`,
    ``,
  ];
  for (const s of run.steps) {
    lines.push(`### ${s.label} (${s.kind}) — ${s.status}`);
    lines.push(`- ${s.ms}ms · ${s.costCents.toFixed(2)}c${s.model ? ` · ${s.model}` : ""}`);
    lines.push(`- in: ${s.inputPreview}`);
    lines.push(`- out: ${s.outputPreview}`);
    if (s.outputJson) lines.push("\n```json\n" + s.outputJson + "\n```\n");
  }
  return lines.join("\n");
}

const STATUS_COLOR: Record<string, string> = {
  ok: "#16a34a",
  cached: "#0891b2",
  error: "#dc2626",
  running: "#f59e0b",
  pending: "#475569",
  skipped: "#94a3b8",
};

// AI : a row in the high-level progress view; "running"/"pending" only appear in live views.
export interface LiveStep {
  label: string;
  kind: string;
  status: "pending" | "running" | "ok" | "cached" | "error" | "skipped";
  ms: number;
  costCents: number;
  detail?: string[]; // e.g. in/out previews shown under the bar
}

// AI : ONE renderer for both the static run report and the live view (live ⇒ auto-refresh + pulse).
export function progressHtml(title: string, subtitle: string, steps: LiveStep[], live: boolean): string {
  const done = steps.filter((s) => s.status !== "pending" && s.status !== "running").length;
  const overallPct = Math.round((done / Math.max(1, steps.length)) * 100);
  const maxMs = Math.max(1, ...steps.map((s) => s.ms));
  const rows = steps
    .map((s) => {
      const color = STATUS_COLOR[s.status] ?? "#64748b";
      const pct = s.status === "running" ? 100 : s.status === "pending" || s.status === "skipped" ? 0 : Math.max(4, Math.round((s.ms / maxMs) * 100));
      const meta = s.status === "pending" ? "·" : s.status === "running" ? "running…" : s.status === "skipped" ? "skipped" : `${s.ms}ms · ${s.costCents.toFixed(2)}c · ${s.status}`;
      const detail = (s.detail ?? [])
        .map((d) => {
          const sep = d.indexOf(": ");
          const label = sep > 0 ? d.slice(0, sep) : "log";
          const body = sep > 0 ? d.slice(sep + 2) : d;
          return `<div class="io-block"><span class="io-label">${escapeHtml(label)}</span><pre class="io-pre">${escapeHtml(body)}</pre></div>`;
        })
        .join("");
      return `
    <div class="step">
      <div class="step-head"><span class="dot" style="background:${color}"></span><b>${escapeHtml(s.label)}</b> <span class="kind">${s.kind}</span><span class="meta">${meta}</span></div>
      <div class="bar"><div class="${s.status === "running" ? "fill pulse" : "fill"}" style="width:${pct}%;background:${color}"></div></div>
      ${detail ? `<div class="io">${detail}</div>` : ""}
    </div>`;
    })
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8">${live ? `<meta http-equiv="refresh" content="1">` : ""}<style>
  body{font:14px system-ui,sans-serif;background:#0b0f14;color:#e2e8f0;padding:24px;max-width:760px;margin:auto}
  h1{font-size:18px} .summary{color:#94a3b8;margin-bottom:16px}
  .step{margin:12px 0} .step-head{display:flex;gap:8px;align-items:center}
  .dot{width:9px;height:9px;border-radius:50%} .kind{color:#64748b;font-size:12px}
  .meta{margin-left:auto;color:#94a3b8;font-size:12px}
  .bar{height:8px;background:#1e293b;border-radius:4px;overflow:hidden;margin:4px 0}
  .fill{height:100%;transition:width .3s} .io{display:flex;flex-direction:column;gap:8px;margin-top:6px}
  .io-block{display:flex;flex-direction:column;gap:2px}
  .io-label{font-size:10px;font-weight:600;text-transform:uppercase;color:#64748b}
  .io-pre{margin:0;padding:8px 10px;background:#111827;border:1px solid #1e293b;border-radius:6px;font-size:11px;line-height:1.45;color:#cbd5e1;white-space:pre-wrap;word-break:break-word;max-height:320px;overflow:auto}
  .overall{height:10px;margin-bottom:18px}
  .pulse{animation:pulse 1.2s ease-in-out infinite} @keyframes pulse{0%,100%{opacity:.35}50%{opacity:1}}
  </style></head><body>
  <h1>${escapeHtml(title)}</h1>
  <div class="summary">${escapeHtml(subtitle)}</div>
  <div class="bar overall"><div class="fill" style="width:${overallPct}%;background:#3b82f6"></div></div>
  ${rows}
  </body></html>`;
}

// AI : high-level HTML view of a finished run — easy-to-read progress bars (Logging tab).
export function runToHtml(run: PipelineRun): string {
  return progressHtml(
    `Run ${run.id} — ${run.status}`,
    `${run.model} · ${run.totalMs}ms · billed ${run.billedCents.toFixed(2)}c · saved ${run.savedCents.toFixed(2)}c`,
    run.steps.map((s) => ({
      label: s.label,
      kind: s.kind,
      status: s.status,
      ms: s.ms,
      costCents: s.costCents,
      detail: [
        `${s.kind === "llm" || s.kind === "llm-batch" ? "prompt" : "in"}: ${s.inputPreview}`,
        `out: ${s.outputJson ?? s.outputPreview}`,
      ],
    })),
    false,
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
}
