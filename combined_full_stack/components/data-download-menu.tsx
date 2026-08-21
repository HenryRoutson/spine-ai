"use client"

import { Download, FileJson, FileSpreadsheet, Table2 } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { buildDownloadBaseName } from "@/lib/data-download-name"
import { downloadDataAs, isDownloadableJson, type DataDownloadFormat } from "@/lib/data-download"
import { useOptionalStore } from "@/lib/store"
import { useSupabaseSession } from "@/lib/use-supabase-session"
import { HTML_EXPORT_SKIP_PROPS } from "@/lib/html-export-mark"
import { cn } from "@/lib/utils"
import type { StructureModel } from "@/lib/types"

const FORMATS: { id: DataDownloadFormat; label: string; icon: typeof FileJson }[] = [
  { id: "json", label: "JSON", icon: FileJson },
  { id: "csv", label: "CSV", icon: Table2 },
  { id: "xlsx", label: "Excel (.xlsx)", icon: FileSpreadsheet },
]

export function DataDownloadMenu({
  content,
  models: modelsProp,
  baseNameOverride,
  formats,
  className,
}: {
  content: string
  models?: StructureModel[]
  baseNameOverride?: string
  formats?: DataDownloadFormat[]
  className?: string
}) {
  const store = useOptionalStore()
  const models = modelsProp ?? store?.models
  const { email: userEmail } = useSupabaseSession()
  const canDownload = isDownloadableJson(content)
  const options = formats?.length ? FORMATS.filter((f) => formats.includes(f.id)) : FORMATS
  const only = options.length === 1 ? options[0] : undefined

  async function handleDownload(format: DataDownloadFormat) {
    try {
      const baseName =
        baseNameOverride ??
        (await buildDownloadBaseName({
          content,
          projectName: store?.project.name,
          userEmail,
          models,
          typeAliases: store?.typeAliases,
        }))
      downloadDataAs(content, format, baseName)
    } catch (e) {
      console.error(e)
    }
  }

  if (only) {
    const Icon = only.icon
    return (
      <span {...HTML_EXPORT_SKIP_PROPS} className="inline-flex">
        <button
          type="button"
          disabled={!canDownload}
          onClick={() => void handleDownload(only.id)}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "h-7 shrink-0 gap-1.5 text-[10px]",
            className,
          )}
          title={canDownload ? only.label : "Nothing to download"}
        >
          <Icon className="h-3.5 w-3.5" />
          {only.label}
        </button>
      </span>
    )
  }

  return (
    // AI : skipped in HTML export — json-viewer snapshot srcdoc owns JSON/CSV/xlsx download
    <span {...HTML_EXPORT_SKIP_PROPS} className="inline-flex">
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={!canDownload}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "h-7 shrink-0 gap-1.5 font-mono text-[10px]",
          className,
        )}
        title={canDownload ? "Download data" : "Invalid JSON — cannot download"}
      >
        <Download className="h-3.5 w-3.5" />
        Download
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-mono text-[10px] text-muted-foreground">
            Export as
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuGroup>
          {options.map(({ id, label, icon: Icon }) => (
            <DropdownMenuItem key={id} onClick={() => void handleDownload(id)} className="gap-2 font-mono text-xs">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
    </span>
  )
}
