"use client"

import { useEffect, useId, useRef, useState } from "react"
import { loadMermaidRuntime } from "@/lib/mermaid-runtime"
import { MERMAID_VERBOSE_STEP_LABELS } from "@/lib/pipeline-mermaid"
import { cn } from "@/lib/utils"

const MONO_FONT = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"

type MermaidViewProps = {
  chart: string
  className?: string
}

// AI : mermaid htmlLabels clip when foreignObject is narrower than the text; expand to content.
function unclipMermaidNodeLabels(root: HTMLElement): void {
  for (const fo of root.querySelectorAll("foreignObject")) {
    const inner = fo.querySelector("div")
    if (!inner) continue
    const w = Math.ceil(Math.max(inner.scrollWidth, inner.offsetWidth, Number(fo.getAttribute("width") ?? 0)))
    const h = Math.ceil(Math.max(inner.scrollHeight, inner.offsetHeight, Number(fo.getAttribute("height") ?? 0)))
    const prevW = Number(fo.getAttribute("width") ?? 0)
    const prevH = Number(fo.getAttribute("height") ?? 0)
    if (w > prevW) {
      const dw = w - prevW
      fo.setAttribute("width", String(w))
      fo.setAttribute("x", String(Number(fo.getAttribute("x") ?? 0) - dw / 2))
      const rect = fo.closest("g.node")?.querySelector("rect")
      if (rect) {
        rect.setAttribute("width", String(w))
        rect.setAttribute("x", String(Number(rect.getAttribute("x") ?? 0) - dw / 2))
      }
    }
    if (h > prevH) {
      const dh = h - prevH
      fo.setAttribute("height", String(h))
      fo.setAttribute("y", String(Number(fo.getAttribute("y") ?? 0) - dh / 2))
      const rect = fo.closest("g.node")?.querySelector("rect")
      if (rect) {
        rect.setAttribute("height", String(h))
        rect.setAttribute("y", String(Number(rect.getAttribute("y") ?? 0) - dh / 2))
      }
    }
  }
}

function mermaidFlowchartConfig(verbose: boolean): Record<string, unknown> {
  if (verbose) {
    return {
      startOnLoad: false,
      theme: "base",
      fontFamily: MONO_FONT,
      securityLevel: "strict",
      useMaxWidth: false,
      themeCSS:
        ".label,.edgeLabel,.nodeLabel,foreignObject{overflow:visible!important}.nodeLabel div{white-space:nowrap}",
      flowchart: {
        htmlLabels: true,
        curve: "basis",
        padding: 20,
        nodeSpacing: 80,
        rankSpacing: 80,
        wrappingWidth: 480,
        useMaxWidth: false,
      },
    }
  }
  return {
    startOnLoad: false,
    theme: "base",
    fontFamily: MONO_FONT,
    securityLevel: "strict",
    useMaxWidth: false,
    themeCSS: ".node,.node .label,.edgeLabel{overflow:visible!important}",
    flowchart: {
      htmlLabels: false,
      curve: "basis",
      padding: 12,
      nodeSpacing: 40,
      rankSpacing: 56,
      wrappingWidth: 999,
      useMaxWidth: false,
    },
  }
}

// AI : SVG text labels by default — htmlLabels + unclip when MERMAID_VERBOSE_STEP_LABELS.
export function MermaidView({ chart, className }: MermaidViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const renderId = useId().replace(/:/g, "")
  const [error, setError] = useState<string | null>(null)
  const verbose = MERMAID_VERBOSE_STEP_LABELS

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
        mermaid.initialize(mermaidFlowchartConfig(verbose))
        const { svg } = await mermaid.render(`pipeline-mermaid-${renderId}`, chart)
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg
          if (verbose) unclipMermaidNodeLabels(containerRef.current)
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
  }, [chart, renderId, verbose])

  if (!chart.trim()) return null

  return (
    <div className={cn("min-w-0", className)}>
      <div
        ref={containerRef}
        className="overflow-x-auto py-1 [&_svg]:mx-auto [&_svg]:h-auto"
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
