"use client"

import { useEffect, useId, useRef, useState } from "react"
import { loadMermaidRuntime } from "@/lib/mermaid-runtime"
import { cn } from "@/lib/utils"

const MONO_FONT = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"

type MermaidViewProps = {
  chart: string
  className?: string
}

// AI : client-only mermaid render — used for derived pipeline structure in documentation.
export function MermaidView({ chart, className }: MermaidViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const renderId = useId().replace(/:/g, "")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const el = containerRef.current
    if (!el || !chart.trim()) {
      setError(null)
      if (el) el.innerHTML = ""
      return
    }

    void (async () => {
      try {
        const mermaid = await loadMermaidRuntime()
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          fontFamily: MONO_FONT,
          securityLevel: "strict",
          flowchart: { htmlLabels: true, curve: "basis", padding: 20, nodeSpacing: 50, rankSpacing: 60 },
        })
        const { svg } = await mermaid.render(`pipeline-mermaid-${renderId}`, chart)
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to render diagram")
          if (containerRef.current) containerRef.current.innerHTML = ""
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [chart, renderId])

  if (!chart.trim()) return null

  return (
    <div className={cn("min-w-0", className)}>
      <div
        ref={containerRef}
        className="overflow-x-auto py-1 font-mono [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full [&_svg_.edgeLabel]:font-mono [&_svg_.edgeLabel]:text-[10px] [&_svg_.label]:font-mono [&_svg_.nodeLabel]:font-mono [&_svg_text]:font-mono"
        aria-label="Pipeline structure diagram"
      />
      {error && (
        <pre className="mt-2 overflow-x-auto rounded border border-destructive/40 bg-destructive/5 p-2 font-mono text-[10px] text-destructive">
          {error}
        </pre>
      )}
    </div>
  )
}
