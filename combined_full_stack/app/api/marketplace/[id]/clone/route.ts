import { NextResponse } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { parseMarketplaceListingId } from "@/lib/server/api_schemas";
import {
  cloneMarketplaceListing,
  MarketplaceCloneError,
} from "@/lib/server/marketplace";
import { afterAllocateSiteSupabase } from "@/lib/server/site_supabase_after";
import { logger } from "@/lib/server/server_logger";

const apiLog = logger("api:marketplace:clone");

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuthStore("write");
    if (auth instanceof NextResponse) return auth;
    const { id } = await ctx.params;
    const listingId = parseMarketplaceListingId(id);
    if (!listingId) return apiError("listing not found", 404);

    const result = await cloneMarketplaceListing({
      listingId,
      buyerId: auth.auth.userId,
      store: auth.store,
    });
    if (result.site?.id) afterAllocateSiteSupabase(result.site.id, result.site.siteOptions.auth);
    apiLog.info(`cloned marketplace listing`, {
      listingId,
      projectId: result.project?.id ?? null,
      siteId: result.site?.id ?? null,
      chargedCents: result.chargedCents,
    });
    return NextResponse.json({
      project: result.project ?? null,
      site: result.site ?? null,
      chargedCents: result.chargedCents,
    });
  } catch (err) {
    if (err instanceof MarketplaceCloneError) {
      const status =
        err.code === "not_found"
          ? HTTP.NOT_FOUND
          : err.code === "insufficient_funds"
            ? HTTP.PAYMENT_REQUIRED
            : HTTP.BAD_REQUEST;
      return apiError(err.message, status, err.code);
    }
    apiLog.error(`clone failed`, { error: (err as Error).message });
    return apiError((err as Error).message || "failed to clone listing", 500);
  }
}
