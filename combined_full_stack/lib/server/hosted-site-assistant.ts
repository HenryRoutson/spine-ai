// AI : isolated UI vibe agent — HTML/CSS/brand only. No pipeline, Docs, prompts, or code.

import { z } from "zod"
import { llmStructured } from "./llm"
import { UsageLedger } from "./usage"
import type { ChatTurn } from "./assistant-shared"
import { hostedSiteAppSummaryText } from "@/lib/hosted-site-app-summary"
import {
  DEFAULT_HOSTED_SITE_AUTH_HTML,
  DEFAULT_HOSTED_SITE_HTML,
  DEFAULT_HOSTED_SITE_LANDING_HTML,
  HOSTED_SITE_AUTH_SLOT,
  HOSTED_SITE_CHATBOT_SLOT,
  HOSTED_SITE_DOCS_SLOT,
  HOSTED_SITE_OUTPUT_SLOT,
  HOSTED_SITE_PAY_SLOT,
  HOSTED_SITE_RUN_SLOT,
  HOSTED_SITE_TABLE_SLOT,
  normalizeHostedSiteOptions,
  parseHexColor,
  type hex_color_string,
} from "@/lib/hosted-site"
import { listedWebsitePipelineBindings } from "@/lib/website-pipelines"
import type { HostedSiteAuthProvider, HostedSiteOptions, HostedSiteReactFile, website_runtime_kind } from "@/lib/shared-link-types"
import type { ModelId, Project } from "./types"
import { normalizeHostedSiteReactFiles } from "@/lib/hosted-site-react"

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
  reactFilePatches: z
    .array(z.object({ path: z.string(), contents: z.string() }).strict())
    .max(32)
    .nullable(),
})

export type HostedSiteAssistantResult = {
  message: string
  siteOptions: HostedSiteOptions
  usageCents: number
}

export function buildHostedSiteAssistantSystemPrompt(runtime: website_runtime_kind = "html"): string {
  if (runtime === "react") {
    return `You are a product-page designer for a hosted Spine app (Lovable-style React around pipeline widgets).

The default page is a signed-in workspace. Do not add a sign-in screen unless the publisher explicitly asks.

You edit the Vite + React project: src/App.tsx, src/index.css, and files under src/. Keep <RunPipeline alias="…" /> for each bound pipeline (default alias "run") when those widgets are already on the page. Do not add a run widget unless they asked for a workspace. Keep <HostedSlot slot="…" /> for pay / table / output widgets. You may also use data-spine-sql and data-spine-action placeholders from {{sql:table}} / {{action}}.
You MUST NOT change the pipeline, structures, prompts, project Docs, test files, or funding.
You MUST NOT invent a custom Supabase URL or anon key.

Return a short message for the publisher, then fields:
- reactFilePatches: [{path, contents}] for every file you change or add, or null to leave the tree unchanged
- companyName / tagline / colors: new value, or null to leave unchanged
- hideSpineFooter / authEnabled: true/false, or null to leave unchanged
- customHtml / customCss / authHtml: always null in React mode (the HTML snapshot stays as-is)
- authProvider: null unless they asked to change it

Do not remove src/components/RunPipeline.tsx or src/components/HostedSlot.tsx. Do not invent backend routes or npm packages.`
  }
  return `You are a product-page designer for a hosted Spine app (Lovable-style HTML around a run form).

The default page is a signed-in workspace. Do not add a sign-in screen unless the publisher explicitly asks. Sign-in HTML can exist for later; leave authEnabled false unless they want a gate.

You ONLY change the public webpage: custom HTML, extra CSS, brand colors/copy, sign-in page HTML, whether sign-in is required, and whether to hide the Spine footer.
You MUST NOT change the pipeline, structures, prompts, code, project Docs, test files, or funding.
You MUST NOT invent a custom Supabase URL or anon key — that stays a publisher placeholder.

The run form is injected where you place ${HOSTED_SITE_RUN_SLOT}. If the current HTML already has that token, keep exactly one. If the page has no run slot (no pipeline attached yet), do not add one unless they asked for a workspace. You may use {{action}} as the primary button instead on SQL-backed pages.
The sign-in form is injected where you place ${HOSTED_SITE_AUTH_SLOT}. If authEnabled is true, keep exactly one ${HOSTED_SITE_AUTH_SLOT} on the sign-in page.
Optional widgets (existing runtimes, not new backends): ${HOSTED_SITE_OUTPUT_SLOT} (result viewer), ${HOSTED_SITE_CHATBOT_SLOT} (chat), ${HOSTED_SITE_DOCS_SLOT} (viewer markdown), ${HOSTED_SITE_PAY_SLOT} (checkout), ${HOSTED_SITE_TABLE_SLOT} / {{table:ModelName}} (live structure table), {{sql:table}} (live SQL rows from the app store), {{action}} (button that runs the bound pipeline). Keep those tokens if they are already on the page. Keep {{sql:shared_number}} + {{action}} for a shared counter.
Tokens: {{company}}, {{tagline}}, {{logo}}, {{email}} fill from brand fields. Default nav shows {{email}} as the signed-in account. Scripts, iframes, and event handlers are stripped.

Return a short message for the publisher, then fields:
- customHtml / customCss / authHtml: full replacement, or null to leave unchanged
- companyName / tagline / colors: new value, or null to leave unchanged
- hideSpineFooter / authEnabled: true/false, or null to leave unchanged
- authProvider: "spine" (default, handled) or "custom_supabase" (placeholder), or null to leave unchanged
- reactFilePatches: always null in HTML mode

Write complete HTML fragments (nav/hero/features; include ${HOSTED_SITE_RUN_SLOT} only when a workspace belongs on the page; sign-in chrome around ${HOSTED_SITE_AUTH_SLOT} only if they asked). A full <!DOCTYPE html> document is ok — the host unwraps body + <style>.
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
${current.customHtml.trim() || (listedWebsitePipelineBindings(current.pipelineBindings).length > 0 ? DEFAULT_HOSTED_SITE_HTML : DEFAULT_HOSTED_SITE_LANDING_HTML)}

Current sign-in HTML (default template if empty):
${current.authHtml.trim() || DEFAULT_HOSTED_SITE_AUTH_HTML}

Current extra CSS:
${current.customCss.trim() || "(none)"}
${
  current.runtime === "react"
    ? `\nReact project files:\n${current.reactFiles.map((f) => `--- ${f.path} ---\n${f.contents}`).join("\n")}\n`
    : ""
}
${historyBlock}
Publisher request:
${opts.message.trim()}`
}

function ensureRunSlot(html: string, keep: boolean): string {
  if (html.includes(HOSTED_SITE_RUN_SLOT) || html.includes("{{action") || !keep) return html
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

function mergeReactFilePatches(
  current: HostedSiteReactFile[],
  patches: { path: string; contents: string }[] | null,
): HostedSiteReactFile[] {
  if (!patches || patches.length === 0) return current
  const map = new Map(current.map((file) => [file.path, file.contents]))
  for (const patch of patches) {
    const path = patch.path.trim().replace(/^\/+/, "")
    if (!path || path.includes("..")) continue
    map.set(path, patch.contents)
  }
  return normalizeHostedSiteReactFiles([...map.entries()].map(([path, contents]) => ({ path, contents })))
}

export function applyHostedSiteAssistantPatch(
  current: HostedSiteOptions,
  patch: z.infer<typeof hostedSiteAssistantResponseSchema>,
): HostedSiteOptions {
  const base = normalizeHostedSiteOptions(current)
  const authEnabled = patch.authEnabled ?? base.auth.enabled
  const reactMode = base.runtime === "react"
  const keepRun =
    listedWebsitePipelineBindings(base.pipelineBindings).length > 0 ||
    base.customHtml.includes(HOSTED_SITE_RUN_SLOT)
  return normalizeHostedSiteOptions({
    ...base,
    brand: {
      companyName: patch.companyName?.trim() || base.brand.companyName,
      tagline: patch.tagline?.trim() || base.brand.tagline,
      logoUrl: base.brand.logoUrl,
      primaryColor: mergeHex(patch.primaryColor, base.brand.primaryColor),
      accentColor: mergeHex(patch.accentColor, base.brand.accentColor),
      backgroundColor: mergeHex(patch.backgroundColor, base.brand.backgroundColor),
      textColor: mergeHex(patch.textColor, base.brand.textColor),
      functionTheme: base.brand.functionTheme,
      functionBackgroundColor: base.brand.functionBackgroundColor,
      functionTextColor: base.brand.functionTextColor,
      functionAccentColor: base.brand.functionAccentColor,
    },
    customHtml: reactMode
      ? base.customHtml
      : patch.customHtml != null
        ? ensureRunSlot(patch.customHtml, keepRun)
        : base.customHtml || (keepRun ? DEFAULT_HOSTED_SITE_HTML : DEFAULT_HOSTED_SITE_LANDING_HTML),
    customCss: reactMode ? base.customCss : patch.customCss != null ? patch.customCss : base.customCss,
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
    pipelineBindings: base.pipelineBindings,
    runtime: base.runtime,
    reactFiles: reactMode ? mergeReactFilePatches(base.reactFiles, patch.reactFilePatches) : base.reactFiles,
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
    { model, ledger, system: buildHostedSiteAssistantSystemPrompt(siteOptions.runtime) },
  )
  return {
    message: raw.message.trim() || "Updated the page.",
    siteOptions: applyHostedSiteAssistantPatch(siteOptions, raw),
    usageCents: +ledger.totalCents().toFixed(4),
  }
}
