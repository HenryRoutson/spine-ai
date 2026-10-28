export type policy_version_string = string
export type contact_email_string = string

// AI : TODO (jank-legal-identity) — controllerName still says Antler hackathon; legal copy change.
export const LEGAL = {
  productName: "Spine",
  controllerName: "Spine (Antler hackathon project)",
  contactEmail: "spine-ai.dev@proton.me" as contact_email_string,
  policyVersion: "2026-07-08" as policy_version_string,
  lastUpdated: "8 July 2026",
  minAgeYears: 16,
} as const

export const LEGAL_ROUTES = {
  privacy: "/privacy",
  terms: "/terms",
  cookies: "/cookies",
  accessibility: "/accessibility",
} as const

export type LegalRouteKey = keyof typeof LEGAL_ROUTES
