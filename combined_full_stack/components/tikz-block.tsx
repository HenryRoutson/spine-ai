"use client"

import { useEffect, useRef, useState } from "react"
import { ensureTikzJax, wrapTikzPicture } from "@/lib/tikzjax-loader"
import { cn } from "@/lib/utils"

// AI : TikZJax MutationObserver replaces script[type=text/tikz] with an SVG in-place.
export function TikzBlock({ source, inverted = false }: { source: string; inverted?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const host = hostRef.current
    if (!host) return

    const onFinished = (ev: Event) => {
      const target = ev.target
      if (!(target instanceof Element)) return
      if (!host.contains(target)) return
      if (!cancelled) {
        setStatus("ok")
        setError(null)
      }
    }

    document.addEventListener("tikzjax-load-finished", onFinished)

    ;(async () => {
      try {
        setStatus("loading")
        setError(null)
        await ensureTikzJax()
        if (cancelled || !hostRef.current) return
        hostRef.current.replaceChildren()
        const script = document.createElement("script")
        script.type = "text/tikz"
        script.textContent = wrapTikzPicture(source)
        hostRef.current.appendChild(script)
        // AI : timeout so a failed compile does not spin forever (TikZJax may swap in a broken img).
        window.setTimeout(() => {
          if (cancelled) return
          if (hostRef.current?.querySelector("svg")) {
            setStatus("ok")
            return
          }
          if (hostRef.current?.querySelector("img")) {
            setStatus("error")
            setError("tikz compile failed")
          }
        }, 45_000)
      } catch (err) {
        if (!cancelled) {
          setStatus("error")
          setError(err instanceof Error ? err.message : "tikzjax failed")
        }
      }
    })()

    return () => {
      cancelled = true
      document.removeEventListener("tikzjax-load-finished", onFinished)
    }
  }, [source])

  return (
    <div
      className={cn(
        "mb-2 overflow-x-auto rounded border border-border bg-white p-3 text-black",
        inverted && "border-neutral-700",
      )}
    >
      {status === "loading" ? (
        <p className="mb-2 font-mono text-[10px] text-muted-foreground">Rendering TikZ…</p>
      ) : null}
      {status === "error" ? (
        <>
          <pre className="mb-2 overflow-x-auto font-mono text-[11px] text-destructive">
            tikz: {error ?? "render failed"}
          </pre>
          <pre className="max-h-40 overflow-auto font-mono text-[10px] text-muted-foreground whitespace-pre-wrap">
            {wrapTikzPicture(source)}
          </pre>
        </>
      ) : null}
      <div ref={hostRef} className="tikzjax-content min-h-[2rem]" />
    </div>
  )
}
