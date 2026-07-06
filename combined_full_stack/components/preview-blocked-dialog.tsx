"use client"

import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"

// AI : live preview iframe — uploads and other writes need a signed-in workspace.
export function PreviewBlockedDialog({ onClose }: { onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center shadow-2xl">
        <p className="text-sm font-medium">Preview mode</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Document uploads are disabled in the live preview without sign in.
        </p>
        <Button size="sm" className="mt-4" onClick={onClose}>
          OK
        </Button>
      </div>
    </div>,
    document.body,
  )
}
