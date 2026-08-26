export const HOSTED_SITE_RUN_SLOT = "{{run}}"
export const HOSTED_SITE_AUTH_SLOT = "{{auth}}"
export const HOSTED_SITE_OUTPUT_SLOT = "{{output}}"
export const HOSTED_SITE_CHATBOT_SLOT = "{{chatbot}}"
export const HOSTED_SITE_DOCS_SLOT = "{{docs}}"

export type hosted_site_widget_slot = "run" | "auth" | "output" | "chatbot" | "docs"

export const HOSTED_SITE_SLOT_CLASS: Record<hosted_site_widget_slot, string> = {
  run: "hs-run-slot",
  auth: "hs-auth-slot",
  output: "hs-output-slot",
  chatbot: "hs-chatbot-slot",
  docs: "hs-docs-slot",
}

export const HOSTED_SITE_SLOT_TOKEN: Record<hosted_site_widget_slot, string> = {
  run: HOSTED_SITE_RUN_SLOT,
  auth: HOSTED_SITE_AUTH_SLOT,
  output: HOSTED_SITE_OUTPUT_SLOT,
  chatbot: HOSTED_SITE_CHATBOT_SLOT,
  docs: HOSTED_SITE_DOCS_SLOT,
}

export const HOSTED_SITE_IGNORED_SLOT_SELECTOR = Object.values(HOSTED_SITE_SLOT_CLASS)
  .map((cls) => `.${cls}`)
  .join(", ")

const SLOT_SPLIT_RE = /(\{\{(?:run|auth|output|chatbot|docs)\}\})/g

const TOKEN_TO_SLOT: Record<string, hosted_site_widget_slot> = {
  [HOSTED_SITE_RUN_SLOT]: "run",
  [HOSTED_SITE_AUTH_SLOT]: "auth",
  [HOSTED_SITE_OUTPUT_SLOT]: "output",
  [HOSTED_SITE_CHATBOT_SLOT]: "chatbot",
  [HOSTED_SITE_DOCS_SLOT]: "docs",
}

export type HostedSiteHtmlSegment =
  | { kind: "html"; html: string }
  | { kind: "slot"; slot: hosted_site_widget_slot }

export function splitHostedSiteSlots(html: string): HostedSiteHtmlSegment[] {
  const parts = html.split(SLOT_SPLIT_RE)
  const segments: HostedSiteHtmlSegment[] = []
  for (const part of parts) {
    if (!part) continue
    const slot = TOKEN_TO_SLOT[part]
    segments.push(slot ? { kind: "slot", slot } : { kind: "html", html: part })
  }
  return segments.length > 0 ? segments : [{ kind: "html", html }]
}

export function hostedSitePrimarySlot(surface: "app" | "signin"): hosted_site_widget_slot {
  return surface === "signin" ? "auth" : "run"
}
