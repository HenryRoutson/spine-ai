"use client"

import { useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { composeViewerMarkdown } from "@/lib/share-viewer-markdown"

const PLACEHOLDER = `# How to use

1. Upload your file in the slot below
2. Click Run
3. Download the result when it finishes
`

export function useShareViewerMarkdown(projectDocumentation: string) {
  const [showDocs, setShowDocs] = useState(false)
  const [instructions, setInstructions] = useState("")
  const [appendProjectDocs, setAppendProjectDocs] = useState(false)
  return {
    viewerMarkdown: composeViewerMarkdown({
      showDocs,
      instructions,
      appendProjectDocs,
      projectDocumentation,
    }),
    fieldsProps: {
      showDocs,
      onShowDocsChange: setShowDocs,
      instructions,
      onInstructionsChange: setInstructions,
      appendProjectDocs,
      onAppendProjectDocsChange: setAppendProjectDocs,
      projectDocumentation,
    },
  }
}

export function ShareViewerDocsFields({
  showDocs,
  onShowDocsChange,
  instructions,
  onInstructionsChange,
  appendProjectDocs,
  onAppendProjectDocsChange,
  projectDocumentation,
  simple = false,
}: {
  showDocs: boolean
  onShowDocsChange: (next: boolean) => void
  instructions: string
  onInstructionsChange: (next: string) => void
  appendProjectDocs: boolean
  onAppendProjectDocsChange: (next: boolean) => void
  projectDocumentation: string
  simple?: boolean
}) {
  const hasProjectDocs = projectDocumentation.trim().length > 0

  return (
    <div className="space-y-2">
      <label className="flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={showDocs}
          onChange={(e) => onShowDocsChange(e.target.checked)}
        />
        <span>
          {simple ? "Add instructions on the page" : "Show usage instructions on the public page"}
          <span className="mt-0.5 block text-[10px] text-muted-foreground">
            Off by default — project Docs stay private unless you append them.
          </span>
        </span>
      </label>

      {showDocs ? (
        <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
          <Textarea
            value={instructions}
            onChange={(e) => onInstructionsChange(e.target.value)}
            placeholder={PLACEHOLDER}
            rows={6}
            className="min-h-24 font-mono text-xs"
          />
          {hasProjectDocs ? (
            <label className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={appendProjectDocs}
                onChange={(e) => onAppendProjectDocsChange(e.target.checked)}
              />
              <span>
                Also include project documentation
                <span className="mt-0.5 block text-[10px] text-muted-foreground">
                  Copies Docs as they are now. Later Docs edits stay private.
                </span>
              </span>
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
