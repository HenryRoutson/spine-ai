import { isSiteLinkId } from "@/lib/hosted-site";
import type { HostedApiRecord } from "./hosted-api-types";
import { callerFundsHostedApi } from "./hosted-api-funding";
import { viewerFundsSharedRun } from "./shared-link-funding";
import type { SharedLinkRecord } from "./shared-link-types";

export type DeploymentRow =
  | { kind: "link"; row: SharedLinkRecord }
  | { kind: "embed"; row: SharedLinkRecord }
  | { kind: "site"; row: SharedLinkRecord }
  | { kind: "api"; row: HostedApiRecord };

export type DeploymentKind = DeploymentRow["kind"];

function isEmbedRecord(row: SharedLinkRecord): boolean {
  return /^emb_/i.test(row.id) || (row.allowedOrigins?.length ?? 0) > 0;
}

// AI : assets bill viewers/callers — liabilities bill the publisher.
export function deploymentIsAsset(item: DeploymentRow): boolean {
  return item.kind === "api"
    ? callerFundsHostedApi(item.row.fundingMode)
    : viewerFundsSharedRun(item.row.fundingMode);
}

export function deploymentIsLiability(item: DeploymentRow): boolean {
  return !deploymentIsAsset(item);
}

export function liveDeploymentRows(
  links: SharedLinkRecord[],
  apis: HostedApiRecord[],
): DeploymentRow[] {
  return [
    ...links
      .filter((l) => !l.revoked)
      .map((row) =>
        isSiteLinkId(row.id)
          ? ({ kind: "site" as const, row })
          : isEmbedRecord(row)
            ? ({ kind: "embed" as const, row })
            : ({ kind: "link" as const, row }),
      ),
    ...apis.filter((a) => !a.revoked).map((row) => ({ kind: "api" as const, row })),
  ].sort((a, b) => b.row.createdAt - a.row.createdAt);
}

export function deploymentRowsForProject(rows: DeploymentRow[], projectId: string): DeploymentRow[] {
  return rows.filter((item) => item.row.projectId === projectId);
}

export function partitionDeploymentRows(rows: DeploymentRow[]): {
  assets: DeploymentRow[];
  liabilities: DeploymentRow[];
} {
  const assets: DeploymentRow[] = [];
  const liabilities: DeploymentRow[] = [];
  for (const row of rows) {
    if (deploymentIsAsset(row)) assets.push(row);
    else liabilities.push(row);
  }
  return { assets, liabilities };
}
