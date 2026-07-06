// AI : client-safe hosted API DTOs — keep in sync with lib/server/hosted_apis.ts.
import type { HostedApiFundingMode, HostedApiId, ModelId, Project } from "./types";
import type { SharedLinkDefaultDoc } from "./shared-link-types";

export type { HostedApiId, HostedApiFundingMode };

export type HostedApiRecord = {
  id: HostedApiId;
  projectId: Project["id"];
  name: string;
  defaultModel?: ModelId;
  defaultDocs: SharedLinkDefaultDoc[];
  apiKeyPrefix: string;
  fundingMode: HostedApiFundingMode;
  billingMultiple: number;
  flatFeeCents: number;
  spendLimitCents?: number;
  totalSpendCents: number;
  requestCount: number;
  createdAt: number;
  revoked: boolean;
};

export type HostedApiCreateResult = HostedApiRecord & {
  apiKey: string;
  invokeUrl: string;
  progressUrl: string;
};

export const HOSTED_API_SPEND_KEY = "hosted api";

export const HOSTED_API_NOTES_PREFIX = "(hosted api)";

export function hostedApiRunNotes(): string {
  return HOSTED_API_NOTES_PREFIX;
}
