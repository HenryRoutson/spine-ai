import { NextResponse } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { parseMarketplaceListingId } from "@/lib/server/api_schemas";
import {
  getMarketplaceListingDetail,
  revokeMarketplaceListing,
} from "@/lib/server/marketplace";
import { logger } from "@/lib/server/server_logger";

const apiLog = logger("api:marketplace:id");

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthStore();
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;
  const listingId = parseMarketplaceListingId(id);
  if (!listingId) return apiError("listing not found", 404);

  const listing = await getMarketplaceListingDetail(listingId, auth.auth.userId);
  if (!listing) return apiError("listing not found", 404);
  return NextResponse.json({ listing });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthStore("write");
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;
  const listingId = parseMarketplaceListingId(id);
  if (!listingId) return apiError("listing not found", 404);

  const ok = await revokeMarketplaceListing(auth.auth.userId, listingId);
  if (!ok) return apiError("listing not found", HTTP.NOT_FOUND);
  apiLog.info(`revoked marketplace listing`, { listingId });
  return NextResponse.json({ ok: true });
}
