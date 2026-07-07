// AI : client-safe API path registry — keep in sync with utils/supabase/middleware PUBLIC_API_PATHS.

export const API_ROUTES = {
  state: "/api/state",
  billing: "/api/billing",
  earnings: "/api/earnings",
  earningsWithdraw: "/api/earnings/withdraw",
  billingConfirm: "/api/billing/confirm",
  billingCheckout: "/api/billing/checkout",
  billingEarningsWithdraw: "/api/earnings/withdraw",
  billingKeys: "/api/billing/keys",
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
  testingEvaluate: "/api/testing-evaluate",
  docsContent: "/api/docs/content",
  feedback: "/api/feedback",
  supabaseEnv: "/api/supabase-env",
  sharedLinks: "/api/shared-links",
  sharedLink: (id: string) => `/api/shared-links/${id}`,
  sharedLinkRun: (id: string) => `/api/shared-links/${id}/run`,
  sharedLinkProgress: (id: string) => `/api/shared-links/${id}/progress`,
  sharedLinkDocs: (id: string) => `/api/shared-links/${id}/docs`,
  sharedLinkDocText: (linkId: string, docId: string, layer: "parser" | "vision" = "parser") =>
    `/api/shared-links/${linkId}/docs/${docId}/text${layer === "vision" ? "?layer=vision" : ""}`,
  sharedLinkDocFile: (linkId: string, docId: string) => `/api/shared-links/${linkId}/docs/${docId}/file`,
  sharedLinkDownload: (id: string) => `/api/shared-links/${id}/download`,
  sharedLinkClientStep: (id: string) => `/api/shared-links/${id}/client-step`,
  hostedApis: "/api/hosted-apis",
  hostedApi: (id: string) => `/api/hosted-apis/${id}`,
  hostedApiInvoke: (id: string) => `/api/hosted-apis/${id}/invoke`,
  hostedApiProgress: (id: string) => `/api/hosted-apis/${id}/progress`,
  landingDemoBuild: "/api/landing-demo/build-pipeline",
  landingDemoSignup: "/api/landing-demo/signup",
  demoState: "/api/demo/state",
  demoDocText: (id: string, layer: "parser" | "vision" = "parser") =>
    `/api/demo/docs/${id}/text${layer === "vision" ? "?layer=vision" : ""}`,
} as const

function isHostedApiPublicApi(pathname: string): boolean {
  return (
    /^\/api\/hosted-apis\/[^/]+\/invoke$/.test(pathname) ||
    /^\/api\/hosted-apis\/[^/]+\/progress$/.test(pathname)
  );
}

function isSharedLinkPublicApi(pathname: string, method: string): boolean {
  // AI : only GET on link metadata is public — DELETE/PUT must go through auth middleware.
  if (/^\/api\/shared-links\/[^/]+$/.test(pathname)) return method === "GET";
  return (
    /^\/api\/shared-links\/[^/]+\/(run|progress|docs|download|client-step)$/.test(pathname) ||
    /^\/api\/shared-links\/[^/]+\/docs\/[^/]+\/(text|file)$/.test(pathname)
  );
}

function isLandingDemoPublicApi(pathname: string): boolean {
  return pathname === API_ROUTES.landingDemoBuild || pathname === API_ROUTES.landingDemoSignup;
}

function isDemoPublicApi(pathname: string): boolean {
  return pathname === API_ROUTES.demoState || /^\/api\/demo\/docs\/[^/]+\/text$/.test(pathname);
}

export function isPublicApiPath(pathname: string, method = "GET"): boolean {
  if (PUBLIC_API_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true
  if (isLandingDemoPublicApi(pathname)) return true
  if (isDemoPublicApi(pathname)) return true
  if (isHostedApiPublicApi(pathname)) return true
  return isSharedLinkPublicApi(pathname, method)
}

export const PUBLIC_API_PATHS = [API_ROUTES.supabaseEnv, API_ROUTES.billingWebhook] as const
