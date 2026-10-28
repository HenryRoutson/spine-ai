"use client"

import { useEffect, useId, useState } from "react"
import { cn } from "@/lib/utils"

// AI : client-only mermaid — dynamic import keeps SSR bundle small.
export function MermaidBlock({ chart, inverted = false }: { chart: string; inverted?: boolean }) {
  const reactId = useId().replace(/:/g, "")
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const source = chart.trim()
    if (!source) {
      setError("empty mermaid diagram")
      setSvg(null)
      return
    }

    ;(async () => {
      try {
        const mermaid = (await import("mermaid")).default
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: inverted ? "dark" : "neutral",
        })
        const id = `mermaid-${reactId}-${Math.random().toString(36).slice(2, 8)}`
        const { svg: rendered } = await mermaid.render(id, source)
        if (!cancelled) {
          setSvg(rendered)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setSvg(null)
          setError(err instanceof Error ? err.message : "mermaid render failed")
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [chart, inverted, reactId])

  if (error) {
    return (
      <pre
        className={cn(
          "mb-2 overflow-x-auto rounded border border-destructive/40 bg-destructive/5 p-2 font-mono text-[11px] text-destructive",
        )}
      >
        mermaid: {error}
      </pre>
    )
  }

  if (!svg) {
    return (
      <div className="mb-2 rounded border border-border bg-secondary/30 px-2 py-3 text-[11px] text-muted-foreground">
        Rendering diagram…
      </div>
    )
  }

  return (
    <div
      className={cn("mb-2 overflow-x-auto rounded border border-border bg-secondary/20 p-2", inverted && "bg-black/20")}
      // AI : mermaid SVG is produced by mermaid.render under securityLevel strict.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
