// AI : client-safe marketplace DTOs — keep in sync with lib/server/marketplace.ts.
import type { MarketplaceListingId, ModuleKind, Project, ProjectId } from "./types";
import type { HostedSiteOptions } from "@/lib/shared-link-types";

export type MarketplaceListingKind = "pipeline" | "website";

export type MarketplaceListingRecord = {
  id: MarketplaceListingId;
  projectId: ProjectId | null;
  kind: MarketplaceListingKind;
  title: string;
  description: string;
  priceCents: number;
  cloneCount: number;
  createdAt: number;
  revoked: boolean;
  siteOptions?: HostedSiteOptions;
};

export type MarketplaceListingCard = MarketplaceListingRecord & {
  stepCount: number;
  stepKinds: ModuleKind[];
  isOwner?: boolean;
};

export type MarketplaceListingDetail = MarketplaceListingCard & {
  // AI : full pipeline snapshot for preview — clone still creates an independent project copy.
  snapshot: Project;
};
