// AI : client-safe API path registry — keep in sync with utils/supabase/middleware PUBLIC_API_PATHS.

export const API_ROUTES = {
  state: "/api/state",
  billing: "/api/billing",
  billingConfirm: "/api/billing/confirm",
  billingCheckout: "/api/billing/checkout",
  billingWebhook: "/api/billing/webhook",
  projects: "/api/projects",
  project: (id: string) => `/api/projects/${id}`,
  projectsResyncExamples: "/api/projects/resync-examples",
  projectTemplates: "/api/project-templates",
  docs: "/api/docs",
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
  pipelineSummary: "/api/pipeline-summary",
  structureAssistant: "/api/structure-assistant",
  supabaseEnv: "/api/supabase-env",
} as const

export const PUBLIC_API_PATHS = [API_ROUTES.supabaseEnv, API_ROUTES.billingWebhook] as const
