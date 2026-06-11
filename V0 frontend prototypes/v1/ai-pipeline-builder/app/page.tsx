"use client"

import { useState } from "react"
import { Boxes, GitBranch, FlaskConical, Play } from "lucide-react"
import { cn } from "@/lib/utils"
import { PipelineProvider } from "@/lib/store"
import { StructureBuilder } from "@/components/structure-builder"
import { PipelineBuilder } from "@/components/pipeline-builder"
import { AbTesting } from "@/components/ab-testing"
import { Inference } from "@/components/inference"

type WindowId = "structure" | "pipeline" | "abtest" | "inference"

const WINDOWS: {
  id: WindowId
  label: string
  hint: string
  icon: typeof Boxes
}[] = [
  { id: "structure", label: "Structure", hint: "01", icon: Boxes },
  { id: "pipeline", label: "Pipeline", hint: "02", icon: GitBranch },
  { id: "abtest", label: "A/B Test", hint: "03", icon: FlaskConical },
  { id: "inference", label: "Inference", hint: "04", icon: Play },
]

export default function Page() {
  const [active, setActive] = useState<WindowId>("structure")

  return (
    <PipelineProvider>
      <div className="flex h-dvh flex-col bg-background text-foreground">
        <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <span className="font-mono text-sm font-bold">F</span>
            </div>
            <div className="leading-tight">
              <h1 className="text-sm font-semibold tracking-tight">Forge</h1>
              <p className="font-mono text-[10px] text-muted-foreground">
                ai engineering pipeline builder
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <span className="hidden items-center gap-1.5 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              legal-compliance-v3
            </span>
            <span className="hidden md:inline">·</span>
            <span className="hidden md:inline">draft</span>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <nav className="flex w-14 flex-col items-center gap-1 border-r border-border py-3 sm:w-44 sm:items-stretch sm:px-2">
            {WINDOWS.map((w) => {
              const Icon = w.icon
              const isActive = active === w.id
              return (
                <button
                  key={w.id}
                  onClick={() => setActive(w.id)}
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                    "justify-center sm:justify-start",
                    isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <span className="hidden flex-1 text-left sm:inline">
                    {w.label}
                  </span>
                  <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
                    {w.hint}
                  </span>
                </button>
              )
            })}
            <div className="mt-auto hidden px-2.5 sm:block">
              <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
                pipelines are linear. left to right.
              </p>
            </div>
          </nav>

          <main className="flex-1 overflow-hidden">
            {active === "structure" && <StructureBuilder />}
            {active === "pipeline" && <PipelineBuilder />}
            {active === "abtest" && <AbTesting />}
            {active === "inference" && <Inference />}
          </main>
        </div>
      </div>
    </PipelineProvider>
  )
}
