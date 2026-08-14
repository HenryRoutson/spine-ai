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

type AgentAskFn = (session: SpineSession, message: string) => Promise<unknown>
let agentAskImpl: AgentAskFn | null = null

export function registerAskAgent(fn: AgentAskFn): void {
  agentAskImpl = fn
}

export const askAgentAction = defineAction({
  id: "askAgent",
  label: "Ask the project agent (LLM)",
  locality: "remote",
  input: z.object({ message: z.string() }),
  run: async (session, input) => {
    if (!agentAskImpl) throw new Error("askAgent is remote — use spine agent ask")
    return agentAskImpl(session, input.message)
  },
})

export const addDocAction = defineAction({
  id: "addDoc",
  label: "Add a text document",
  locality: "local",
  input: z.object({
    name: z.string(),
    type: z.string(),
    content: z.string(),
    label: z.string(),
  }),
  run: (session, input) =>
    session.addDoc({
      name: input.name,
      type: input.type as never,
      content: input.content,
      label: input.label as never,
    }),
})

export const cloneFromTemplateAction = defineAction({
  id: "cloneFromTemplate",
  label: "Ingest a template/seed project",
  locality: "local",
  input: z.object({}),
  run: (session) => session.project,
})

export const startRunAction = defineAction({
  id: "startRun",
  label: "Start an inference run",
  locality: "remote",
  input: z.object({}),
  run: (session) => session.startRun(),
})

export const runTestAction = defineAction({
  id: "runTest",
  label: "Run a testing-tab suite",
  locality: "remote",
  input: z.object({ testDocName: z.string().optional() }),
  run: (session, input) => session.runTest(input.testDocName),
})

export const exportPipelineAction = defineAction({
  id: "exportPipeline",
  label: "Export pydantic for the active project",
  locality: "local",
  input: z.object({}),
  run: (session) => session.project,
})

export const shareLinkAction = defineAction({
  id: "shareLink",
  label: "List share link ids (HTTP to mint)",
  locality: "remote",
  input: z.object({}),
  run: (session) => session.getSnapshot().shareLinkIds,
})

export const hostedApiAction = defineAction({
  id: "hostedApi",
  label: "List hosted API ids (HTTP to mint)",
  locality: "remote",
  input: z.object({}),
  run: (session) => session.getSnapshot().hostedApiIds,
})

export const billingAction = defineAction({
  id: "billing",
  label: "Refresh billing account",
  locality: "remote",
  input: z.object({}),
  run: (session) => session.refreshBilling(),
})

export const cacheGetAction = defineAction({
  id: "cacheGet",
  label: "Read local cache entries",
  locality: "local",
  input: z.object({}),
  run: (session) => session.getSnapshot().cacheEntries,
})

export const humanReviewAction = defineAction({
  id: "humanReview",
  label: "Human-review pause (browser)",
  locality: "remote",
  input: z.object({}),
  run: () => {
    throw new Error("human-review elicitation is GUI-only (run pause in the browser)")
  },
})

export const customCodeAction = defineAction({
  id: "customCode",
  label: "Custom-code step (browser CodeHost)",
  locality: "remote",
  input: z.object({}),
  run: () => {
    throw new Error("custom code executes in the browser CodeHost — no Node host yet")
  },
})

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
  addDocAction,
  cloneFromTemplateAction,
  startRunAction,
  runTestAction,
  exportPipelineAction,
  shareLinkAction,
  hostedApiAction,
  billingAction,
  cacheGetAction,
  humanReviewAction,
  customCodeAction,
] as const

export const SESSION_ACTION_IDS = SESSION_ACTIONS.map((a) => a.id)

// AI : camelCase session ids stay useStore/SpineSession names; dotted ids are data-spine-id / MCP session_action.
export const SESSION_ACTION_PARITY_ID: Record<string, string> = {
  addProject: "project.add",
  renameProject: "project.rename",
  deleteProject: "project.delete",
  openProject: "project.open",
  setDocumentation: "docs.set",
  validate: "pipeline.validate",
  linkQuotes: "quotes.link",
  ingestProject: "project.clone-template",
  applyProposal: "assistant.approve",
  askAgent: "assistant.send",
  addDoc: "documents.upload",
  cloneFromTemplate: "project.clone",
  startRun: "inference.start-run",
  runTest: "testing.run",
  exportPipeline: "pipeline.export",
  shareLink: "share.create-link",
  hostedApi: "share.deploy-api",
  billing: "billing.refresh",
  cacheGet: "cache.refresh",
  humanReview: "inference.human-review.approve",
  customCode: "inference.custom-code",
}

export const TUI_COMMAND_PARITY_ID: Record<string, string> = {
  "new-project": "project.add",
  "configure-step": "pipeline.configure-step",
  rename: "project.rename",
  "add-model": "structure.add-model",
  "add-step": "pipeline.add-step",
  vibe: "assistant.send",
  apply: "assistant.approve",
  reject: "assistant.reject",
  delete: "project.delete",
  "run-inference": "inference.start-run",
  "run-test": "testing.run",
  "errors-only": "logging.errors-only",
  "set-docs": "docs.set",
  quit: "tui.quit",
}
