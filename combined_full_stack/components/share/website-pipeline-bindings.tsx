"use client"

import { useMemo } from "react"
import { GitBranch, Plus, X } from "lucide-react"
import { DeleteButton } from "@/components/delete-button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { spineActionProps } from "@/lib/core/parity"
import { readAccountStateCache } from "@/lib/project-state-cache"
import type { Project, ProjectId } from "@/lib/types"
import type { HostedSiteOptions, hosted_run_input_visibility, hosted_run_output_view } from "@/lib/shared-link-types"
import { normalizeHostedRunInputChrome } from "@/lib/hosted-run-chrome"
import {
  bindingsFromProjectIds,
  insertWebsitePipelineInCode,
  resolveWebsitePipelineBindings,
  stripWebsitePipelineFromCode,
  websiteBoundProjectIds,
} from "@/lib/website-pipelines"

export function WebsitePipelineBindings({
  primaryProjectId,
  projects,
  options,
  onChange,
  className,
}: {
  primaryProjectId: ProjectId
  projects: Pick<Project, "id" | "name">[]
  options: HostedSiteOptions
  onChange: (next: HostedSiteOptions) => void
  className?: string
}) {
  const linked = useMemo(
    () => resolveWebsitePipelineBindings(primaryProjectId, options.pipelineBindings),
    [primaryProjectId, options.pipelineBindings],
  )
  const linkedIds = useMemo(
    () => websiteBoundProjectIds(primaryProjectId, options.pipelineBindings),
    [primaryProjectId, options.pipelineBindings],
  )
  // AI : studio store + picker cache — Add must list every pipeline that is not already on the page.
  const catalog = useMemo(() => {
    const byId = new Map<ProjectId, Pick<Project, "id" | "name">>()
    for (const p of projects) byId.set(p.id, { id: p.id, name: p.name })
    for (const p of readAccountStateCache()?.projects ?? []) {
      if (!byId.has(p.id)) byId.set(p.id, { id: p.id, name: p.name })
    }
    return [...byId.values()]
  }, [projects])
  const available = catalog.filter((p) => !linkedIds.includes(p.id))

  function add(projectId: ProjectId) {
    if (linkedIds.includes(projectId)) return
    const nextIds = [...linkedIds, projectId]
    const pipelineBindings = bindingsFromProjectIds(nextIds, catalog, options.pipelineBindings)
    const added = pipelineBindings.find((b) => b.projectId === projectId)
    if (!added) return
    onChange(insertWebsitePipelineInCode({ ...options, pipelineBindings }, added.alias))
  }

  function remove(projectId: ProjectId) {
    const binding = linked.find((b) => b.projectId === projectId)
    if (!binding) return
    const name = catalog.find((p) => p.id === projectId)?.name ?? binding.alias
    const last = linkedIds.length === 1
    const ok = window.confirm(
      last
        ? `Remove ${name} from the page code? The website still needs this pipeline attached — only the widget is deleted.`
        : `Remove ${name} from this website? This also deletes its widget from the page code.`,
    )
    if (!ok) return
    const stripped = stripWebsitePipelineFromCode(options, binding.alias)
    if (last) {
      onChange(stripped)
      return
    }
    const nextIds = linkedIds.filter((id) => id !== projectId)
    if (!nextIds.includes(primaryProjectId)) nextIds.unshift(primaryProjectId)
    onChange({ ...stripped, pipelineBindings: bindingsFromProjectIds(nextIds, catalog, options.pipelineBindings) })
  }

  function patchBinding(
    projectId: ProjectId,
    patch: {
      visibility?: hosted_run_input_visibility
      inputEditable?: boolean
      clearInputAfterRun?: boolean
      runLabel?: string
      outputView?: hosted_run_output_view
    },
  ) {
    onChange({
      ...options,
      pipelineBindings: linked.map((b) =>
        b.projectId === projectId ? { ...b, ...normalizeHostedRunInputChrome({ ...b, ...patch }) } : b,
      ),
    })
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-xs font-medium">Pipelines on this website</p>
      <p className="text-[10px] text-muted-foreground">
        Add a pipeline to drop a run widget into the page. Delete removes the widget from the code.
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {linked.map((binding) => {
          const name = catalog.find((p) => p.id === binding.projectId)?.name ?? binding.alias
          const primary = binding.projectId === primaryProjectId
          return (
            <span
              key={binding.projectId}
              className="inline-flex max-w-full flex-col gap-1 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px]"
            >
              <span className="inline-flex h-6 max-w-full items-center gap-1">
              <GitBranch className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="truncate">{name}</span>
              <span className="text-[10px] text-muted-foreground">{binding.alias}</span>
              <DeleteButton
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                label={`Remove ${name} from this website`}
                title={primary ? "Removes the widget from the page code" : "Unattach and remove from the page code"}
                onClick={() => remove(binding.projectId)}
                {...spineActionProps("website.remove-pipeline")}
              >
                <X className="h-3 w-3" />
              </DeleteButton>
              </span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                <label className="inline-flex items-center gap-1">
                  Input
                  <select
                    className="h-6 rounded border border-border bg-background px-1 text-[10px] text-foreground"
                    value={binding.visibility}
                    onChange={(e) =>
                      patchBinding(binding.projectId, {
                        visibility: e.target.value as hosted_run_input_visibility,
                      })
                    }
                  >
                    <option value="auto">auto</option>
                    <option value="show">show</option>
                    <option value="hide">hide</option>
                  </select>
                </label>
                <label className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={binding.inputEditable}
                    disabled={binding.visibility === "hide"}
                    onChange={(e) =>
                      patchBinding(
                        binding.projectId,
                        e.target.checked
                          ? { visibility: "show", inputEditable: true }
                          : { inputEditable: false },
                      )
                    }
                  />
                  Editable
                </label>
                <label className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={binding.clearInputAfterRun}
                    disabled={binding.visibility === "hide"}
                    onChange={(e) =>
                      patchBinding(
                        binding.projectId,
                        e.target.checked
                          ? { visibility: "show", clearInputAfterRun: true }
                          : { clearInputAfterRun: false },
                      )
                    }
                  />
                  Clear after run
                </label>
                <label className="inline-flex items-center gap-1">
                  Button
                  <input
                    className="h-6 w-32 rounded border border-border bg-background px-1 text-[10px] text-foreground"
                    value={binding.runLabel}
                    placeholder="Run pipeline"
                    maxLength={40}
                    onChange={(e) => patchBinding(binding.projectId, { runLabel: e.target.value })}
                  />
                </label>
                <label className="inline-flex items-center gap-1">
                  Output
                  <select
                    className="h-6 rounded border border-border bg-background px-1 text-[10px] text-foreground"
                    value={binding.outputView}
                    onChange={(e) =>
                      patchBinding(binding.projectId, {
                        outputView: e.target.value as hosted_run_output_view,
                      })
                    }
                  >
                    <option value="auto">auto</option>
                    <option value="table">table</option>
                    <option value="metric">metric</option>
                    <option value="json">json</option>
                  </select>
                </label>
              </span>
            </span>
          )
        })}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger
            type="button"
            className="inline-flex h-8 items-center gap-1 rounded-md border border-dashed border-border px-2 font-mono text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
            {...spineActionProps("website.add-pipeline")}
          >
            <Plus className="h-3 w-3" />
            Add
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="z-[80] w-64">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-mono text-[10px] uppercase">
                Add a pipeline
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {available.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  className="font-mono text-xs"
                  onClick={() => add(p.id)}
                >
                  {p.name}
                </DropdownMenuItem>
              ))}
              {available.length === 0 ? (
                <DropdownMenuItem disabled className="font-mono text-[11px] text-muted-foreground">
                  {catalog.length === 0
                    ? "No pipelines yet"
                    : "All pipelines are already on this page"}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
