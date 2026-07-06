"use client";

type AppPreviewUrl = string;

type AppLivePreviewProps = {
  src: AppPreviewUrl;
};

// AI : interactive iframe — loads the app /demo route as if signed in.
export function AppLivePreview({ src }: AppLivePreviewProps) {
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
      <iframe
        src={src}
        title="Spine app preview"
        className="min-h-0 w-full flex-1 border-0 bg-black"
        loading="lazy"
        allow="clipboard-read; clipboard-write"
        key={src}
      />
    </div>
  );
}
