import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import {
  createMarketplaceListingBodySchema,
  formatZodError,
  marketplaceSearchQuerySchema,
  parseRequestJson,
} from "@/lib/server/api_schemas";
import {
  listMarketplaceListings,
  publishMarketplaceListing,
} from "@/lib/server/marketplace";
import { migrateProjectModules } from "@/lib/server/validity";
import { logger } from "@/lib/server/server_logger";
import type { ProjectId } from "@/lib/server/types";

const apiLog = logger("api:marketplace");

export async function GET(req: NextRequest) {
  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;

  const url = new URL(req.url);
  const parsed = marketplaceSearchQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    mine: url.searchParams.get("mine") ?? undefined,
  });
  if (!parsed.success) return apiError(formatZodError(parsed.error), HTTP.BAD_REQUEST);

  const listings = await listMarketplaceListings({
    query: parsed.data.q,
    viewerId: ctx.auth.userId,
    ownerOnly: parsed.data.mine,
  });
  return NextResponse.json({ listings });
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuthStore("write");
    if (ctx instanceof NextResponse) return ctx;
    const parsed = await parseRequestJson(req, createMarketplaceListingBodySchema);
    if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST);
    const body = parsed;
    const project = ctx.store.project(body.projectId as ProjectId);
    if (!project) return apiError(`unknown project ${body.projectId}`, 404);

    const listing = await publishMarketplaceListing({
      ownerId: ctx.auth.userId,
      project: migrateProjectModules(project),
      title: body.title,
      description: body.description ?? "",
      priceCents: body.priceCents ?? 0,
    });
    apiLog.info(`published marketplace listing`, {
      listingId: listing.id,
      projectId: body.projectId,
      priceCents: listing.priceCents,
    });
    return NextResponse.json({ listing });
  } catch (err) {
    apiLog.error(`POST failed`, { error: (err as Error).message });
    return apiError((err as Error).message || "failed to publish listing", 500);
  }
}
