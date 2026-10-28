"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { buildDownloadBaseName } from "@/lib/data-download-name"
import { HTML_EXPORT_SKIP_PROPS } from "@/lib/html-export-mark"
import { canExportRunHtml, downloadInferenceHtml } from "@/lib/inference-html-export"
import { useOptionalStore } from "@/lib/store"
import { useSupabaseSession } from "@/lib/use-supabase-session"
import { cn } from "@/lib/utils"
import type { PipelineRun, StructureModel } from "@/lib/types"

export function InferenceHtmlDownloadButton({
  run,
  models: modelsProp,
  shareTitle,
  variant = "plain",
  className,
}: {
  run: PipelineRun
  models?: StructureModel[]
  shareTitle?: string
  variant?: "plain" | "button"
  className?: string
}) {
  const store = useOptionalStore()
  const models = modelsProp ?? store?.models
  const { email: userEmail } = useSupabaseSession()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  // AI : store may be missing on shared-run pages — shareTitle is the fallback.
  const title = shareTitle ?? store?.project.name ?? "Inference"
  const canExport = canExportRunHtml(run)

  async function handleDownload(from: HTMLElement) {
    if (!canExport) return
    setBusy(true)
    setFailed(false)
    try {
      const content = JSON.stringify(run.steps.map((step) => step.outputJson ?? step.outputPreview ?? ""))
      const baseName = await buildDownloadBaseName({
        content,
        projectName: title,
        userEmail,
        models,
        typeAliases: store?.typeAliases,
      })
      await downloadInferenceHtml(run, `${baseName}.html`, { title, from })
    } catch (e) {
      console.error(e)
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const label = busy ? "preparing…" : failed ? "failed" : "download_html"
  const icon = busy ? (
    <Loader2 className="h-3 w-3 animate-spin" />
  ) : (
    <Download className="h-3 w-3" />
  )

  return (
    <button
      type="button"
      {...HTML_EXPORT_SKIP_PROPS}
      disabled={!canExport || busy}
      onClick={(e) => void handleDownload(e.currentTarget)}
      title={
        canExport
          ? "Download this run as a shareable HTML file"
          : "No run steps to share"
      }
      className={cn(
        variant === "button"
          ? cn(buttonVariants({ variant: "outline", size: "sm" }), "h-6 gap-1 font-mono text-[10px]")
          : "inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-50",
        failed && "text-destructive hover:text-destructive/80",
        className,
      )}
    >
      {icon}
      {label}
    </button>
  )
}
