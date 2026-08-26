"use client"

import { MessagesSquare } from "lucide-react"
import { DataViewPanel } from "@/components/data-view-panel"
import { MarkdownView } from "@/components/highlight"
import { SharedLinkPreview } from "@/components/share/shared-link-preview"
import { Chat, ChatBubble, ChatBubbleAvatar, ChatBubbleContent, ChatInput, ChatList, ChatMessage } from "@/components/ui/chat"
import type { hosted_site_widget_slot } from "@/lib/hosted-site-slots"
import type { PipelineModule } from "@/lib/types"
import type { ReactNode } from "react"

const OUTPUT_PREVIEW_JSON = '{"preview":"Run output appears here"}'

export function HostedSiteSlotWidgets({
  projectName,
  viewerMarkdown,
  modules,
  hideDocsInRun,
}: {
  projectName: string
  viewerMarkdown: string
  modules: PipelineModule[]
  hideDocsInRun: boolean
}): Partial<Record<hosted_site_widget_slot, ReactNode>> {
  return {
    run: (
      <SharedLinkPreview
        projectName={projectName}
        viewerMarkdown={hideDocsInRun ? "" : viewerMarkdown}
        modules={modules}
        variant="site"
      />
    ),
    output: <DataViewPanel json={OUTPUT_PREVIEW_JSON} defaultView="json" className="min-h-40" />,
    chatbot: <HostedSiteChatbotPreview />,
    docs: viewerMarkdown.trim() ? (
      <div className="bg-background px-4 py-3">
        <MarkdownView md={viewerMarkdown} />
      </div>
    ) : (
      <p className="px-4 py-3 text-xs text-muted-foreground">Viewer docs appear here</p>
    ),
  }
}

function HostedSiteChatbotPreview() {
  return (
    <div className="rounded-lg border border-chart-2/50 bg-chart-2/5 p-4">
      <div className="flex items-start gap-3">
        <MessagesSquare className="mt-0.5 h-5 w-5 shrink-0 text-chart-2" />
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-sm font-medium">Chatbot session</p>
          <Chat className="max-h-80 min-h-48 rounded-md border border-border bg-background">
            <ChatList>
              <ChatMessage variant="assistant">
                <ChatBubbleAvatar variant="assistant" />
                <ChatBubble variant="assistant">
                  <ChatBubbleContent>Chatbot replies appear here after a run.</ChatBubbleContent>
                </ChatBubble>
              </ChatMessage>
            </ChatList>
            <ChatInput value="" onChange={() => undefined} onSend={() => undefined} disabled placeholder="Reply…" />
          </Chat>
        </div>
      </div>
    </div>
  )
}
