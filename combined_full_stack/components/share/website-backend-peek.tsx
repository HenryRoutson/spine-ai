"use client"

import { GitBranch } from "lucide-react"
import { Inference } from "@/components/inference"
import { PipelineSummaryBox } from "@/components/pipeline-summary-box"
import { Button } from "@/components/ui/button"
import { useAppShell } from "@/lib/app-shell"
import { AppWindowId } from "@/lib/app-window-id"
import { useHideDeveloperTools } from "@/lib/developer-tools-settings"
import { useStore } from "@/lib/store"
import { resolveWebsitePipelineBindings } from "@/lib/website-pipelines"

// AI : non-dev website peek — high-level backend copy + run, not Structure/Pipeline editors.
export function WebsiteBackendPeek() {
  const { project, projects, setActiveProjectId } = useStore()
  const { editingWebsite, clearWebsiteEditor, setActiveWindow, setVibeObserveTab } = useAppShell()
  const hideDeveloperTools = useHideDeveloperTools()
  const bindings = resolveWebsitePipelineBindings(
    project.id,
    editingWebsite?.siteOptions.pipelineBindings ?? [],
  )

  function openPipeline(projectId: typeof project.id) {
    clearWebsiteEditor()
    if (projectId !== project.id) setActiveProjectId(projectId)
    setVibeObserveTab(AppWindowId.Inference)
    setActiveWindow(hideDeveloperTools ? AppWindowId.Vibe : AppWindowId.Structure)
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-5">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <section className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">Backend</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pipelines this website can run. This is a description and a test run — not the pipeline editor.
          </p>
          <ul className="mt-3 space-y-1.5">
            {bindings.map((binding) => {
              const name = projects.find((p) => p.id === binding.projectId)?.name ?? binding.alias
              return (
                <li key={binding.projectId} className="flex items-center justify-between gap-2">
                  <span className="inline-flex min-w-0 items-center gap-1.5 font-mono text-xs">
                    <GitBranch className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">{name}</span>
                    <span className="text-[10px] text-muted-foreground">{binding.alias}</span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px]"
                    onClick={() => openPipeline(binding.projectId)}
                    spineId="website.open-backend"
                  >
                    {hideDeveloperTools ? "Open in Vibe" : "Open pipeline"}
                  </Button>
                </li>
              )
            })}
          </ul>
        </section>
        <section className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">What this backend does</h3>
          <PipelineSummaryBox />
        </section>
        <section className="min-h-[24rem] overflow-hidden rounded-lg border border-border bg-card">
          <Inference simple />
        </section>
      </div>
    </div>
  )
}
