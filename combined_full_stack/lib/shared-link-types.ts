// AI : client-safe shared-link DTOs — keep in sync with lib/server/shared_links.ts.
import type {
  DocId,
  ModelId,
  ModuleId,
  Project,
  SharedLinkFundingMode,
  SharedLinkId,
} from "./types";

export type SharedLinkDefaultDoc = {
  moduleId: ModuleId;
  filename: string;
  docId: DocId;
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
};

export const SHARED_LINK_SPEND_KEY = "shared link";

export const SHARED_RUN_NOTES_PREFIX = "(shared run)";

export function sharedRunNotes(viewerName?: string): string {
  const who = viewerName?.trim();
  return who ? `${SHARED_RUN_NOTES_PREFIX} — ${who}` : SHARED_RUN_NOTES_PREFIX;
}

export function isSharedRun(run: { source?: string; sharedLinkId?: string }): boolean {
  return run.source === "shared_link" || !!run.sharedLinkId;
}
