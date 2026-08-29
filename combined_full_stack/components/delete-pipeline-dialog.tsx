"use client"

import { createPortal } from "react-dom"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { PipelineWebsiteDeleteChoices } from "@/components/pipeline-website-delete-choices"
import type { pipeline_website_delete_action, website_dependent } from "@/lib/website-pipelines"

export function DeletePipelineDialog({
  pipelineName,
  sites,
  onCancel,
  onConfirm,
}: {
  pipelineName: string
  sites: website_dependent[]
  onCancel: () => void
  onConfirm: (action: pipeline_website_delete_action) => void
}) {
  const [action, setAction] = useState<pipeline_website_delete_action>("unbind")
  if (typeof document === "undefined") return null
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button aria-label="Cancel" className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        <p className="text-sm font-medium">This pipeline is used by websites</p>
        <div className="mt-4">
          <PipelineWebsiteDeleteChoices
            pipelineName={pipelineName}
            sites={sites}
            action={action}
            onChange={setAction}
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel} spineId="chrome.dialog-close">
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onConfirm(action)}
            spineId={action === "delete" ? "project.delete-with-websites" : "project.delete-keep-websites"}
          >
            {action === "delete" ? "Delete pipeline and websites" : "Delete pipeline only"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
