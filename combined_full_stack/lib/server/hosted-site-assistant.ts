// AI : isolated UI vibe agent — HTML/CSS/brand only. No pipeline, Docs, prompts, or code.

import { z } from "zod"
import { llmStructured } from "./llm"
import { UsageLedger } from "./usage"
import type { ChatTurn } from "./assistant-shared"
import { hostedSiteAppSummaryText } from "@/lib/hosted-site-app-summary"
import {
  DEFAULT_HOSTED_SITE_AUTH_HTML,
  DEFAULT_HOSTED_SITE_HTML,
  HOSTED_SITE_AUTH_SLOT,
  HOSTED_SITE_CHATBOT_SLOT,
  HOSTED_SITE_DOCS_SLOT,
  HOSTED_SITE_OUTPUT_SLOT,
  HOSTED_SITE_RUN_SLOT,
  normalizeHostedSiteOptions,
  parseHexColor,
  type hex_color_string,
} from "@/lib/hosted-site"
import type { HostedSiteAuthProvider, HostedSiteOptions } from "@/lib/shared-link-types"
import type { ModelId, Project } from "./types"

const hostedSiteAssistantResponseSchema = z.object({
  message: z.string(),
  customHtml: z.string().nullable(),
  customCss: z.string().nullable(),
  companyName: z.string().nullable(),
  tagline: z.string().nullable(),
  primaryColor: z.string().nullable(),
  accentColor: z.string().nullable(),
  backgroundColor: z.string().nullable(),
  textColor: z.string().nullable(),
  hideSpineFooter: z.boolean().nullable(),
  authEnabled: z.boolean().nullable(),
  authProvider: z.enum(["spine", "custom_supabase"]).nullable(),
  authHtml: z.string().nullable(),
})

export type HostedSiteAssistantResult = {
  message: string
  siteOptions: HostedSiteOptions
  usageCents: number
}

export function buildHostedSiteAssistantSystemPrompt(): string {
  return `You are a product-page designer for a hosted Spine app (Lovable-style HTML around a run form).

The default page is a signed-in workspace. Do not add a sign-in screen unless the publisher explicitly asks. Sign-in HTML can exist for later; leave authEnabled false unless they want a gate.

You ONLY change the public webpage: custom HTML, extra CSS, brand colors/copy, sign-in page HTML, whether sign-in is required, and whether to hide the Spine footer.
You MUST NOT change the pipeline, structures, prompts, code, project Docs, test files, or funding.
You MUST NOT invent a custom Supabase URL or anon key — that stays a publisher placeholder.

The run form is injected where you place ${HOSTED_SITE_RUN_SLOT}. Always keep exactly one ${HOSTED_SITE_RUN_SLOT} on the app page.
The sign-in form is injected where you place ${HOSTED_SITE_AUTH_SLOT}. If authEnabled is true, keep exactly one ${HOSTED_SITE_AUTH_SLOT} on the sign-in page.
Optional widgets (existing runtimes, not new backends): ${HOSTED_SITE_OUTPUT_SLOT} (result viewer), ${HOSTED_SITE_CHATBOT_SLOT} (chat), ${HOSTED_SITE_DOCS_SLOT} (viewer markdown). Do not invent {{pay}} or {{table}} slots.
Tokens: {{company}}, {{tagline}}, {{logo}}, {{email}} fill from brand fields. Default nav shows {{email}} as the signed-in account. Scripts, iframes, and event handlers are stripped.

Return a short message for the publisher, then fields:
- customHtml / customCss / authHtml: full replacement, or null to leave unchanged
- companyName / tagline / colors: new value, or null to leave unchanged
- hideSpineFooter / authEnabled: true/false, or null to leave unchanged
- authProvider: "spine" (default, handled) or "custom_supabase" (placeholder), or null to leave unchanged

Write complete HTML fragments (nav/hero/features around ${HOSTED_SITE_RUN_SLOT}; sign-in chrome around ${HOSTED_SITE_AUTH_SLOT} only if they asked). A full <!DOCTYPE html> document is ok — the host unwraps body + <style>.
Keep CSS in customCss or <style> in the HTML. Do not invent backend routes.`
}

export function buildHostedSiteAssistantUserPrompt(opts: {
  project: Project
  siteOptions: HostedSiteOptions
  message: string
  history: ChatTurn[]
}): string {
  const current = normalizeHostedSiteOptions(opts.siteOptions)
  const historyBlock =
    opts.history.length > 0
      ? `\nRecent conversation:\n${opts.history.map((t) => `${t.role}: ${t.content}`).join("\n")}\n`
      : ""
  return `App summary (uploads + step names only — not the pipeline internals):
${hostedSiteAppSummaryText(opts.project)}

Current brand:
${JSON.stringify(current.brand, null, 2)}
hideSpineFooter: ${current.hideSpineFooter}
auth: ${JSON.stringify(current.auth)}

Current HTML (default template if empty):
${current.customHtml.trim() || DEFAULT_HOSTED_SITE_HTML}

Current sign-in HTML (default template if empty):
${current.authHtml.trim() || DEFAULT_HOSTED_SITE_AUTH_HTML}

Current extra CSS:
${current.customCss.trim() || "(none)"}
${historyBlock}
Publisher request:
${opts.message.trim()}`
}

function ensureRunSlot(html: string): string {
  if (html.includes(HOSTED_SITE_RUN_SLOT)) return html
  return `${html.trim()}\n<section class="hs-run">\n${HOSTED_SITE_RUN_SLOT}\n</section>\n`
}

function ensureAuthSlot(html: string): string {
  if (html.includes(HOSTED_SITE_AUTH_SLOT)) return html
  return `${html.trim()}\n<section class="hs-auth">\n${HOSTED_SITE_AUTH_SLOT}\n</section>\n`
}

function mergeHex(next: string | null, current: string): hex_color_string {
  return parseHexColor(next ?? "", current as hex_color_string)
}

function mergeAuthProvider(next: HostedSiteAuthProvider | null, current: HostedSiteAuthProvider): HostedSiteAuthProvider {
  return next ?? current
}

export function applyHostedSiteAssistantPatch(
  current: HostedSiteOptions,
  patch: z.infer<typeof hostedSiteAssistantResponseSchema>,
): HostedSiteOptions {
  const base = normalizeHostedSiteOptions(current)
  const authEnabled = patch.authEnabled ?? base.auth.enabled
  return normalizeHostedSiteOptions({
    brand: {
      companyName: patch.companyName?.trim() || base.brand.companyName,
      tagline: patch.tagline?.trim() || base.brand.tagline,
      logoUrl: base.brand.logoUrl,
      primaryColor: mergeHex(patch.primaryColor, base.brand.primaryColor),
      accentColor: mergeHex(patch.accentColor, base.brand.accentColor),
      backgroundColor: mergeHex(patch.backgroundColor, base.brand.backgroundColor),
      textColor: mergeHex(patch.textColor, base.brand.textColor),
    },
    customHtml:
      patch.customHtml != null ? ensureRunSlot(patch.customHtml) : base.customHtml || DEFAULT_HOSTED_SITE_HTML,
    customCss: patch.customCss != null ? patch.customCss : base.customCss,
    hideSpineFooter: patch.hideSpineFooter ?? base.hideSpineFooter,
    auth: {
      ...base.auth,
      enabled: authEnabled,
      provider: mergeAuthProvider(patch.authProvider, base.auth.provider),
    },
    authHtml:
      patch.authHtml != null
        ? ensureAuthSlot(patch.authHtml)
        : base.authHtml || (authEnabled ? DEFAULT_HOSTED_SITE_AUTH_HTML : ""),
    pages: base.pages,
  })
}

export async function proposeHostedSitePage(
  project: Project,
  siteOptions: HostedSiteOptions,
  message: string,
  history: ChatTurn[],
  model: ModelId,
): Promise<HostedSiteAssistantResult> {
  const ledger = new UsageLedger()
  const raw = await llmStructured(
    buildHostedSiteAssistantUserPrompt({
      project,
      siteOptions,
      message,
      history,
    }),
    hostedSiteAssistantResponseSchema,
    { model, ledger, system: buildHostedSiteAssistantSystemPrompt() },
  )
  return {
    message: raw.message.trim() || "Updated the page.",
    siteOptions: applyHostedSiteAssistantPatch(siteOptions, raw),
    usageCents: +ledger.totalCents().toFixed(4),
  }
}
