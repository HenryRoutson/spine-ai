// AI : headless session shapes — React, CLI, and MCP subscribe to the same snapshot.

import type {
  DocId,
  DocLabel,
  DocRef,
  InputType,
  ModuleId,
  PipelineModule,
  PipelineRun,
  Project,
  ProjectId,
  RunTestReport,
  Strategy,
  StructureModel,
  TypeAlias,
} from "@/lib/types"
import type { ProjectProposal } from "@/lib/project-assistant-types"

export type locality_t = "local" | "remote" | "local-first"

export type ProjectCreateOpts = { open?: boolean }

export type SessionChatTurn = { role: "user" | "assistant"; content: string }

export type BillingAccountView = {
  balanceCents: number
  totalBilledCents: number
  totalUsageCents: number
}

export type EarningsAccountView = {
  balanceCents: number
  totalEarnedCents: number
  totalWithdrawnCents: number
}

export type ModelOptionView = { id: string; label: string }

export type CacheEntryView = { key: string; stepLabel?: string }

export type SessionSnapshot = {
  projects: Project[]
  docs: DocRef[]
  docContents: Record<DocId, string>
  runs: PipelineRun[]
  activeProjectId: string
  model: string
  inferenceInputDocIds: Partial<Record<ModuleId, DocId | DocId[]>>
  pendingCreates: Project[]
  deletedProjectIds: string[]
  chat: SessionChatTurn[]
  pendingProposal: ProjectProposal | null
  modelOptions: ModelOptionView[]
  billingRuns: PipelineRun[]
  billingAccount: BillingAccountView | null
  earningsAccount: EarningsAccountView | null
  cacheEntries: CacheEntryView[]
  saveError: string | null
  shareLinkIds: string[]
  hostedApiIds: string[]
  docProjectIds: Partial<Record<DocId, ProjectId[]>>
}

export type ProjectPatch = {
  models?: StructureModel[]
  modules?: PipelineModule[]
  typeAliases?: TypeAlias[]
  documentation?: string
  name?: string
}

export type AddDocContentInput = {
  name: string
  type: InputType
  content: string
  label: DocLabel
  projectId?: string
}

export type LinkQuotesInput = {
  quote: string
  sourceText: string
  docId: DocId
}

export type PersistPort = {
  load: () => SessionSnapshot | null
  save: (snap: SessionSnapshot) => void
}

export type EgressPort = {
  bytesSent: number
  blocked?: boolean
  request: (url: string, init?: RequestInit) => Promise<Response>
}
