// AI : client-safe shared-link DTOs — keep in sync with lib/server/shared_links.ts.
import { RunSource, type DocId, type ModelId, type ModuleId, type InputType, type Project, type SharedLinkFundingMode, type SharedLinkId } from "./types";
import type { HostedSiteActionBinding } from "@/lib/hosted-site-actions";

export type { HostedSiteActionBinding };

export type SharedLinkDefaultDoc = {
  moduleId: ModuleId;
  filename: string;
  docId: DocId;
  // AI : persisted in Supabase default_docs jsonb for serverless — never sent to the client.
  content?: string;
  type?: InputType;
};

// AI : creator-configurable Embed chrome — sites pick what fits their page.
export type EmbedDelivery = "iframe" | "script" | "both";
export type EmbedTheme = "light" | "dark" | "system";

export type EmbedOptions = {
  delivery: EmbedDelivery;
  heightPx: number;
  theme: EmbedTheme;
  hideBranding: boolean;
  postMessageEvents: boolean;
};

export const DEFAULT_EMBED_OPTIONS: EmbedOptions = {
  delivery: "both",
  heightPx: 640,
  theme: "system",
  hideBranding: false,
  postMessageEvents: false,
};

// AI : hosted HTML wrapper around a share-link backend — company chrome, no database of their own.
export type HostedSiteBrand = {
  companyName: string;
  tagline: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
};

export type HostedSiteAuthProvider = "spine" | "custom_supabase";

export type HostedSiteAuth = {
  enabled: boolean;
  provider: HostedSiteAuthProvider;
  // AI : placeholder — custom project instance is not allocated yet.
  customSupabaseUrl: string;
  customSupabaseAnonKey: string;
};

export const DEFAULT_HOSTED_SITE_AUTH: HostedSiteAuth = {
  enabled: false,
  provider: "spine",
  customSupabaseUrl: "",
  customSupabaseAnonKey: "",
};

export type hosted_site_page_path = string & { __brand: "hosted_site_page_path" };

export type HostedSitePage = {
  path: hosted_site_page_path;
  html: string;
};

export type website_runtime_kind = "html" | "react";
export type website_pipeline_alias = string & { __brand: "website_pipeline_alias" };

export type WebsitePipelineBinding = {
  alias: website_pipeline_alias;
  projectId: Project["id"];
  // AI : optional — run this function on the bound project (schedules already do this).
  functionId?: Project["activeFunctionId"];
};

export type HostedSiteReactFile = {
  path: string;
  contents: string;
};

export type HostedSiteOptions = {
  brand: HostedSiteBrand;
  customHtml: string;
  customCss: string;
  hideSpineFooter: boolean;
  auth: HostedSiteAuth;
  authHtml: string;
  // AI : extra pages beyond index (customHtml) + auth.html — empty keeps today's single-page export.
  pages: HostedSitePage[];
  // AI : empty = page-only site. Do not inject a host pipeline at runtime.
  pipelineBindings: WebsitePipelineBinding[];
  // AI : {{action:alias}} buttons — label / trigger JSON / SQL table. Empty = humanize(alias).
  actions: HostedSiteActionBinding[];
  runtime: website_runtime_kind;
  reactFiles: HostedSiteReactFile[];
};

export const DEFAULT_HOSTED_SITE_OPTIONS: HostedSiteOptions = {
  brand: {
    companyName: "",
    tagline: "",
    logoUrl: "",
    primaryColor: "#111827",
    accentColor: "#2563eb",
    backgroundColor: "#f8fafc",
    textColor: "#0f172a",
  },
  customHtml: "",
  customCss: "",
  hideSpineFooter: false,
  auth: { ...DEFAULT_HOSTED_SITE_AUTH },
  authHtml: "",
  pages: [],
  pipelineBindings: [],
  actions: [],
  runtime: "html",
  reactFiles: [],
};

export type SharedLinkRecord = {
  id: SharedLinkId;
  // AI : null = page-only site (no host pipeline).
  projectId: Project["id"] | null;
  name: string;
  description?: string;
  // AI : optional public usage markdown — empty unless the publisher opted in (project Docs stay private).
  viewerMarkdown?: string;
  defaultModel?: ModelId;
  fundingMode: SharedLinkFundingMode;
  viewerNameRequired: boolean;
  defaultDocs: SharedLinkDefaultDoc[];
  spendLimitCents?: number;
  totalSpendCents: number;
  billingMultiple: number;
  flatFeeCents: number;
  runCount: number;
  createdAt: number;
  enabled: boolean;
  revoked: boolean;
  // AI : non-empty + emb_ id ⇒ website Embed deployment (origin-bound).
  allowedOrigins: string[];
  embedOptions: EmbedOptions;
  // AI : site_ id ⇒ Spine-hosted HTML wrapper; empty customHtml uses the default company template.
  siteOptions: HostedSiteOptions;
};

export type SharedLinkPublicView = Pick<
  SharedLinkRecord,
  | "id"
  | "name"
  | "description"
  | "viewerMarkdown"
  | "defaultModel"
  | "fundingMode"
  | "viewerNameRequired"
  | "defaultDocs"
  | "billingMultiple"
  | "flatFeeCents"
  | "allowedOrigins"
  | "embedOptions"
  | "siteOptions"
> & {
  modules: Project["modules"];
  models: Project["models"];
  spendLimitReached: boolean;
  disabled: boolean;
};

export const SHARED_LINK_SPEND_KEY = "shared link";

export const SHARED_RUN_NOTES_PREFIX = "(shared run)";

export function sharedRunNotes(viewerName?: string): string {
  const who = viewerName?.trim();
  return who ? `${SHARED_RUN_NOTES_PREFIX} — ${who}` : SHARED_RUN_NOTES_PREFIX;
}

export function isSharedRun(run: { source?: RunSource; sharedLinkId?: string }): boolean {
  return run.source === RunSource.SharedLink || !!run.sharedLinkId;
}
