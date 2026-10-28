// AI : marketplace listing CRUD — snapshot a pipeline so others can clone an independent copy.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { uid } from "@/lib/id";
import { MIN_ACCOUNT_BALANCE_CENTS } from "@/lib/billing_config";
import {
  billingKeyForUser,
  billRunUsage,
  BillingError,
  loadBillingAccount,
} from "@/lib/server/billing_account";
import { creditCreatorEarnings } from "@/lib/server/creator_earnings";
import { dataDir } from "./config";
import { createAdminClient } from "./supabase_admin";
import { isMissingSchemaError } from "./supabase_store";
import {
  persistOmittingUnknownColumns,
  siteOptionsFromPersistence,
  SNAPSHOT_HOSTED_SITE_KEY,
  stripHostedSiteFromSnapshot,
  withHostedSiteOnSnapshot,
} from "./shared-link-persist";
import { getSupabasePublicEnv } from "@/utils/supabase/env";
import type { user_id_string } from "./require_auth";
import { cloneProject } from "./seed";
import { migrateProjectModules, projectWithAuthoredModules } from "./validity";
import { logger } from "./server_logger";
import type { Store } from "./store";
import type {
  MarketplaceListingId,
  ModuleKind,
  Project,
  ProjectId,
} from "./types";
import type {
  MarketplaceListingCard,
  MarketplaceListingDetail,
  MarketplaceListingKind,
  MarketplaceListingRecord,
} from "@/lib/marketplace-types";
import type { SharedLinkRecord } from "@/lib/shared-link-types";
import { normalizeHostedSiteOptions } from "@/lib/hosted-site";
import { storedFunctionsOnProject } from "@/lib/pipeline-functions";
import {
  listedWebsitePipelineBindings,
  nullableProjectId,
  pageOnlyProjectStub,
  remapWebsiteProjectId,
} from "@/lib/website-pipelines";
import { publishSharedLink } from "@/lib/server/shared_links";

const mktLog = logger("marketplace");
const MARKETPLACE_PREFIX = "mkt_";

type StoredListing = MarketplaceListingRecord & {
  ownerId: user_id_string;
  snapshot: Project;
};

function isServerless(): boolean {
  return !!process.env.VERCEL;
}

async function supabaseForMarketplace(): Promise<SupabaseClient | null> {
  return createAdminClient();
}

function listingsDir(): string {
  return join(dataDir(), "marketplace_listings");
}

function listingFile(id: MarketplaceListingId): string {
  return join(listingsDir(), `${id}.json`);
}

export function newMarketplaceListingId(): MarketplaceListingId {
  return uid<MarketplaceListingId>(MARKETPLACE_PREFIX);
}

// AI : strip run-scoped doc refs — buyers get the pipeline graph, not the seller's private files.
function snapshotForMarketplace(project: Project): Project {
  const snap = projectWithAuthoredModules(migrateProjectModules(structuredClone(project)));
  return {
    ...snap,
    seedDocNames: undefined,
    expectedOutputs: undefined,
    inferencePresets: undefined,
  };
}

// AI : prod marketplace_listings.kind may not exist yet — website rows still carry snapshot.hostedSite.
export function listingKindFromPersistence(raw: unknown, snapshot?: unknown): MarketplaceListingKind {
  if (raw === "website") return "website";
  if (raw === "pipeline") return "pipeline";
  if (
    snapshot &&
    typeof snapshot === "object" &&
    SNAPSHOT_HOSTED_SITE_KEY in (snapshot as object) &&
    (snapshot as { hostedSite?: unknown }).hostedSite != null
  ) {
    return "website";
  }
  return "pipeline";
}

function snapshotHasPipeline(snapshot: Project): boolean {
  if (snapshot.models.length > 0 || snapshot.modules.length > 0) return true;
  return (snapshot.functions ?? []).some((fn) => fn.modules.length > 0);
}

function stepKinds(snapshot: Project): ModuleKind[] {
  const stored = storedFunctionsOnProject(snapshot).flatMap((fn) => fn.modules);
  return (stored.length > 0 ? stored : snapshot.modules).map((m) => m.kind);
}

function listingStepCount(row: StoredListing): number {
  if (row.kind === "website") {
    const actions = row.siteOptions?.actions.length ?? 0;
    const bindings = listedWebsitePipelineBindings(row.siteOptions?.pipelineBindings ?? []).length;
    if (actions > 0) return actions;
    if (bindings > 0) return bindings;
  }
  const stored = storedFunctionsOnProject(row.snapshot);
  const n = stored.reduce((sum, fn) => sum + fn.modules.length, 0);
  return n > 0 ? n : row.snapshot.modules.length;
}

function toRecord(row: StoredListing): MarketplaceListingRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    kind: row.kind,
    title: row.title,
    description: row.description,
    priceCents: row.priceCents,
    cloneCount: row.cloneCount,
    createdAt: row.createdAt,
    revoked: row.revoked,
    ...(row.kind === "website" && row.siteOptions ? { siteOptions: row.siteOptions } : {}),
  };
}

function toCard(row: StoredListing, viewerId?: user_id_string): MarketplaceListingCard {
  return {
    ...toRecord(row),
    stepCount: listingStepCount(row),
    stepKinds: stepKinds(row.snapshot),
    isOwner: viewerId != null && row.ownerId === viewerId,
  };
}

function toDetail(row: StoredListing, viewerId?: user_id_string): MarketplaceListingDetail {
  return {
    ...toCard(row, viewerId),
    snapshot: row.snapshot,
  };
}

function matchesQuery(row: StoredListing, q: string): boolean {
  if (!q) return true;
  const hay = `${row.title}\n${row.description}\n${row.snapshot.name}`.toLowerCase();
  return hay.includes(q);
}

function loadLocalListing(id: MarketplaceListingId): StoredListing | null {
  const path = listingFile(id);
  if (!existsSync(path)) return null;
  const raw = JSON.parse(readFileSync(path, "utf8")) as StoredListing;
  const kind = listingKindFromPersistence(raw.kind, raw.snapshot);
  return {
    ...raw,
    kind,
    projectId: nullableProjectId(raw.projectId),
    siteOptions: kind === "website" ? siteOptionsFromPersistence(raw.siteOptions, raw.snapshot) : undefined,
  };
}

function saveLocalListing(row: StoredListing): void {
  mkdirSync(listingsDir(), { recursive: true });
  writeFileSync(listingFile(row.id), JSON.stringify(row, null, 2));
}

function listLocalListings(): StoredListing[] {
  const dir = listingsDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => loadLocalListing(f.replace(".json", "") as MarketplaceListingId))
    .filter((r): r is StoredListing => r != null);
}

function rowFromSupabase(data: Record<string, unknown>): StoredListing {
  const kind = listingKindFromPersistence(data.kind, data.snapshot);
  return {
    id: data.id as MarketplaceListingId,
    ownerId: data.owner_id as user_id_string,
    projectId: nullableProjectId(data.project_id),
    kind,
    title: String(data.title ?? ""),
    description: String(data.description ?? ""),
    priceCents: Number(data.price_cents ?? 0),
    snapshot: data.snapshot as Project,
    cloneCount: Number(data.clone_count ?? 0),
    createdAt: Number(data.created_at ?? 0),
    revoked: Boolean(data.revoked),
    siteOptions: kind === "website" ? siteOptionsFromPersistence(data.site_options, data.snapshot) : undefined,
  };
}

async function loadSupabaseListing(id: MarketplaceListingId): Promise<StoredListing | null> {
  const db = await supabaseForMarketplace();
  if (!db) return null;
  const { data, error } = await db
    .from("marketplace_listings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (isMissingSchemaError(error)) return null;
    throw error;
  }
  if (!data) return null;
  return rowFromSupabase(data as Record<string, unknown>);
}

export async function getMarketplaceListing(id: MarketplaceListingId): Promise<StoredListing | null> {
  const fromDb = await loadSupabaseListing(id);
  if (fromDb) return fromDb;
  return loadLocalListing(id);
}

export async function listMarketplaceListings(opts: {
  query?: string;
  viewerId?: user_id_string;
  ownerOnly?: boolean;
  kind?: MarketplaceListingKind;
}): Promise<MarketplaceListingCard[]> {
  const q = (opts.query ?? "").trim().toLowerCase();
  const kindOk = (row: StoredListing) => !opts.kind || row.kind === opts.kind;
  const db = await supabaseForMarketplace();
  if (db) {
    let req = db.from("marketplace_listings").select("*").eq("revoked", false).order("created_at", {
      ascending: false,
    });
    if (opts.ownerOnly && opts.viewerId) {
      req = req.eq("owner_id", opts.viewerId);
    }
    const { data, error } = await req.limit(200);
    if (error) {
      if (!isMissingSchemaError(error)) throw error;
      mktLog.warn(`list supabase failed — local fallback`, { error: error.message });
    } else {
      return (data ?? [])
        .map((row) => rowFromSupabase(row as Record<string, unknown>))
        .filter((row) => !opts.ownerOnly || row.ownerId === opts.viewerId)
        .filter((row) => kindOk(row))
        .filter((row) => matchesQuery(row, q))
        .map((row) => toCard(row, opts.viewerId));
    }
  }

  return listLocalListings()
    .filter((row) => !row.revoked)
    .filter((row) => !opts.ownerOnly || row.ownerId === opts.viewerId)
    .filter((row) => kindOk(row))
    .filter((row) => matchesQuery(row, q))
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((row) => toCard(row, opts.viewerId));
}

export type PublishMarketplaceInput = {
  ownerId: user_id_string;
  project?: Project;
  kind?: MarketplaceListingKind;
  siteOptions?: unknown;
  title: string;
  description: string;
  priceCents: number;
};

export async function publishMarketplaceListing(
  input: PublishMarketplaceInput,
): Promise<MarketplaceListingRecord> {
  const priceCents = Math.max(0, Math.round(input.priceCents));
  if (priceCents > 10_000_000) {
    throw new Error("Price must be at most $100,000");
  }
  const title = input.title.trim();
  if (!title) throw new Error("Title is required");

  const kind: MarketplaceListingKind = input.kind === "website" ? "website" : "pipeline";
  if (kind === "pipeline" && !input.project) throw new Error("project is required");
  const siteOptions =
    kind === "website"
      ? normalizeHostedSiteOptions(
          input.siteOptions ?? { brand: { companyName: input.project?.name ?? title } },
        )
      : undefined;
  if (kind === "website" && !siteOptions?.brand.companyName.trim()) {
    throw new Error("Website listing requires a company name");
  }

  const id = newMarketplaceListingId();
  const snapshot = input.project
    ? snapshotForMarketplace(input.project)
    : pageOnlyProjectStub(siteOptions?.brand.companyName ?? title);
  const persistSnapshot =
    kind === "website" && siteOptions ? withHostedSiteOnSnapshot(snapshot, siteOptions) : snapshot;
  const row: StoredListing = {
    id,
    ownerId: input.ownerId,
    projectId: input.project?.id ?? null,
    kind,
    title,
    description: input.description.trim(),
    priceCents,
    snapshot: persistSnapshot,
    cloneCount: 0,
    createdAt: Date.now(),
    revoked: false,
    siteOptions,
  };

  if (!isServerless()) saveLocalListing(row);
  const db = await supabaseForMarketplace();
  if (!db) {
    if (isServerless() || getSupabasePublicEnv()) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY required to publish marketplace listings");
    }
    saveLocalListing(row);
    return toRecord(row);
  }

  const persist = async (projectId: ProjectId | null | "") =>
    persistOmittingUnknownColumns(
      (payload) => db.from("marketplace_listings").upsert(payload),
      {
        id: row.id,
        owner_id: row.ownerId,
        project_id: projectId,
        title: row.title,
        description: row.description,
        price_cents: row.priceCents,
        snapshot: row.snapshot,
        clone_count: 0,
        created_at: row.createdAt,
        revoked: false,
        kind: row.kind,
        site_options: row.siteOptions ?? null,
      },
    );

  let { error } = await persist(row.projectId);
  if (error && /null|project_id/i.test(error.message ?? "") && row.projectId == null) {
    ({ error } = await persist(""));
  }
  if (error) {
    if (isServerless() || !isMissingSchemaError(error)) {
      throw new Error(`marketplace persistence failed: ${error.message}`);
    }
    mktLog.warn(`supabase upsert failed — saved locally`, { error: error.message });
    saveLocalListing(row);
  }
  return toRecord(row);
}

export async function revokeMarketplaceListing(
  ownerId: user_id_string,
  id: MarketplaceListingId,
): Promise<boolean> {
  const listing = await getMarketplaceListing(id);
  if (!listing || listing.ownerId !== ownerId) return false;
  listing.revoked = true;
  saveLocalListing(listing);
  const db = await supabaseForMarketplace();
  if (db) {
    await db
      .from("marketplace_listings")
      .update({ revoked: true })
      .eq("id", id)
      .eq("owner_id", ownerId);
  }
  return true;
}

export async function getMarketplaceListingDetail(
  id: MarketplaceListingId,
  viewerId?: user_id_string,
): Promise<MarketplaceListingDetail | null> {
  const listing = await getMarketplaceListing(id);
  if (!listing || listing.revoked) return null;
  return toDetail(listing, viewerId);
}

export class MarketplaceCloneError extends Error {
  constructor(readonly code: "not_found" | "insufficient_funds" | "own_listing") {
    super(
      code === "not_found"
        ? "Listing not found"
        : code === "own_listing"
          ? "You already own this listing — open the project from your workspace."
          : "Not enough credit — top up in Billing to buy this listing.",
    );
  }
}

export async function cloneMarketplaceListing(opts: {
  listingId: MarketplaceListingId;
  buyerId: user_id_string;
  store: Store;
}): Promise<{ project?: Project; site?: SharedLinkRecord; chargedCents: number }> {
  const listing = await getMarketplaceListing(opts.listingId);
  if (!listing || listing.revoked) throw new MarketplaceCloneError("not_found");
  if (listing.ownerId === opts.buyerId) throw new MarketplaceCloneError("own_listing");

  const priceCents = Math.max(0, Math.round(listing.priceCents));
  if (priceCents > 0) {
    const key = billingKeyForUser(opts.buyerId);
    const account = await loadBillingAccount(key);
    if (account.balanceCents - priceCents < MIN_ACCOUNT_BALANCE_CENTS) {
      throw new MarketplaceCloneError("insufficient_funds");
    }
    try {
      await billRunUsage(key, priceCents, {
        flowType: "usage_marketplace",
        refId: listing.id,
        detail: { sellerId: listing.ownerId, title: listing.title },
      });
    } catch (err) {
      if (err instanceof BillingError) throw new MarketplaceCloneError("insufficient_funds");
      throw err;
    }
    await creditCreatorEarnings(listing.ownerId, priceCents);
  }

  let project: Project | undefined;
  if (listing.kind !== "website" || snapshotHasPipeline(listing.snapshot)) {
    project = migrateProjectModules(cloneProject(stripHostedSiteFromSnapshot(listing.snapshot), opts.store.projects()));
    opts.store.saveProject(project);
    await opts.store.flush();
  }

  let site: SharedLinkRecord | undefined;
  if (listing.kind === "website") {
    const fromId = listing.projectId ?? nullableProjectId(listing.snapshot.id);
    const siteOptions = remapWebsiteProjectId(
      normalizeHostedSiteOptions(listing.siteOptions ?? { brand: { companyName: listing.title } }),
      fromId,
      project?.id ?? null,
    );
    site = await publishSharedLink({
      ownerId: opts.buyerId,
      project,
      store: opts.store,
      kind: "site",
      siteOptions,
      defaultDocsByModule: {},
    });
  }

  listing.cloneCount += 1;
  saveLocalListing(listing);
  const db = await supabaseForMarketplace();
  if (db) {
    await db
      .from("marketplace_listings")
      .update({ clone_count: listing.cloneCount })
      .eq("id", listing.id)
      .eq("owner_id", listing.ownerId);
  }

  mktLog.info(`cloned marketplace listing`, {
    listingId: listing.id,
    buyerId: opts.buyerId,
    projectId: project?.id ?? null,
    siteId: site?.id ?? null,
    chargedCents: priceCents,
  });
  return { project, site, chargedCents: priceCents };
}
