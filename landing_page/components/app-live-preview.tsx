"use client";

import { useEffect, useRef, useState } from "react";

type AppPreviewUrl = string;

type AppLivePreviewProps = {
  src: AppPreviewUrl;
};

// AI : how long we wait for the /demo iframe to announce readiness before treating it as
// AI : unreachable — covers both a genuinely down app and a frame-ancestors/deployment-protection
// AI : block, which otherwise render as a raw, unstyled browser error page inside the frame.
const READY_TIMEOUT_MS = 8000;

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

// AI : interactive iframe — loads the app /demo route as if signed in.
export function AppLivePreview({ src }: AppLivePreviewProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setStatus("loading");
    const expectedOrigin = originOf(src);

    function onMessage(event: MessageEvent) {
      if (expectedOrigin && event.origin !== expectedOrigin) return;
      const data = event.data as { source?: string; type?: string } | null;
      if (data?.source === "spine-demo" && data.type === "ready") {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setStatus("ready");
      }
    }

    window.addEventListener("message", onMessage);
    timeoutRef.current = setTimeout(() => {
      setStatus((current) => (current === "ready" ? current : "failed"));
    }, READY_TIMEOUT_MS);

    return () => {
      window.removeEventListener("message", onMessage);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // AI : re-arm on every retry (attempt) or when the target URL itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, attempt]);

  return (
    <div className="terminal-window flex h-[min(680px,72vh)] min-h-[480px] flex-col shadow-[0_24px_80px_-32px_rgba(0,0,0,0.85)]">
      <div className="terminal-titlebar shrink-0">
        <span className="terminal-dot bg-[#ff5f57]" />
        <span className="terminal-dot bg-[#febc2e]" />
        <span className="terminal-dot bg-[#28c840]" />
        <span className="ml-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-dim">
          <span className="live-dot" aria-hidden />
          Live preview
        </span>
      </div>
      <div className="relative min-h-0 flex-1 bg-black">
        <iframe
          src={src}
          title="Spine app preview"
          className="h-full w-full border-0 bg-black"
          loading="lazy"
          allow="clipboard-read; clipboard-write"
          key={`${src}:${attempt}`}
        />
        {status === "failed" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black px-6 text-center">
            <p className="max-w-sm text-sm leading-relaxed text-muted">
              The live preview didn&apos;t load in time. The app may be temporarily
              unavailable, or this browser is blocking the embedded frame.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAttempt((n) => n + 1)}
                className="zeero-btn !px-4 !py-2 !text-sm"
              >
                Retry
              </button>
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-dim underline hover:text-foreground"
              >
                Open in a new tab
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
