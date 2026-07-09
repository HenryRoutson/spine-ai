"use client";

// AI : app-Logging-shaped step trace + pipeline view — grows the landing page (no nested scrollers).

import { useState } from "react";
import type {
  LandingPipelineModuleTrace,
  LandingRunStepTrace,
  LandingRunTrace,
} from "@/lib/landing-demo-stream";

type cents_amount = number;
type latency_ms = number;

function formatCostCents(cents: cents_amount): string {
  if (!Number.isFinite(cents) || cents <= 0) return "$0.00";
  const usd = cents / 100;
  const s = usd
    .toFixed(8)
    .replace(/(\.\d*?[1-9])0+$/, "$1")
    .replace(/\.0+$/, "")
    .replace(/\.$/, "");
  return `$${s}`;
}

function formatSecondsShort(ms: latency_ms): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function stepIoLabels(kind: string): { inTitle: string; outTitle: string } {
  if (kind === "quote") return { inTitle: "Source + extracts", outTitle: "Linked quotes" };
  const isLlm = kind === "llm" || kind === "llm-batch";
  return {
    inTitle: isLlm ? "Prompt" : "Input",
    outTitle: isLlm ? "Response" : "Output",
  };
}

function statusTone(status: string): string {
  if (status === "ok" || status === "cached") return "text-accent border-accent-dim";
  if (status === "error") return "text-red-400 border-red-500/40";
  return "text-muted border-line";
}

function compactPreview(text: string, max = 280): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function LandingIoBlock({
  title,
  qualifier,
  body,
  error,
}: {
  title: string;
  qualifier: string;
  body: string;
  error?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!body && !error) return null;
  return (
    <div className="mt-2 rounded-md border border-line bg-black/40">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-dim">
          {title} · {qualifier}
        </span>
        <span className="font-mono text-[10px] text-muted-dim">{open ? "hide" : "show"}</span>
      </button>
      {!open ? (
        <p className="border-t border-line px-3 py-2 font-mono text-[11px] leading-relaxed text-muted">
          {compactPreview(body)}
        </p>
      ) : (
        <pre
          className={`max-h-none overflow-visible whitespace-pre-wrap break-words border-t border-line px-3 py-2 font-mono text-[11px] leading-relaxed ${
            error ? "text-red-300" : "text-foreground"
          }`}
        >
          {body}
        </pre>
      )}
    </div>
  );
}

function LandingStepRow({ step, index }: { step: LandingRunStepTrace; index: number }) {
  const { inTitle, outTitle } = stepIoLabels(step.kind);
  const outBody = step.outputJson ?? step.outputPreview;
  return (
    <li className="rounded-md border border-line bg-panel px-3 py-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-[10px] text-muted-dim">{index + 1}</span>
        <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted">
          {step.kind}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs">{step.label}</span>
        {step.status === "cached" ? (
          <span className="rounded border border-accent-dim px-1.5 py-0.5 font-mono text-[10px] text-accent">
            cached
          </span>
        ) : null}
        <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${statusTone(step.status)}`}>
          {step.status}
        </span>
        {step.model ? (
          <span className="font-mono text-[10px] text-muted-dim">{step.model}</span>
        ) : null}
        <span className="w-14 text-right font-mono text-[10px] text-muted-dim">{step.ms}ms</span>
        <span className="w-20 text-right font-mono text-[10px] text-muted-dim">
          {step.status === "cached" && (step.savedCostCents ?? 0) > 0
            ? `saved ${formatCostCents(step.savedCostCents!)}`
            : formatCostCents(step.costCents)}
        </span>
      </div>

      {step.kind !== "input" ? (
        <LandingIoBlock title={inTitle} qualifier="input" body={step.inputPreview} />
      ) : (
        <LandingIoBlock title="Loaded doc" qualifier="input" body={step.inputPreview} />
      )}

      {step.status === "error" && step.outputPreview ? (
        <LandingIoBlock title="Validation errors" qualifier="error" body={step.outputPreview} error />
      ) : null}

      {!(step.kind === "input" && !outBody) ? (
        <LandingIoBlock title={outTitle} qualifier="output" body={outBody} />
      ) : null}
    </li>
  );
}

function LandingPipelineView({
  modules,
  steps,
}: {
  modules: LandingPipelineModuleTrace[];
  steps: LandingRunStepTrace[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(modules[0]?.id ?? null);
  const statusByModule = new Map(steps.map((s) => [s.moduleId, s.status]));
  const selected = modules.find((m) => m.id === selectedId) ?? null;

  return (
    <div className="mt-8 rounded-lg border border-line bg-panel">
      <div className="border-b border-line px-4 py-2.5">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Pipeline at run time</h3>
        <p className="mt-0.5 font-mono text-[10px] text-muted-dim">
          Same linear layout as the Logging tab — click a step to inspect its config.
        </p>
      </div>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]">
        <div className="overflow-x-auto px-4 py-6">
          <div className="mx-auto flex w-full max-w-xl flex-col items-stretch">
            <div className="mx-auto flex w-full flex-col items-center">
              <div className="rounded-md border border-line bg-black px-4 py-2 font-mono text-[11px] text-muted-dim">
                Start
              </div>
              <div className="h-4 w-px bg-line" aria-hidden />
            </div>
            {modules.map((m, i) => {
              const st = statusByModule.get(m.id);
              const isSelected = m.id === selectedId;
              return (
                <div key={m.id} className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => setSelectedId(m.id)}
                    className={`w-full max-w-md rounded-md border px-3 py-2.5 text-left transition-colors ${
                      isSelected
                        ? "border-accent-dim bg-accent-dim/20"
                        : "border-line bg-black hover:border-line-bright"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] uppercase text-muted-dim">{m.kind}</span>
                      {st ? (
                        <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${statusTone(st)}`}>
                          {st}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate font-mono text-xs text-foreground">{m.label}</p>
                    {m.note ? (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted">{m.note}</p>
                    ) : null}
                  </button>
                  {i < modules.length - 1 ? <div className="h-4 w-px bg-line" aria-hidden /> : null}
                </div>
              );
            })}
            <div className="mx-auto flex w-full flex-col items-center">
              <div className="h-4 w-px bg-line" aria-hidden />
              <div className="rounded-md border border-line bg-black px-4 py-2 font-mono text-[11px] text-muted-dim">
                End
              </div>
            </div>
          </div>
        </div>
        <aside className="border-t border-line lg:border-l lg:border-t-0">
          <div className="border-b border-line px-4 py-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-dim">Inspector</span>
          </div>
          {selected ? (
            <div className="space-y-3 px-4 py-3">
              <div>
                <p className="font-mono text-[10px] uppercase text-muted-dim">Step</p>
                <p className="mt-0.5 font-mono text-xs">{selected.label}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase text-muted-dim">Kind</p>
                <p className="mt-0.5 font-mono text-xs">{selected.kind}</p>
              </div>
              {selected.model ? (
                <div>
                  <p className="font-mono text-[10px] uppercase text-muted-dim">Model</p>
                  <p className="mt-0.5 font-mono text-xs">{selected.model}</p>
                </div>
              ) : null}
              {selected.note ? (
                <div>
                  <p className="font-mono text-[10px] uppercase text-muted-dim">Note</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">{selected.note}</p>
                </div>
              ) : null}
              {selected.prompt ? (
                <div>
                  <p className="font-mono text-[10px] uppercase text-muted-dim">Prompt</p>
                  <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-foreground">
                    {selected.prompt}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="px-4 py-6 text-xs text-muted-dim">Select a step to inspect.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

export function LandingLoggingTrace({ run }: { run: LandingRunTrace }) {
  const steps = run.steps ?? [];
  const modules = run.modules ?? [];
  const savedCents = run.savedCents ?? 0;
  const cacheHits = steps.filter((s) => s.status === "cached").length;

  return (
    <div className="mt-6 space-y-4">
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase text-muted-dim">Run</p>
        <p className="break-all font-mono text-xs">{run.runId}</p>
        {run.model ? (
          <p className="mt-1 font-mono text-[10px] text-muted-dim">{run.model}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Latency", value: formatSecondsShort(run.totalMs) },
          { label: "Billed", value: formatCostCents(run.billedCents) },
          { label: "Saved (cache)", value: formatCostCents(savedCents) },
          {
            label: "Cache hits",
            value: steps.length ? `${cacheHits}/${steps.length}` : "0/0",
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-md border border-line bg-panel p-2.5">
            <p className="font-mono text-[10px] uppercase text-muted-dim">{stat.label}</p>
            <p className="mt-0.5 font-mono text-sm">{stat.value}</p>
          </div>
        ))}
      </div>

      {steps.length > 0 ? (
        <div>
          <div className="mb-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Step trace</h3>
          </div>
          <ol className="space-y-1.5">
            {steps.map((step, i) => (
              <LandingStepRow key={`${step.moduleId}-${i}`} step={step} index={i} />
            ))}
          </ol>
        </div>
      ) : (
        <p className="font-mono text-[11px] text-muted-dim">No step rows recorded for this run.</p>
      )}

      {modules.length > 0 ? <LandingPipelineView modules={modules} steps={steps} /> : null}
    </div>
  );
}
