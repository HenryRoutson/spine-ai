"use client"

import type { pipeline_website_delete_action, website_dependent } from "@/lib/website-pipelines"
import { spineActionProps } from "@/lib/core/parity"

export function PipelineWebsiteDeleteChoices({
  pipelineName,
  sites,
  action,
  onChange,
}: {
  pipelineName: string
  sites: website_dependent[]
  action: pipeline_website_delete_action
  onChange: (next: pipeline_website_delete_action) => void
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground">
        Deleting <span className="font-medium">{pipelineName}</span> affects{" "}
        {sites.length === 1 ? "this website" : "these websites"}:
      </p>
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {sites.map((site) => (
          <li key={site.id} className="truncate px-3 py-2 text-sm">
            {site.name}
          </li>
        ))}
      </ul>
      <fieldset className="space-y-2">
        <legend className="text-xs text-muted-foreground">What should happen to them?</legend>
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border px-3 py-2 text-sm">
          <input
            type="radio"
            name="pipeline-website-action"
            className="mt-1"
            checked={action === "unbind"}
            onChange={() => onChange("unbind")}
            {...spineActionProps("project.delete-keep-websites")}
          />
          <span>
            <span className="block font-medium">Keep the websites</span>
            <span className="block text-xs text-muted-foreground">
              Remove this pipeline from the pages. The sites stay, without this run.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border px-3 py-2 text-sm">
          <input
            type="radio"
            name="pipeline-website-action"
            className="mt-1"
            checked={action === "delete"}
            onChange={() => onChange("delete")}
            {...spineActionProps("project.delete-with-websites")}
          />
          <span>
            <span className="block font-medium">Delete the websites too</span>
            <span className="block text-xs text-muted-foreground">
              Permanently revoke every listed site along with the pipeline.
            </span>
          </span>
        </label>
      </fieldset>
    </div>
  )
}
