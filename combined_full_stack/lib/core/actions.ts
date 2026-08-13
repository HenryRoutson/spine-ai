// AI : actions as data — same ids feed CLI flags, MCP tools, and the React-named session methods.

import { z } from "zod"
import type { SpineSession } from "@/lib/core/session"
import type { locality_t } from "@/lib/core/types"

export type SpineActionDef<I, O> = {
  id: string
  label: string
  locality: locality_t
  input: z.ZodType<I>
  run: (session: SpineSession, input: I) => O
}

export function defineAction<I, O>(def: SpineActionDef<I, O>): SpineActionDef<I, O> {
  return def
}

export const addProjectAction = defineAction({
  id: "addProject",
  label: "Create blank project",
  locality: "local",
  input: z.object({ open: z.boolean().optional() }),
  run: (session, input) => session.addProject(input),
})

export const renameProjectAction = defineAction({
  id: "renameProject",
  label: "Rename project",
  locality: "local",
  input: z.object({ id: z.string(), name: z.string() }),
  run: (session, input) => {
    session.renameProject(input.id, input.name)
  },
})

export const deleteProjectAction = defineAction({
  id: "deleteProject",
  label: "Delete project",
  locality: "local",
  input: z.object({ id: z.string() }),
  run: (session, input) => {
    session.deleteProject(input.id)
  },
})

export const openProjectAction = defineAction({
  id: "openProject",
  label: "Open project",
  locality: "local",
  input: z.object({ id: z.string() }),
  run: (session, input) => {
    session.openProject(input.id)
  },
})

export const setDocumentationAction = defineAction({
  id: "setDocumentation",
  label: "Set project docs markdown",
  locality: "local",
  input: z.object({ text: z.string() }),
  run: (session, input) => {
    session.setDocumentation(input.text)
  },
})

export const validateProjectAction = defineAction({
  id: "validate",
  label: "Validate active project",
  locality: "local",
  input: z.object({}),
  run: (session) => session.validation(),
})

export const linkQuotesAction = defineAction({
  id: "linkQuotes",
  label: "Link quote offsets locally",
  locality: "local",
  input: z.object({
    quote: z.string(),
    sourceText: z.string(),
    docId: z.string(),
  }),
  run: (session, input) => session.linkQuotes({ ...input, docId: input.docId as never }),
})

export const ingestProjectAction = defineAction({
  id: "ingestProject",
  label: "Ingest a project (seed/clone)",
  locality: "local",
  input: z.object({}),
  run: (session) => session.project,
})

export const applyProposalAction = defineAction({
  id: "applyProposal",
  label: "Apply pending agent proposal",
  locality: "local",
  input: z.object({}),
  run: (session) => session.applyPendingProposal(),
})

export const askAgentAction = defineAction({
  id: "askAgent",
  label: "Ask the project agent (LLM)",
  locality: "remote",
  input: z.object({ message: z.string() }),
  run: () => {
    throw new Error("askAgent is remote — use spine agent ask")
  },
})

// AI : TODO (cli-parity vs React / MCP Bar B) — register startRun, runTest, addDoc File, exportPipeline,
// AI :   shareLink, hostedApi, billing, cacheGet, humanReview, customCode. askAgent.run is a stub.
export const SESSION_ACTIONS = [
  addProjectAction,
  renameProjectAction,
  deleteProjectAction,
  openProjectAction,
  setDocumentationAction,
  validateProjectAction,
  linkQuotesAction,
  ingestProjectAction,
  applyProposalAction,
  askAgentAction,
] as const

export const SESSION_ACTION_IDS = SESSION_ACTIONS.map((a) => a.id)
