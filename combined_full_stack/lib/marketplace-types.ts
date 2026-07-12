// AI : client-safe marketplace DTOs — keep in sync with lib/server/marketplace.ts.
import type { MarketplaceListingId, ModuleKind, Project, ProjectId } from "./types";

export type MarketplaceListingRecord = {
  id: MarketplaceListingId;
  projectId: ProjectId;
  title: string;
  description: string;
  priceCents: number;
  cloneCount: number;
  createdAt: number;
  revoked: boolean;
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
