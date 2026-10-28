"use client"
// AI : Brand chip for Connect actions — lucide marks, not a second icon font.

import { Globe, Hash, Mail, Table2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { connectActionFamily, type ConnectAction, type ConnectActionFamily } from "@/lib/connect-catalog"

const FAMILY_SURFACE: Record<ConnectActionFamily, string> = {
  slack: "bg-[#4A154B] text-white",
  gmail: "bg-[#EA4335] text-white",
  sheets: "bg-[#0F9D58] text-white",
  http: "bg-foreground/80 text-background",
}

function FamilyGlyph({ family, className }: { family: ConnectActionFamily; className?: string }) {
  if (family === "slack") return <Hash className={className} />
  if (family === "gmail") return <Mail className={className} />
  if (family === "sheets") return <Table2 className={className} />
  return <Globe className={className} />
}

export function ConnectActionIcon({
  entry,
  provider,
  size = "md",
}: {
  entry?: ConnectAction
  provider?: string
  size?: "sm" | "md"
}) {
  const family = entry
    ? connectActionFamily(entry)
    : provider === "slack"
      ? "slack"
      : provider === "google-mail" || provider === "gmail"
        ? "gmail"
        : provider === "google-sheet"
          ? "sheets"
          : "http"
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md",
        size === "sm" ? "h-5 w-5" : "h-6 w-6",
        FAMILY_SURFACE[family],
      )}
    >
      <FamilyGlyph family={family} className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
    </span>
  )
}
