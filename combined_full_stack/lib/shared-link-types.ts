// AI : client-safe shared-link DTOs — keep in sync with lib/server/shared_links.ts.
import { RunSource, type DocId, type ModelId, type ModuleId, type InputType, type Project, type SharedLinkFundingMode, type SharedLinkId } from "./types";

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

export type SharedLinkRecord = {
  id: SharedLinkId;
  projectId: Project["id"];
  name: string;
  description?: string;
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
};

export type SharedLinkPublicView = Pick<
  SharedLinkRecord,
  | "id"
  | "name"
  | "description"
  | "defaultModel"
  | "fundingMode"
  | "viewerNameRequired"
  | "defaultDocs"
  | "billingMultiple"
  | "flatFeeCents"
  | "allowedOrigins"
  | "embedOptions"
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
