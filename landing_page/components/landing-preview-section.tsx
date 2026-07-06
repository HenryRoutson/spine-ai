"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AppLivePreview } from "./app-live-preview";
import { readDemoEmail, writeDemoEmail, type demo_email_string } from "@/lib/demo-email";
import {
  LandingDemoConsentBanner,
  readDemoPrivacyConsent,
  writeDemoPrivacyConsent,
} from "@/lib/legal/demo-consent";

type ApiUrl = string;
type AppUrl = string;

type BuildResult = {
  buildId: string;
  message: string;
  projectName: string;
  moduleCount: number;
};

const PLACEHOLDER_IDEAS = [
  "classify support tickets by urgency and route to the right team",
  "extract key obligations from vendor contracts",
  "summarize meeting notes into action items and owners",
  "triage inbound sales leads by fit and intent",
  "audit expense receipts against company policy",
  "turn product feedback dumps into themed feature requests",
] as const;

const BUILD_STATUS = [
  "Mapping structure models…",
  "Drafting pipeline steps…",
  "Wiring step inputs and outputs…",
  "Validating the pipeline…",
] as const;

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
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buildMessage, setBuildMessage] = useState<string | null>(null);
  const [demoPrivacyAccepted, setDemoPrivacyAccepted] = useState(false);
  const [demoConsentNudge, setDemoConsentNudge] = useState(false);

  useEffect(() => {
    setDemoEmail(readDemoEmail());
    setDemoPrivacyAccepted(readDemoPrivacyConsent());
  }, []);

  const emailRegistered = demoEmail !== null;

  const previewBase = `${appUrl.replace(/\/$/, "")}/demo?embed=1&preview=1`;
  const iframeSrc = useMemo(
    () => (buildId ? `${previewBase}&buildId=${encodeURIComponent(buildId)}` : previewBase),
    [buildId, previewBase],
  );

  const buildPipeline = useCallback(async () => {
    const trimmed = task.trim();
    if (!trimmed || building || !demoEmail) return;

    setBuilding(true);
    setError(null);
    setBuildMessage(null);

    try {
      const res = await fetch(BUILD_PIPELINE_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: trimmed, email: demoEmail }),
      });
      let data: (BuildResult & { error?: string }) | null = null;
      try {
        data = (await res.json()) as BuildResult & { error?: string };
      } catch {
        if (!res.ok) {
          setError(res.status === 502 ? apiReachabilityError(spineApiUrl) : "Could not build pipeline — try again shortly.");
          return;
        }
      }
      if (!res.ok) {
        setError(data?.error ?? "Could not build pipeline — try again shortly.");
        return;
      }
      if (!data?.buildId) {
        setError("Could not build pipeline — try again shortly.");
        return;
      }
      setBuildId(data.buildId);
      setBuildMessage(data.message);
    } catch {
      setError(apiReachabilityError(spineApiUrl));
    } finally {
      setBuilding(false);
    }
  }, [spineApiUrl, building, demoEmail, task]);

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
      value={{ demoEmail, emailRegistered, registerEmail, task, setTask, building, error, buildMessage, tryBuild, iframeSrc }}
    >
      {children}
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
        Try the demo
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
  const { emailRegistered, task, setTask, building, error, buildMessage, tryBuild } = useLandingBuild();
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [buildStatusIdx, setBuildStatusIdx] = useState(0);

  useEffect(() => {
    if (!emailRegistered || task.trim() || building) return;
    const id = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % PLACEHOLDER_IDEAS.length);
    }, 3200);
    return () => clearInterval(id);
  }, [emailRegistered, task, building]);

  useEffect(() => {
    if (!emailRegistered || !building) {
      setBuildStatusIdx(0);
      return;
    }
    const id = setInterval(() => {
      setBuildStatusIdx((i) => (i + 1) % BUILD_STATUS.length);
    }, 1800);
    return () => clearInterval(id);
  }, [emailRegistered, building]);

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
              Building...
            </span>
          ) : (
            "Generate"
          )}
        </button>
      </div>
      {building ? (
        <p className="landing-build-status mt-3 font-mono text-[10px] uppercase tracking-wider text-accent">
          {BUILD_STATUS[buildStatusIdx]}
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm leading-relaxed text-red-400">{error}</p> : null}
      {!building && buildMessage ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">{buildMessage}</p>
      ) : null}
      {!building && !buildMessage && !error ? (
        <p className="mt-4 text-sm leading-relaxed text-muted-dim">
          Describe a workflow — we&apos;ll generate a pipeline you can explore in the preview below.
        </p>
      ) : null}
    </div>
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
