// AI : client-safe API path registry — keep in sync with utils/supabase/middleware PUBLIC_API_PATHS.

export const API_ROUTES = {
  state: "/api/state",
  billing: "/api/billing",
  billingConfirm: "/api/billing/confirm",
  billingCheckout: "/api/billing/checkout",
  billingWebhook: "/api/billing/webhook",
  projects: "/api/projects",
  project: (id: string) => `/api/projects/${id}`,
  projectTypes: (id: string) => `/api/projects/${id}/types`,
  projectsResyncExamples: "/api/projects/resync-examples",
  projectTemplates: "/api/project-templates",
  docs: "/api/docs",
  doc: (id: string) => `/api/docs/${id}`,
  docText: (id: string, layer: "parser" | "vision" = "parser") =>
    `/api/docs/${id}/text${layer === "vision" ? "?layer=vision" : ""}`,
  docFile: (id: string) => `/api/docs/${id}/file`,
  runs: "/api/runs",
  run: (id: string) => `/api/runs/${id}`,
  runProgress: (id: string) => `/api/runs/${id}/progress`,
  runClientStep: (id: string) => `/api/runs/${id}/client-step`,
  cache: "/api/cache",
  cacheEntry: (key: string) => `/api/cache/${encodeURIComponent(key)}`,
  abtest: "/api/abtest",
  pipelineAssistant: "/api/pipeline-assistant",
  projectAssistant: "/api/project-assistant",
  assistantChats: "/api/assistant-chats",
  assistantChat: (id: string) => `/api/assistant-chats/${id}`,
  pipelineSummary: "/api/pipeline-summary",
  structureAssistant: "/api/structure-assistant",
  testingAssistant: "/api/testing-assistant",
  docsContent: "/api/docs/content",
  feedback: "/api/feedback",
  supabaseEnv: "/api/supabase-env",
  sharedLinks: "/api/shared-links",
  sharedLink: (id: string) => `/api/shared-links/${id}`,
  sharedLinkRun: (id: string) => `/api/shared-links/${id}/run`,
  sharedLinkProgress: (id: string) => `/api/shared-links/${id}/progress`,
  sharedLinkDocs: (id: string) => `/api/shared-links/${id}/docs`,
  sharedLinkDownload: (id: string) => `/api/shared-links/${id}/download`,
  sharedLinkClientStep: (id: string) => `/api/shared-links/${id}/client-step`,
} as const

function isSharedLinkPublicApi(pathname: string): boolean {
  return (
    /^\/api\/shared-links\/[^/]+$/.test(pathname) ||
    /^\/api\/shared-links\/[^/]+\/(run|progress|docs|download|client-step)$/.test(pathname)
  )
}

export function isPublicApiPath(pathname: string): boolean {
  if (PUBLIC_API_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true
  return isSharedLinkPublicApi(pathname)
}

export const PUBLIC_API_PATHS = [API_ROUTES.supabaseEnv, API_ROUTES.billingWebhook] as const
