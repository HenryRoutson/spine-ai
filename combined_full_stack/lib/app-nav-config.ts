import {
  Boxes,
  Play,
  ScrollText,
  Database,
  Files,
  CreditCard,
  BookOpen,
  SquareCheck,
  SquareArrowUp,
  Users,
  Wallet,
} from "lucide-react"
import { SpineNavIcon } from "@/components/spine-mark"
import type { AppWindowId } from "@/lib/app-shell"

// AI : marketing site lives on a separate deploy from the app
export const LANDING_PAGE_URL = "https://www.spine-ai.dev/"

type NavIcon = React.ComponentType<{ className?: string }>

export type AppNavItem = {
  id: AppWindowId
  label: string
  hint: string
  icon: NavIcon
}

export const BUILDER_NAV_ITEMS: AppNavItem[] = [
  { id: "structure", label: "Structures", hint: "01", icon: Boxes },
  { id: "pipeline", label: "Pipeline", hint: "02", icon: SpineNavIcon },
  // AI : Testing sits before Inference — tests run before demoing (spec § Testing).
  { id: "testing", label: "Testing", hint: "03", icon: SquareCheck },
  { id: "inference", label: "Inference", hint: "04", icon: Play },
  { id: "share", label: "Share", hint: "05", icon: SquareArrowUp },
  { id: "earnings", label: "Earnings", hint: "06", icon: Wallet },
  { id: "logging", label: "Logging", hint: "07", icon: ScrollText },
  { id: "cache", label: "Cache", hint: "08", icon: Database },
  { id: "documents", label: "Documents", hint: "09", icon: Files },
  { id: "docs", label: "Docs", hint: "10", icon: BookOpen },
  { id: "billing", label: "Billing", hint: "11", icon: CreditCard },
]

export const CONSUMER_NAV_ITEMS: AppNavItem[] = [
  { id: "share", label: "Shared with me", hint: "01", icon: Users },
  { id: "billing", label: "Billing", hint: "02", icon: CreditCard },
]
