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
  StructureModel,
  TypeAlias,
} from "@/lib/types"
import type { ProjectProposal } from "@/lib/project-assistant-types"

export type locality_t = "local" | "remote" | "local-first"

export type ProjectCreateOpts = { open?: boolean }

export type SessionChatTurn = { role: "user" | "assistant"; content: string }

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
  // AI : TODO (cli-parity vs React store) — snapshot still omits: strategies, modelOptions,
  // AI :   billingRuns / billingAccount / earningsAccount, chats[] (Vibe threads), team membership,
  // AI :   saveError, inference presets, cache entries, share/hosted-api ids.
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
  request: (url: string, init?: RequestInit) => Promise<Response>
}
