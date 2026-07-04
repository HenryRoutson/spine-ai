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
  runCount: number;
  createdAt: number;
  revoked: boolean;
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
> & {
  modules: Project["modules"];
  models: Project["models"];
  spendLimitReached: boolean;
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
