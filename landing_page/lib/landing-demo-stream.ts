// AI : NDJSON event types mirrored from combined_full_stack/lib/landing-demo-stream.ts

export const LANDING_DEMO_STREAM_EVENT = {
  THINKING_DELTA: "thinking_delta",
  THINKING_DONE: "thinking_done",
  MESSAGE_DELTA: "message_delta",
  PHASE: "phase",
  DONE: "done",
  ERROR: "error",
} as const;

export type landing_demo_stream_phase =
  | "thinking"
  | "structuring"
  | "retrying"
  | "running";

// AI : mirrors app Logging step rows — rendered inline on the landing page (no nested iframe scroll).
export type LandingRunStepTrace = {
  moduleId: string;
  kind: string;
  label: string;
  model?: string;
  status: string;
  ms: number;
  costCents: number;
  savedCostCents?: number;
  inputPreview: string;
  outputPreview: string;
  outputJson?: string;
};

// AI : pipeline-at-run-time nodes — same linear view as Logging's pipeline canvas, page-length.
export type LandingPipelineModuleTrace = {
  id: string;
  kind: string;
  label: string;
  note: string;
  model?: string;
  prompt?: string;
};

export type LandingRunTrace = {
  runId: string;
  status: string;
  totalMs: number;
  billedCents: number;
  savedCents?: number;
  model?: string;
  exampleDocNames: string[];
  steps?: LandingRunStepTrace[];
  modules?: LandingPipelineModuleTrace[];
  // AI : optional legacy HTML — landing prefers structured steps when present.
  traceHtml?: string;
  error?: string;
};

export type LandingBuildResult = {
  buildId: string;
  message: string;
  projectName: string;
  moduleCount: number;
  exampleDocNames?: string[];
  run?: LandingRunTrace | null;
};

export type LandingDemoStreamHandlers = {
  onThinkingDelta?: (delta: string) => void;
  onThinkingDone?: (text: string) => void;
  onMessageDelta?: (delta: string) => void;
  onPhase?: (phase: landing_demo_stream_phase) => void;
};

export async function readLandingDemoBuildStream(
  res: Response,
  handlers: LandingDemoStreamHandlers = {},
): Promise<LandingBuildResult> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("empty response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let result: LandingBuildResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const evt = JSON.parse(line) as Record<string, unknown> & { type: string };

      if (evt.type === LANDING_DEMO_STREAM_EVENT.THINKING_DELTA && typeof evt.text === "string") {
        handlers.onThinkingDelta?.(evt.text);
      }
      if (evt.type === LANDING_DEMO_STREAM_EVENT.THINKING_DONE && typeof evt.text === "string") {
        handlers.onThinkingDone?.(evt.text);
      }
      if (evt.type === LANDING_DEMO_STREAM_EVENT.MESSAGE_DELTA && typeof evt.text === "string") {
        handlers.onMessageDelta?.(evt.text);
      }
      if (evt.type === LANDING_DEMO_STREAM_EVENT.PHASE && typeof evt.phase === "string") {
        handlers.onPhase?.(evt.phase as landing_demo_stream_phase);
      }
      if (evt.type === LANDING_DEMO_STREAM_EVENT.ERROR) {
        throw new Error(typeof evt.error === "string" ? evt.error : "Pipeline build failed");
      }
      if (evt.type === LANDING_DEMO_STREAM_EVENT.DONE) {
        result = evt.result as LandingBuildResult;
      }
    }
  }

  if (!result?.buildId) throw new Error("Build stream ended without a result");
  return result;
}
