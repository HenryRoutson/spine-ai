// AI : client-safe API path registry — keep in sync with utils/supabase/middleware PUBLIC_API_PATHS.

export const API_ROUTES = {
  state: "/api/state",
  billing: "/api/billing",
  earnings: "/api/earnings",
  earningsWithdraw: "/api/earnings/withdraw",
  billingConfirm: "/api/billing/confirm",
  billingCheckout: "/api/billing/checkout",
  billingKeys: "/api/billing/keys",
  secrets: "/api/secrets",
  connectSession: "/api/connect/session",
  billingWebhook: "/api/billing/webhook",
  projects: "/api/projects",
  project: (id: string) => `/api/projects/${id}`,
  projectsResyncExamples: "/api/projects/resync-examples",
  projectTemplates: "/api/project-templates",
  docs: "/api/docs",
  doc: (id: string) => `/api/docs/${id}`,
  docText: (id: string, layer: "parser" | "vision" = "parser") =>
    `/api/docs/${id}/text${layer === "vision" ? "?layer=vision" : ""}`,
  docFile: (id: string) => `/api/docs/${id}/file`,
  runs: "/api/runs",
  runsAccount: "/api/runs?scope=account",
  run: (id: string) => `/api/runs/${id}`,
  runProgress: (id: string) => `/api/runs/${id}/progress`,
  runClientStep: (id: string) => `/api/runs/${id}/client-step`,
  runChatbotTurn: (id: string) => `/api/runs/${id}/chatbot-turn`,
  cache: "/api/cache",
  cacheEntry: (key: string) => `/api/cache/${encodeURIComponent(key)}`,
  abtest: "/api/abtest",
  projectAssistant: "/api/project-assistant",
  assistantChatSdk: "/api/assistant-chat-sdk",
  pipelineAssistant: "/api/pipeline-assistant",
  structureAssistant: "/api/structure-assistant",
  assistantChats: "/api/assistant-chats",
  assistantChat: (id: string) => `/api/assistant-chats/${id}`,
  pipelineSummary: "/api/pipeline-summary",
  pipelineLint: "/api/pipeline-lint",
  pipelineExportDocuments: "/api/pipeline-export/documents",
  diagnosisAssistant: "/api/diagnosis-assistant",
  testingAssistant: "/api/testing-assistant",
  hostedSiteAssistant: "/api/hosted-site-assistant",
  hostedSiteCompile: "/api/hosted-site/compile",
  testingEvaluate: "/api/testing-evaluate",
  docsContent: "/api/docs/content",
  feedback: "/api/feedback",
  account: "/api/account",
  activity: "/api/activity",
  sessionReplay: "/api/session-replay",
  sessionReplayById: (id: string) => `/api/session-replay/${id}`,
  supabaseEnv: "/api/supabase-env",
  sharedLinks: "/api/shared-links",
  sharedLink: (id: string) => `/api/shared-links/${id}`,
  sharedLinkRun: (id: string) => `/api/shared-links/${id}/run`,
  sharedLinkProgress: (id: string) => `/api/shared-links/${id}/progress`,
  sharedLinkDocs: (id: string) => `/api/shared-links/${id}/docs`,
  sharedLinkDocText: (
    linkId: string,
    docId: string,
    opts?: { layer?: "parser" | "vision"; sessionId?: string },
  ) => {
    const params = new URLSearchParams()
    if (opts?.layer === "vision") params.set("layer", "vision")
    if (opts?.sessionId) params.set("sessionId", opts.sessionId)
    const q = params.toString()
    return `/api/shared-links/${linkId}/docs/${docId}/text${q ? `?${q}` : ""}`
  },
  sharedLinkDocFile: (linkId: string, docId: string, sessionId?: string) => {
    const q = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ""
    return `/api/shared-links/${linkId}/docs/${docId}/file${q}`
  },
  sharedLinkDownload: (id: string) => `/api/shared-links/${id}/download`,
  sharedLinkClientStep: (id: string) => `/api/shared-links/${id}/client-step`,
  sharedLinkSql: (id: string) => `/api/shared-links/${id}/sql`,
  marketplace: "/api/marketplace",
  marketplaceListing: (id: string) => `/api/marketplace/${id}`,
  marketplaceClone: (id: string) => `/api/marketplace/${id}/clone`,
  hostedApis: "/api/hosted-apis",
  hostedApi: (id: string) => `/api/hosted-apis/${id}`,
  hostedApiInvoke: (id: string) => `/api/hosted-apis/${id}/invoke`,
  hostedApiProgress: (id: string) => `/api/hosted-apis/${id}/progress`,
  schedules: "/api/schedules",
  schedule: (id: string) => `/api/schedules/${id}`,
  scheduleRun: (id: string) => `/api/schedules/${id}/run`,
  schedulesTick: "/api/schedules/tick",
  // AI : Embed reuses shared-links APIs + /embed/[id] UI (origin allowlist on emb_ rows).
  // AI : Hosted page reuses the same APIs + /site/[id] HTML wrapper (site_ rows, no origin allowlist).
  landingDemoBuild: "/api/landing-demo/build-pipeline",
  landingDemoSignup: "/api/landing-demo/signup",
  landingDemoSessionReplay: "/api/landing-demo/session-replay",
  demoState: "/api/demo/state",
  demoRuns: "/api/demo/runs",
  demoDocText: (id: string, layer: "parser" | "vision" = "parser") =>
    `/api/demo/docs/${id}/text${layer === "vision" ? "?layer=vision" : ""}`,
  teams: "/api/teams",
  teamInvite: (id: string) => `/api/teams/${id}/invite`,
  teamMember: (teamId: string, userId: string) => `/api/teams/${teamId}/members/${userId}`,
  teamInvitesAccept: "/api/teams/invites/accept",
  projectTeam: (id: string) => `/api/projects/${id}/team`,
} as const

function isHostedApiPublicApi(pathname: string): boolean {
  return (
    /^\/api\/hosted-apis\/[^/]+\/invoke$/.test(pathname) ||
    /^\/api\/hosted-apis\/[^/]+\/progress$/.test(pathname)
  );
}

function isScheduleTickPublicApi(pathname: string): boolean {
  return pathname === API_ROUTES.schedulesTick;
}

function isSharedLinkPublicApi(pathname: string, method: string): boolean {
  // AI : only GET on link metadata is public — DELETE/PUT must go through auth middleware.
  if (/^\/api\/shared-links\/[^/]+$/.test(pathname)) return method === "GET";
  return (
    /^\/api\/shared-links\/[^/]+\/(run|progress|docs|download|client-step|sql)$/.test(pathname) ||
    /^\/api\/shared-links\/[^/]+\/docs\/[^/]+\/(text|file)$/.test(pathname)
  );
}

function isLandingDemoPublicApi(pathname: string): boolean {
  // AI : session-replay is email-gated in the route; must bypass auth middleware like build/signup.
  return (
    pathname === API_ROUTES.landingDemoBuild ||
    pathname === API_ROUTES.landingDemoSignup ||
    pathname === API_ROUTES.landingDemoSessionReplay
  );
}

function isDemoPublicApi(pathname: string): boolean {
  return (
    pathname === API_ROUTES.demoState ||
    pathname === API_ROUTES.demoRuns ||
    /^\/api\/demo\/docs\/[^/]+\/text$/.test(pathname)
  )
}

export function isPublicApiPath(pathname: string, method = "GET"): boolean {
  if (PUBLIC_API_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true
  if (isLandingDemoPublicApi(pathname)) return true
  if (isDemoPublicApi(pathname)) return true
  if (isHostedApiPublicApi(pathname)) return true
  if (isScheduleTickPublicApi(pathname)) return true
  return isSharedLinkPublicApi(pathname, method)
}

export const PUBLIC_API_PATHS = [API_ROUTES.supabaseEnv, API_ROUTES.billingWebhook] as const
