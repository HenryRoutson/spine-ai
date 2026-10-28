"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppLivePreview } from "./app-live-preview";
import { LandingLoggingTrace } from "./landing-run-trace";
import { LandingSessionReplayRecorder } from "./landing-session-replay";
import { copyTextToClipboard } from "@/lib/clipboard";
import { readDemoEmail, writeDemoEmail, type demo_email_string } from "@/lib/demo-email";
import { SESSION_REPLAY_ENABLED } from "@/lib/session-replay-enabled";
import {
  readLandingDemoBuildStream,
  type LandingBuildResult,
  type LandingRunTrace,
  type landing_demo_stream_phase,
} from "@/lib/landing-demo-stream";
import {
  LandingDemoConsentBanner,
  readDemoPrivacyConsent,
  writeDemoPrivacyConsent,
} from "@/lib/legal/demo-consent";

type ApiUrl = string;
type AppUrl = string;

const PLACEHOLDER_IDEAS = [
  "classify support tickets by urgency and route to the right team",
  "extract key obligations from vendor contracts",
  "summarize meeting notes into action items and owners",
  "triage inbound sales leads by fit and intent",
  "audit expense receipts against company policy",
  "turn product feedback dumps into themed feature requests",
] as const;

const PHASE_LABEL: Record<landing_demo_stream_phase, string> = {
  thinking: "Thinking…",
  structuring: "Drafting pipeline…",
  retrying: "Fixing validation…",
  running: "Running on example files…",
};

function apiReachabilityError(spineApiUrl: ApiUrl): string {
  const host = spineApiUrl.replace(/\/$/, "");
  return `Couldn't reach the Spine app at ${host}. The landing page calls that server to build your pipeline — start it from combined_full_stack (npm run dev, usually port 3000). If the app runs elsewhere, set SPINE_API_URL on the landing page to match.`;
}

const BUILD_PIPELINE_PATH = "/api/landing-demo/build-pipeline";
const SIGNUP_PATH = "/api/landing-demo/signup";
// AI : TODO (spec) — landing build-pipeline demo reliability; task→pipeline often fails on complex prompts (see TODO.txt).

type LandingBuildContextValue = {
  demoEmail: demo_email_string | null;
  emailRegistered: boolean;
  registerEmail: (email: demo_email_string) => Promise<{ ok: true } | { ok: false; error: string }>;
  task: string;
  setTask: (task: string) => void;
  building: boolean;
  error: string | null;
  buildMessage: string | null;
  streamThinking: string;
  streamMessage: string;
  streamPhase: landing_demo_stream_phase | null;
  runTrace: LandingRunTrace | null;
  exampleDocNames: string[];
  tryBuild: () => void;
  iframeSrc: string;
};

const LandingBuildContext = createContext<LandingBuildContextValue | null>(null);

function useLandingBuild(): LandingBuildContextValue {
  const ctx = useContext(LandingBuildContext);
  if (!ctx) throw new Error("useLandingBuild must be used within LandingBuildProvider");
  return ctx;
}

export function LandingBuildProvider({
  spineApiUrl,
  appUrl,
  children,
}: {
  spineApiUrl: ApiUrl;
  appUrl: AppUrl;
  children: ReactNode;
}) {
  const [task, setTask] = useState("");
  const [demoEmail, setDemoEmail] = useState<demo_email_string | null>(null);
  const [buildId, setBuildId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buildMessage, setBuildMessage] = useState<string | null>(null);
  const [streamThinking, setStreamThinking] = useState("");
  const [streamMessage, setStreamMessage] = useState("");
  const [streamPhase, setStreamPhase] = useState<landing_demo_stream_phase | null>(null);
  const [runTrace, setRunTrace] = useState<LandingRunTrace | null>(null);
  const [exampleDocNames, setExampleDocNames] = useState<string[]>([]);
  const [demoPrivacyAccepted, setDemoPrivacyAccepted] = useState(false);
  const [demoConsentNudge, setDemoConsentNudge] = useState(false);

  useEffect(() => {
    setDemoEmail(readDemoEmail());
    setDemoPrivacyAccepted(readDemoPrivacyConsent());
  }, []);

  const emailRegistered = demoEmail !== null;

  const previewBase = `${appUrl.replace(/\/$/, "")}/demo?embed=1&preview=1`;
  const iframeSrc = useMemo(() => {
    if (!buildId) return previewBase;
    const params = new URLSearchParams({ buildId });
    // AI : SECURITY — pass HMAC access token so /api/demo/state can authorize the build.
    if (accessToken) params.set("accessToken", accessToken);
    return `${previewBase}&${params.toString()}`;
  }, [accessToken, buildId, previewBase]);

  const buildPipeline = useCallback(async () => {
    const trimmed = task.trim();
    if (!trimmed || building || !demoEmail || !demoPrivacyAccepted) return;

    setBuilding(true);
    setError(null);
    setBuildMessage(null);
    setStreamThinking("");
    setStreamMessage("");
    setStreamPhase("thinking");
    setRunTrace(null);
    setExampleDocNames([]);

    try {
      const res = await fetch(BUILD_PIPELINE_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: trimmed, email: demoEmail, privacyAccepted: true as const }),
      });

      const contentType = res.headers.get("Content-Type") ?? "";
      // AI : pre-stream JSON errors (rate limit, validation) vs NDJSON token stream.
      if (!res.ok && !contentType.includes("ndjson")) {
        let data: { error?: string } | null = null;
        try {
          data = (await res.json()) as { error?: string };
        } catch {
          setError(res.status === 502 ? apiReachabilityError(spineApiUrl) : "Could not build pipeline — try again shortly.");
          return;
        }
        setError(data?.error ?? "Could not build pipeline — try again shortly.");
        return;
      }

      const data: LandingBuildResult = await readLandingDemoBuildStream(res, {
        onThinkingDelta: (delta) => setStreamThinking((prev) => prev + delta),
        onThinkingDone: (text) => setStreamThinking(text),
        onMessageDelta: (delta) => setStreamMessage((prev) => prev + delta),
        onPhase: (phase) => setStreamPhase(phase),
      });

      setBuildId(data.buildId);
      setAccessToken(data.accessToken ?? null);
      setBuildMessage(data.message);
      setStreamMessage(data.message);
      setExampleDocNames(data.exampleDocNames ?? data.run?.exampleDocNames ?? []);
      setRunTrace(data.run ?? null);
      setStreamPhase(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(
        message && !message.includes("Failed to fetch")
          ? message
          : apiReachabilityError(spineApiUrl),
      );
    } finally {
      setBuilding(false);
    }
  }, [spineApiUrl, building, demoEmail, demoPrivacyAccepted, task]);

  const registerEmail = useCallback(async (email: demo_email_string): Promise<{ ok: true } | { ok: false; error: string }> => {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return { ok: false, error: "Enter your email to continue." };

    try {
      const res = await fetch(SIGNUP_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });
      let data: { error?: string } | null = null;
      try {
        data = (await res.json()) as { error?: string };
      } catch {
        if (!res.ok) {
          return { ok: false, error: res.status === 502 ? apiReachabilityError(spineApiUrl) : "Could not save email — try again shortly." };
        }
      }
      if (!res.ok) {
        return { ok: false, error: data?.error ?? "Could not save email — try again shortly." };
      }
      writeDemoEmail(normalized);
      setDemoEmail(normalized);
      return { ok: true };
    } catch {
      return { ok: false, error: apiReachabilityError(spineApiUrl) };
    }
  }, [spineApiUrl]);

  const acceptDemoPrivacy = useCallback(() => {
    writeDemoPrivacyConsent();
    setDemoPrivacyAccepted(true);
    setDemoConsentNudge(false);
  }, []);

  const tryBuild = useCallback(() => {
    if (!demoEmail || !task.trim() || building) return;
    if (!demoPrivacyAccepted) {
      setDemoConsentNudge(true);
      return;
    }
    void buildPipeline();
  }, [building, buildPipeline, demoEmail, demoPrivacyAccepted, task]);

  return (
    <LandingBuildContext.Provider
      value={{
        demoEmail,
        emailRegistered,
        registerEmail,
        task,
        setTask,
        building,
        error,
        buildMessage,
        streamThinking,
        streamMessage,
        streamPhase,
        runTrace,
        exampleDocNames,
        tryBuild,
        iframeSrc,
      }}
    >
      {children}
      <LandingSessionReplayRecorder
        email={demoEmail}
        enabled={SESSION_REPLAY_ENABLED && emailRegistered && demoPrivacyAccepted}
        buildId={buildId}
      />
      <LandingDemoConsentBanner
        visible={emailRegistered && !demoPrivacyAccepted}
        nudge={demoConsentNudge}
        onAccept={acceptDemoPrivacy}
      />
    </LandingBuildContext.Provider>
  );
}

export function LandingEmailGate() {
  const { emailRegistered, registerEmail } = useLandingBuild();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (emailRegistered) return null;

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await registerEmail(email);
    if (!result.ok) setError(result.error);
    setSubmitting(false);
  };

  return (
    <div className="landing-task-panel flex h-full flex-col justify-center rounded-[10px] border border-line bg-panel p-5 sm:p-6 lg:min-h-[300px]">
      <h2 className="landing-task-heading text-xl font-normal leading-snug tracking-tight sm:text-2xl">
        Try the demo below
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Enter your email to generate a pipeline and explore the preview. We&apos;ll send product updates occasionally.
      </p>
      <div className="mt-5 flex flex-col gap-3">
        <input
          id="landing-email"
          type="email"
          autoComplete="email"
          value={email}
          disabled={submitting}
          placeholder="you@company.com"
          className="w-full rounded-md border border-line bg-black px-4 py-3 text-base text-foreground placeholder:text-muted-dim focus:border-accent-dim focus:outline-none disabled:opacity-60 sm:text-lg"
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
        />
        <button
          type="button"
          className="zeero-btn !text-base !px-6 !py-3 w-full disabled:opacity-50 sm:w-auto sm:self-start"
          disabled={submitting || !email.trim()}
          onClick={() => void submit()}
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <span className="demo-spinner border-primary-foreground border-t-transparent" aria-hidden />
              Continuing...
            </span>
          ) : (
            "Continue"
          )}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm leading-relaxed text-red-400">{error}</p> : null}
    </div>
  );
}

export function LandingTaskPrompt() {
  const { emailRegistered, task, setTask, building, error, tryBuild } = useLandingBuild();
  const [placeholderIdx, setPlaceholderIdx] = useState(0);

  useEffect(() => {
    if (!emailRegistered || task.trim() || building) return;
    const id = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % PLACEHOLDER_IDEAS.length);
    }, 3200);
    return () => clearInterval(id);
  }, [emailRegistered, task, building]);

  if (!emailRegistered) return null;

  const placeholder = PLACEHOLDER_IDEAS[placeholderIdx]!;

  return (
    <div
      className={`landing-task-panel flex h-full flex-col justify-center rounded-[10px] border bg-panel p-5 sm:p-6 lg:min-h-[300px]${building ? " landing-task-panel-building" : " border-line"}`}
    >
      <label htmlFor="landing-task" className="landing-task-heading text-xl font-normal leading-snug tracking-tight sm:text-2xl">
        What would you like to automate?
      </label>
      <div className="mt-5 flex flex-col gap-3">
        <input
          id="landing-task"
          type="text"
          value={task}
          disabled={building}
          placeholder={placeholder}
          className="w-full rounded-md border border-line bg-black px-4 py-3 text-base text-foreground placeholder:text-muted-dim placeholder:transition-opacity focus:border-accent-dim focus:outline-none disabled:opacity-60 sm:text-lg"
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") tryBuild();
          }}
        />
        <button
          type="button"
          className="zeero-btn !text-base !px-6 !py-3 w-full disabled:opacity-50 sm:w-auto sm:self-start"
          disabled={building || !task.trim()}
          onClick={tryBuild}
        >
          {building ? (
            <span className="inline-flex items-center gap-2">
              <span className="demo-spinner border-primary-foreground border-t-transparent" aria-hidden />
              Building &amp; running...
            </span>
          ) : (
            "Generate"
          )}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm leading-relaxed text-red-400">{error}</p> : null}
      {!building && !error ? (
        <p className="mt-4 text-sm leading-relaxed text-muted-dim">
          Describe a workflow — we&apos;ll build a pipeline, run it on example files, and show the full step trace below.
        </p>
      ) : null}
    </div>
  );
}

// AI : streamed LLM output sits above the live app preview — grows page length (no nested scroll).
export function LandingLlmStreamSection() {
  const {
    emailRegistered,
    building,
    buildMessage,
    streamThinking,
    streamMessage,
    streamPhase,
  } = useLandingBuild();
  const streamEndRef = useRef<HTMLDivElement>(null);

  // AI : jump to the stream section when Generate starts, then follow tokens as they arrive.
  useEffect(() => {
    if (!building) return;
    document.getElementById("llm-stream")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [building]);

  useEffect(() => {
    if (!building) return;
    if (!streamThinking && !streamMessage) return;
    streamEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [building, streamThinking, streamMessage]);

  if (!emailRegistered) return null;

  const phaseLabel = streamPhase ? PHASE_LABEL[streamPhase] : null;
  const finalMessage = !building ? streamMessage || buildMessage : null;
  const hasContent = Boolean(streamThinking || streamMessage || finalMessage);
  if (!building && !hasContent) return null;

  return (
    <section
      id="llm-stream"
      className="mx-auto max-w-[1200px] scroll-mt-24 border-x border-b border-line px-8 py-8 sm:px-12 sm:py-10"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-normal tracking-tight sm:text-3xl">Agent output</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Live tokens from the pipeline builder — before the app preview updates.
          </p>
        </div>
        {building && phaseLabel ? (
          <p className="landing-build-status font-mono text-[10px] uppercase tracking-wider text-accent">
            {phaseLabel}
          </p>
        ) : null}
      </div>
      <div className="landing-stream mt-5 rounded-[10px] border border-line bg-panel px-4 py-4" aria-live="polite">
        {building && !hasContent ? (
          <p className="font-mono text-[13px] leading-relaxed text-muted-dim">
            Waiting for the first tokens…
            <span className="landing-stream-caret" aria-hidden />
          </p>
        ) : null}
        {streamThinking ? (
          <pre className="landing-stream-tokens landing-stream-thinking whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-muted-dim">
            {streamThinking}
            {building && !streamMessage ? <span className="landing-stream-caret" aria-hidden /> : null}
          </pre>
        ) : null}
        {(streamMessage || finalMessage) ? (
          <pre
            className={`landing-stream-tokens landing-stream-message whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-muted${streamThinking ? " mt-4" : ""}`}
          >
            {streamMessage || finalMessage}
            {building ? <span className="landing-stream-caret" aria-hidden /> : null}
          </pre>
        ) : null}
        <div ref={streamEndRef} />
      </div>
    </section>
  );
}

export function LandingAppPreview() {
  const { emailRegistered, iframeSrc } = useLandingBuild();
  if (!emailRegistered) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-[10px] border border-line bg-panel px-6 py-16 text-center">
        <p className="max-w-md text-sm leading-relaxed text-muted">
          Enter your email above to unlock the live preview and generate a pipeline.
        </p>
      </div>
    );
  }
  return <AppLivePreview src={iframeSrc} />;
}

// AI : full diagnostic dump — never truncate; copy button for paste into issues/debug.
function LandingRunErrorPanel({ error }: { error: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    await copyTextToClipboard(error);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [error]);

  return (
    <div className="landing-run-error mt-4 overflow-hidden rounded-[10px] border border-red-500/40 bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-500/30 px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-wider text-red-400">
          Run error · full diagnostic
        </p>
        <button
          type="button"
          className="rounded-md border border-line bg-black px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-foreground transition-colors hover:border-accent-dim hover:text-accent"
          onClick={() => void onCopy()}
        >
          {copied ? "Copied" : "Copy error"}
        </button>
      </div>
      {/* AI : no nested scroller — diagnostic grows the landing page like the step trace */}
      <pre className="landing-run-error-body whitespace-pre-wrap break-words px-4 py-4 font-mono text-[12px] leading-relaxed text-red-300">
        {error}
      </pre>
    </div>
  );
}

// AI : Logging-shaped step trace + pipeline view — page length, not a nested iframe scroller.
export function LandingRunTraceSection() {
  const { emailRegistered, building, runTrace, exampleDocNames } = useLandingBuild();

  if (!emailRegistered) return null;
  if (!building && !runTrace) return null;

  const statusLabel = runTrace?.error
    ? "error"
    : runTrace?.status ?? (building ? "running" : "idle");
  const hasStructuredTrace = !!(runTrace?.steps?.length || runTrace?.modules?.length);

  return (
    <section
      id="run-trace"
      className="mx-auto max-w-[1200px] scroll-mt-24 border-x border-b border-line px-8 py-10 sm:px-12 sm:py-12"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-normal tracking-tight sm:text-3xl">Pipeline run trace</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Same step logging as the app — expanded on the page above the live preview, not inside a nested scroller.
          </p>
        </div>
        {runTrace ? (
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-dim">
            {statusLabel} · {runTrace.totalMs}ms · {runTrace.billedCents.toFixed(2)}c
          </p>
        ) : null}
      </div>

      {exampleDocNames.length > 0 ? (
        <p className="mt-4 font-mono text-[11px] text-muted">
          example files: {exampleDocNames.join(" · ")}
        </p>
      ) : null}

      {runTrace?.error ? <LandingRunErrorPanel error={runTrace.error} /> : null}

      {building && !runTrace ? (
        <div className="mt-6 flex min-h-[280px] items-center justify-center rounded-[10px] border border-line bg-panel">
          <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-accent">
            <span className="demo-spinner border-accent border-t-transparent" aria-hidden />
            Building pipeline and running example files…
          </p>
        </div>
      ) : null}

      {runTrace && hasStructuredTrace ? <LandingLoggingTrace run={runTrace} /> : null}

      {/* AI : legacy HTML fallback only when structured steps are missing */}
      {runTrace?.traceHtml && !hasStructuredTrace ? (
        <div className="landing-run-trace mt-6 overflow-visible rounded-[10px] border border-line bg-white">
          <iframe
            title="Pipeline run step trace"
            className="landing-run-trace-frame w-full border-0 bg-white"
            srcDoc={runTrace.traceHtml}
            sandbox=""
          />
        </div>
      ) : null}
    </section>
  );
}
