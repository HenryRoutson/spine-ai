// AI : Shared link CRUD, progress tokens, and store orchestration.
// AI : Session doc management lives in shared-link-session.ts.
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";
import { PUBLIC_RUN_SPEND_RESERVE_CENTS } from "@/lib/billing_config";
import { uid } from "@/lib/id";
import { upstashConfigured } from "@/lib/rate_limit_config";
import { getSupabasePublicEnv } from "@/utils/supabase/env";
import { dataDir } from "./config";
import { createAdminClient } from "./supabase_admin";
import { hashContent, type Store } from "./store";
import { migrateProjectModules, projectWithAuthoredModules } from "./validity";
import { isMissingSchemaError } from "./supabase_store";
import {
  persistOmittingUnknownColumns,
  siteOptionsFromPersistence,
  stripHostedSiteFromSnapshot,
  withHostedSiteOnSnapshot,
} from "./shared-link-persist";
import { LOCAL_DEV_USER_ID, isLocalDevMode, type user_id_string } from "./require_auth";
import {
  assertValidSharedLinkPricing,
  billingMultipleFromLegacyMarkupBps,
  normalizeBillingMultiple,
  normalizeFlatFeeCents,
} from "@/lib/server/billable_pricing";
import { defaultDocStorageKey } from "./shared-link-session";
import {
  SharedLinkFundingMode,
  type DocId,
  type ModelId,
  type ModuleId,
  type PipelineModule,
  type Project,
  type ProjectId,
  type SharedLinkId,
} from "./types";
import { logger } from "./server_logger";
import type { SharedLinkDefaultDoc, SharedLinkRecord, EmbedOptions, HostedSiteBrand, HostedSiteOptions } from "@/lib/shared-link-types";
import { DEFAULT_EMBED_OPTIONS } from "@/lib/shared-link-types";
import { isEmbedLinkId, normalizeEmbedOrigins } from "@/lib/server/embed_origins";
import { isSiteLinkId, normalizeHostedSiteOptions } from "@/lib/hosted-site";
import { projectForFunction } from "@/lib/pipeline-functions"
import { DEFAULT_WEBSITE_PIPELINE_ALIAS, nullableProjectId, pageOnlyProjectStub, resolveWebsitePipelineBindings, UNNAMED_WEBSITE_NAME } from "@/lib/website-pipelines"
import { isUnnamedProjectName } from "@/lib/project-assistant-types";
import { normalizeViewerMarkdown } from "@/lib/share-viewer-markdown";

export type { SharedLinkDefaultDoc, SharedLinkRecord };

export class SharedLinkSpendLimitError extends Error {
  constructor() {
    super("This link has reached its spending limit.");
  }
}

export class SharedLinkSpendLimitTooLowError extends Error {
  constructor(spentCents: number) {
    super(
      `Spending limit must be at least $${(spentCents / 100).toFixed(2)} — already spent on this link.`,
    );
  }
}

export class SharedLinkDisabledError extends Error {
  constructor() {
    super("This link is temporarily disabled.");
  }
}

export function sharedLinkSpendLimitReached(
  link: Pick<SharedLinkRecord, "spendLimitCents" | "totalSpendCents">,
): boolean {
  if (link.spendLimitCents == null) return false;
  return link.totalSpendCents >= link.spendLimitCents;
}

export function assertSharedLinkCanAcceptRun(
  link: Pick<SharedLinkRecord, "spendLimitCents" | "totalSpendCents" | "enabled">,
): void {
  assertSharedLinkEnabled(link);
  if (sharedLinkSpendLimitReached(link)) throw new SharedLinkSpendLimitError();
}

export function assertSharedLinkEnabled(
  link: Pick<SharedLinkRecord, "enabled">,
): void {
  if (link.enabled === false) throw new SharedLinkDisabledError();
}

function toExactSpendCents(cents: number): number {
  return +Math.max(0, cents).toFixed(4);
}

const linkLog = logger("shared-links");

const SHARED_LINK_PREFIX = "pub_";
const EMBED_LINK_PREFIX = "emb_";
const SITE_LINK_PREFIX = "site_";

function isServerless(): boolean {
  return !!process.env.VERCEL;
}

function normalizeEmbedOptions(raw: unknown): EmbedOptions {
  const o = (raw && typeof raw === "object" ? raw : {}) as Partial<EmbedOptions>;
  return {
    delivery: o.delivery === "iframe" || o.delivery === "script" || o.delivery === "both"
      ? o.delivery
      : DEFAULT_EMBED_OPTIONS.delivery,
    heightPx:
      typeof o.heightPx === "number" && Number.isFinite(o.heightPx)
        ? Math.min(2400, Math.max(240, Math.round(o.heightPx)))
        : DEFAULT_EMBED_OPTIONS.heightPx,
    theme: o.theme === "light" || o.theme === "dark" || o.theme === "system"
      ? o.theme
      : DEFAULT_EMBED_OPTIONS.theme,
    hideBranding: o.hideBranding === true,
    postMessageEvents: o.postMessageEvents === true,
  };
}

function originsFromRow(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return normalizeEmbedOrigins(raw.map(String));
}

// AI : SECURITY — deploy mutations require service role after RLS hardening; no user-session fallback.
async function supabaseForSharedLinks(): Promise<SupabaseClient | null> {
  return createAdminClient();
}

type StoredSharedLink = SharedLinkRecord & {
  ownerId: user_id_string;
  snapshot: Project;
};

type ProgressTokenEntry = {
  linkId: SharedLinkId;
  ownerId: user_id_string;
  jobId: string;
  token: string;
  createdAt: number;
};

function linksDir(): string {
  return join(dataDir(), "shared_links");
}

function linkFile(id: SharedLinkId): string {
  return join(linksDir(), `${id}.json`);
}

function linkDocsDir(id: SharedLinkId): string {
  return join(linksDir(), "docs", id);
}

function defaultDocsDir(linkId: SharedLinkId): string {
  return join(linkDocsDir(linkId), "defaults");
}

const PROGRESS_TOKEN_TTL_SEC = 86_400;

function progressTokensFile(): string {
  return join(linksDir(), "progress_tokens.json");
}

function progressTokenRedisKey(linkId: SharedLinkId, jobId: string): string {
  return `shared_progress:${linkId}:${jobId}`;
}

function readProgressTokens(): ProgressTokenEntry[] {
  const path = progressTokensFile();
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf8")) as ProgressTokenEntry[];
}

function writeProgressTokens(entries: ProgressTokenEntry[]): void {
  mkdirSync(linksDir(), { recursive: true });
  writeFileSync(progressTokensFile(), JSON.stringify(entries, null, 2));
}

// AI : SECURITY — prefer Upstash so tokens work across serverless instances; local JSON for local-dev only.
export async function registerSharedProgressToken(
  linkId: SharedLinkId,
  ownerId: user_id_string,
  jobId: string,
): Promise<string> {
  const token = randomBytes(24).toString("hex");
  const entry: ProgressTokenEntry = { linkId, ownerId, jobId, token, createdAt: Date.now() };
  if (upstashConfigured()) {
    const redis = Redis.fromEnv();
    await redis.set(progressTokenRedisKey(linkId, jobId), entry, { ex: PROGRESS_TOKEN_TTL_SEC });
    return token;
  }
  if (process.env.VERCEL) {
    throw new Error("Progress tokens require UPSTASH_REDIS_REST_URL/TOKEN on Vercel");
  }
  const entries = readProgressTokens().filter((e) => Date.now() - e.createdAt < PROGRESS_TOKEN_TTL_SEC * 1000);
  entries.push(entry);
  writeProgressTokens(entries);
  return token;
}

export async function verifySharedProgressToken(
  linkId: SharedLinkId,
  jobId: string,
  token: string,
): Promise<ProgressTokenEntry | null> {
  if (upstashConfigured()) {
    const redis = Redis.fromEnv();
    const entry = await redis.get<ProgressTokenEntry>(progressTokenRedisKey(linkId, jobId));
    if (!entry || entry.token !== token || entry.linkId !== linkId || entry.jobId !== jobId) return null;
    return entry;
  }
  if (process.env.VERCEL) return null;
  return (
    readProgressTokens().find((e) => e.linkId === linkId && e.jobId === jobId && e.token === token) ??
    null
  );
}

export function newSharedLinkId(): SharedLinkId {
  return uid<SharedLinkId>(SHARED_LINK_PREFIX);
}

export function newEmbedLinkId(): SharedLinkId {
  return uid<SharedLinkId>(EMBED_LINK_PREFIX);
}

export function newSiteLinkId(): SharedLinkId {
  return uid<SharedLinkId>(SITE_LINK_PREFIX);
}

export function newSessionId(): string {
  return randomBytes(16).toString("hex");
}

function loadLocalLink(id: SharedLinkId): StoredSharedLink | null {
  const path = linkFile(id);
  if (!existsSync(path)) return null;
  const row = JSON.parse(readFileSync(path, "utf8")) as StoredSharedLink & {
    markupBps?: number;
    markupFixedCents?: number;
  };
  return {
    ...row,
    totalSpendCents: row.totalSpendCents ?? 0,
    billingMultiple: normalizeBillingMultiple(
      row.billingMultiple ??
        billingMultipleFromLegacyMarkupBps(row.markupBps),
    ),
    flatFeeCents: normalizeFlatFeeCents(row.flatFeeCents ?? row.markupFixedCents ?? 0),
    enabled: row.enabled !== false,
    allowedOrigins: originsFromRow(row.allowedOrigins),
    embedOptions: normalizeEmbedOptions(row.embedOptions),
    siteOptions: siteOptionsFromPersistence(row.siteOptions, row.snapshot),
    viewerMarkdown: normalizeViewerMarkdown(row.viewerMarkdown),
    projectId: nullableProjectId(row.projectId),
  };
}

function saveLocalLink(row: StoredSharedLink): void {
  mkdirSync(linksDir(), { recursive: true });
  writeFileSync(linkFile(row.id), JSON.stringify(row, null, 2));
}

function persistSnapshot(row: Pick<StoredSharedLink, "id" | "snapshot" | "siteOptions">): Project {
  return isSiteLinkId(row.id) ? withHostedSiteOnSnapshot(row.snapshot, row.siteOptions) : row.snapshot;
}

function storedFromDbRow(data: Record<string, unknown>): StoredSharedLink {
  const snapshotRaw = data.snapshot;
  return {
    id: data.id as SharedLinkId,
    ownerId: data.owner_id as user_id_string,
    projectId: nullableProjectId(data.project_id),
    name: (snapshotRaw as Project).name,
    description: undefined,
    viewerMarkdown: normalizeViewerMarkdown(data.viewer_markdown),
    snapshot: migrateProjectModules(stripHostedSiteFromSnapshot(snapshotRaw)),
    defaultModel: (data.default_model as ModelId | null) ?? undefined,
    fundingMode: data.funding_mode as SharedLinkFundingMode,
    viewerNameRequired: Boolean(data.viewer_name_required),
    defaultDocs: (data.default_docs ?? []) as SharedLinkDefaultDoc[],
    spendLimitCents:
      data.spend_limit_cents != null ? Number(data.spend_limit_cents) : undefined,
    totalSpendCents: Number(data.total_spend_cents ?? 0),
    billingMultiple: normalizeBillingMultiple(
      data.billing_multiple != null
        ? Number(data.billing_multiple)
        : billingMultipleFromLegacyMarkupBps(Number(data.markup_bps ?? 0)),
    ),
    flatFeeCents: normalizeFlatFeeCents(Number(data.markup_fixed_cents ?? 0)),
    runCount: Number(data.run_count ?? 0),
    createdAt: Number(data.created_at),
    enabled: data.enabled !== false,
    revoked: Boolean(data.revoked),
    allowedOrigins: originsFromRow(data.allowed_origins),
    embedOptions: normalizeEmbedOptions(data.embed_options),
    siteOptions: siteOptionsFromPersistence(data.site_options, snapshotRaw),
  };
}

function sharedLinkInsertRow(
  row: StoredSharedLink,
  projectId: ProjectId | null | "",
): Record<string, unknown> {
  return {
    id: row.id,
    owner_id: row.ownerId,
    project_id: projectId,
    snapshot: persistSnapshot(row),
    default_docs: row.defaultDocs,
    default_model: row.defaultModel ?? null,
    funding_mode: row.fundingMode,
    viewer_name_required: row.viewerNameRequired,
    spend_limit_cents: row.spendLimitCents ?? null,
    total_spend_cents: row.totalSpendCents,
    billing_multiple: row.billingMultiple,
    markup_fixed_cents: row.flatFeeCents,
    markup_bps: 0,
    enabled: true,
    revoked: false,
    run_count: 0,
    created_at: row.createdAt,
    allowed_origins: row.allowedOrigins,
    embed_options: row.embedOptions,
    site_options: row.siteOptions,
    viewer_markdown: row.viewerMarkdown ?? "",
  };
}

// AI : public link fetch by id — service role only; anon RLS no longer grants blanket SELECT.
async function loadSupabaseLink(id: SharedLinkId): Promise<StoredSharedLink | null> {
  const db = await createAdminClient();
  if (!db) {
    if (isServerless()) return null;
    return loadLocalLink(id);
  }
  const { data, error } = await db
    .from("shared_links")
    .select("*")
    .eq("id", id)
    .eq("revoked", false)
    .maybeSingle();
  if (error || !data) return null;
  return storedFromDbRow(data as Record<string, unknown>);
}

export async function getSharedLink(id: SharedLinkId): Promise<StoredSharedLink | null> {
  // AI : Vercel /tmp is per-instance — metadata must come from Supabase, not local JSON.
  if (isServerless()) return loadSupabaseLink(id);
  const local = loadLocalLink(id);
  if (local && !local.revoked) return local;
  return loadSupabaseLink(id);
}

function listLocalLinksForOwner(ownerId: user_id_string): SharedLinkRecord[] {
  if (!existsSync(linksDir())) return [];
  return readdirSync(linksDir())
    .filter((f) => f.endsWith(".json") && f !== "progress_tokens.json")
    .map((f) => loadLocalLink(f.replace(".json", "") as SharedLinkId))
    .filter((r): r is StoredSharedLink => r != null && r.ownerId === ownerId && !r.revoked)
    .map(toPublicRecord);
}

export async function listSharedLinksForOwner(ownerId: user_id_string): Promise<SharedLinkRecord[]> {
  const db = await supabaseForSharedLinks();
  if (!db) return listLocalLinksForOwner(ownerId);
  const { data, error } = await db.from("shared_links").select("*").eq("owner_id", ownerId);
  if (error) {
    if (isMissingSchemaError(error)) return listLocalLinksForOwner(ownerId);
    throw error;
  }
  return (data ?? []).map((row) => toPublicRecord(storedFromDbRow(row as Record<string, unknown>)));
}

function toPublicRecord(row: StoredSharedLink): SharedLinkRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    description: row.description,
    viewerMarkdown: normalizeViewerMarkdown(row.viewerMarkdown),
    defaultModel: row.defaultModel,
    fundingMode: row.fundingMode,
    viewerNameRequired: row.viewerNameRequired,
    defaultDocs: row.defaultDocs,
    spendLimitCents: row.spendLimitCents,
    totalSpendCents: row.totalSpendCents,
    billingMultiple: row.billingMultiple,
    flatFeeCents: row.flatFeeCents,
    runCount: row.runCount,
    createdAt: row.createdAt,
    enabled: row.enabled !== false,
    revoked: row.revoked,
    allowedOrigins: row.allowedOrigins ?? [],
    embedOptions: normalizeEmbedOptions(row.embedOptions),
    siteOptions: normalizeHostedSiteOptions(row.siteOptions),
  };
}

export type PublishSharedLinkInput = {
  ownerId: user_id_string;
  project?: Project;
  defaultModel?: ModelId;
  fundingMode?: SharedLinkFundingMode;
  viewerNameRequired?: boolean;
  spendLimitCents?: number;
  billingMultiple?: number;
  flatFeeCents?: number;
  defaultDocsByModule: Partial<Record<ModuleId, DocId[]>>;
  store: Store;
  kind?: "link" | "embed" | "site";
  allowedOrigins?: string[];
  embedOptions?: Partial<EmbedOptions>;
  siteOptions?: unknown;
  viewerMarkdown?: string;
};

export async function publishSharedLink(input: PublishSharedLinkInput): Promise<SharedLinkRecord> {
  const isEmbed = input.kind === "embed";
  const isSite = input.kind === "site";
  const allowedOrigins = isEmbed ? normalizeEmbedOrigins(input.allowedOrigins ?? []) : [];
  if (isEmbed && allowedOrigins.length === 0) {
    throw new Error("Embed requires at least one allowed origin");
  }
  const id = isSite ? newSiteLinkId() : isEmbed ? newEmbedLinkId() : newSharedLinkId();
  const fundingMode = input.fundingMode ?? SharedLinkFundingMode.SharerPays;
  const billingMultiple = normalizeBillingMultiple(input.billingMultiple);
  const flatFeeCents = normalizeFlatFeeCents(input.flatFeeCents);
  assertValidSharedLinkPricing(fundingMode, billingMultiple, flatFeeCents);
  const embedOptions = normalizeEmbedOptions(isEmbed ? input.embedOptions : undefined);
  const siteOptions = normalizeHostedSiteOptions(isSite ? input.siteOptions : undefined);
  if (isSite && isUnnamedProjectName(siteOptions.brand.companyName)) {
    siteOptions.brand = { ...siteOptions.brand, companyName: UNNAMED_WEBSITE_NAME }
  }
  if (isSite && !siteOptions.brand.companyName.trim()) {
    throw new Error("Hosted page requires a company name");
  }

  const source = input.project ?? pageOnlyProjectStub(siteOptions.brand.companyName || UNNAMED_WEBSITE_NAME);
  const snapshot = projectWithAuthoredModules(migrateProjectModules(structuredClone(source)));
  const defaultDocs: SharedLinkDefaultDoc[] = [];
  // AI : Vercel /tmp is optional — jsonb default_docs is the source of truth. A local write must not fail publish.
  const persistLocalFiles = !isServerless();
  if (persistLocalFiles) mkdirSync(defaultDocsDir(id), { recursive: true });

  for (const [moduleId, docIds] of Object.entries(input.defaultDocsByModule)) {
    for (const docId of docIds ?? []) {
      const doc = input.store.docs().find((d) => d.id === docId);
      const content = input.store.docContent(docId);
      if (!doc || content === undefined) continue;
      if (persistLocalFiles) {
        const storageKey = defaultDocStorageKey(moduleId, doc.name);
        const dest = join(defaultDocsDir(id), storageKey);
        writeFileSync(dest, content, "utf8");
        writeFileSync(
          `${dest}.meta.json`,
          JSON.stringify({ moduleId, filename: doc.name, type: doc.type, label: doc.label }),
        );
        const bytesPath = join(dataDir(), "docs", `${docId}`);
        for (const ext of ["pdf", "png", "jpg", "jpeg"]) {
          const src = `${bytesPath}.${ext}`;
          if (existsSync(src)) {
            writeFileSync(join(defaultDocsDir(id), `${storageKey}.${ext}`), readFileSync(src));
          }
        }
      }
      defaultDocs.push({
        moduleId: moduleId as ModuleId,
        filename: doc.name,
        docId,
        content,
        type: doc.type,
      });
    }
  }

  const row: StoredSharedLink = {
    id,
    ownerId: input.ownerId,
    projectId: input.project?.id ?? null,
    name: isSite ? siteOptions.brand.companyName : snapshot.name,
    description: undefined,
    viewerMarkdown: normalizeViewerMarkdown(input.viewerMarkdown),
    snapshot,
    defaultModel: input.defaultModel,
    fundingMode,
    viewerNameRequired: input.viewerNameRequired ?? false,
    spendLimitCents:
      input.spendLimitCents != null ? toExactSpendCents(input.spendLimitCents) : undefined,
    totalSpendCents: 0,
    billingMultiple,
    flatFeeCents,
    defaultDocs,
    runCount: 0,
    createdAt: Date.now(),
    enabled: true,
    revoked: false,
    allowedOrigins,
    embedOptions,
    siteOptions,
  };

  if (!isServerless()) saveLocalLink(row);
  const db = await supabaseForSharedLinks();
  if (!db) {
    if (isServerless() || getSupabasePublicEnv()) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY required to publish shared links");
    }
    saveLocalLink(row);
    return toPublicRecord(row);
  }
  let { error } = await persistOmittingUnknownColumns(
    (payload) => db.from("shared_links").upsert(payload),
    sharedLinkInsertRow(row, row.projectId),
  );
  if (error && /null|not-null|project_id/i.test(error.message ?? "") && row.projectId == null) {
    ({ error } = await persistOmittingUnknownColumns(
      (payload) => db.from("shared_links").upsert(payload),
      sharedLinkInsertRow(row, ""),
    ));
  }
  if (error) {
    if (isServerless() || !isMissingSchemaError(error)) {
      throw new Error(`shared link persistence failed: ${error.message}`);
    }
    linkLog.warn(`supabase upsert failed — saved locally`, { error: error.message });
    saveLocalLink(row);
  }
  return toPublicRecord(row);
}

export async function revokeSharedLink(ownerId: user_id_string, id: SharedLinkId): Promise<boolean> {
  const link = await getSharedLink(id);
  if (!link || link.ownerId !== ownerId) return false;
  link.revoked = true;
  saveLocalLink(link);
  const db = await supabaseForSharedLinks();
  if (db) {
    await db.from("shared_links").update({ revoked: true }).eq("id", id).eq("owner_id", ownerId);
  }
  return true;
}

export async function setSharedLinkEnabled(
  ownerId: user_id_string,
  id: SharedLinkId,
  enabled: boolean,
): Promise<SharedLinkRecord | null> {
  const link = await getSharedLink(id);
  if (!link || link.ownerId !== ownerId) return null;

  link.enabled = enabled;
  saveLocalLink(link);

  const db = await supabaseForSharedLinks();
  if (db) {
    await db.from("shared_links").update({ enabled }).eq("id", id).eq("owner_id", ownerId);
  }
  return toPublicRecord(link);
}

export async function updateSharedLinkSpendLimit(
  ownerId: user_id_string,
  id: SharedLinkId,
  spendLimitCents: number | null,
): Promise<SharedLinkRecord | null> {
  const link = await getSharedLink(id);
  if (!link || link.ownerId !== ownerId) return null;

  const normalized =
    spendLimitCents == null ? undefined : toExactSpendCents(spendLimitCents);
  if (normalized != null && normalized < link.totalSpendCents) {
    throw new SharedLinkSpendLimitTooLowError(link.totalSpendCents);
  }

  link.spendLimitCents = normalized;
  saveLocalLink(link);

  const db = await supabaseForSharedLinks();
  if (db) {
    await db
      .from("shared_links")
      .update({ spend_limit_cents: normalized ?? null })
      .eq("id", id)
      .eq("owner_id", ownerId);
  }
  return toPublicRecord(link);
}

// AI : Embed allowlist / chrome updates — only for emb_ deployments.
export async function updateSharedLinkEmbedSettings(
  ownerId: user_id_string,
  id: SharedLinkId,
  patch: { allowedOrigins?: string[]; embedOptions?: Partial<EmbedOptions> },
): Promise<SharedLinkRecord | null> {
  const link = await getSharedLink(id);
  if (!link || link.ownerId !== ownerId) return null;
  if (!isEmbedLinkId(link.id) && (link.allowedOrigins?.length ?? 0) === 0) {
    throw new Error("Only Embed deployments support origin / chrome settings");
  }
  if (patch.allowedOrigins !== undefined) {
    const next = normalizeEmbedOrigins(patch.allowedOrigins);
    if (next.length === 0) throw new Error("Embed requires at least one allowed origin");
    link.allowedOrigins = next;
  }
  if (patch.embedOptions !== undefined) {
    link.embedOptions = normalizeEmbedOptions({ ...link.embedOptions, ...patch.embedOptions });
  }
  saveLocalLink(link);
  const db = await supabaseForSharedLinks();
  if (db) {
    await db
      .from("shared_links")
      .update({
        allowed_origins: link.allowedOrigins,
        embed_options: link.embedOptions,
      })
      .eq("id", id)
      .eq("owner_id", ownerId);
  }
  return toPublicRecord(link);
}

// AI : public usage markdown — baked in at publish/PATCH so live project Docs never leak.
export async function updateSharedLinkViewerMarkdown(
  ownerId: user_id_string,
  id: SharedLinkId,
  viewerMarkdown: string,
): Promise<SharedLinkRecord | null> {
  const link = await getSharedLink(id);
  if (!link || link.ownerId !== ownerId) return null;
  link.viewerMarkdown = normalizeViewerMarkdown(viewerMarkdown);
  saveLocalLink(link);
  const db = await supabaseForSharedLinks();
  if (db) {
    const { error } = await db
      .from("shared_links")
      .update({ viewer_markdown: link.viewerMarkdown })
      .eq("id", id)
      .eq("owner_id", ownerId);
    if (error) {
      // AI : local pre-migration can keep JSON; serverless GET is Supabase-only so missing column must fail.
      if (isServerless() || (!isMissingSchemaError(error) && !/viewer_markdown/i.test(error.message))) {
        throw new Error(error.message);
      }
    }
  }
  return toPublicRecord(link);
}

// AI : Hosted HTML wrapper updates — only for site_ deployments.
export async function updateSharedLinkSiteSettings(
  ownerId: user_id_string,
  id: SharedLinkId,
  siteOptions: unknown,
): Promise<SharedLinkRecord | null> {
  const link = await getSharedLink(id);
  if (!link || link.ownerId !== ownerId) return null;
  if (!isSiteLinkId(link.id)) {
    throw new Error("Only hosted pages support HTML / brand settings");
  }
  const patch = (siteOptions && typeof siteOptions === "object" ? siteOptions : {}) as Partial<HostedSiteOptions> & {
    brand?: Partial<HostedSiteBrand>
  }
  const next = normalizeHostedSiteOptions({
    ...link.siteOptions,
    ...patch,
    brand: { ...link.siteOptions.brand, ...patch.brand },
  });
  if (!next.brand.companyName.trim()) {
    throw new Error("Hosted page requires a company name");
  }
  link.siteOptions = next;
  saveLocalLink(link);
  const db = await supabaseForSharedLinks();
  if (db) {
    const { error } = await persistOmittingUnknownColumns(
      (payload) => db.from("shared_links").update(payload).eq("id", id).eq("owner_id", ownerId),
      { site_options: link.siteOptions, snapshot: persistSnapshot(link) },
    );
    if (error) {
      if (isServerless() || (!isMissingSchemaError(error) && !/site_options/i.test(error.message ?? ""))) {
        throw new Error(error.message);
      }
    }
  }
  return toPublicRecord(link);
}

export async function persistWebsitePipelineChange(
  ownerId: user_id_string,
  id: SharedLinkId,
  patch: { siteOptions: HostedSiteOptions; projectId: ProjectId | null },
): Promise<SharedLinkRecord | null> {
  const link = await getSharedLink(id);
  if (!link || link.ownerId !== ownerId) return null;
  if (!isSiteLinkId(link.id)) return null;
  link.siteOptions = normalizeHostedSiteOptions(patch.siteOptions);
  link.projectId = patch.projectId;
  saveLocalLink(link);
  const db = await supabaseForSharedLinks();
  if (db) {
    const row: Record<string, unknown> = {
      site_options: link.siteOptions,
      project_id: link.projectId,
      snapshot: persistSnapshot(link),
    };
    let { error } = await persistOmittingUnknownColumns(
      (payload) => db.from("shared_links").update(payload).eq("id", id).eq("owner_id", ownerId),
      row,
    );
    if (error && /null|not-null|project_id/i.test(error.message ?? "") && link.projectId == null) {
      ({ error } = await persistOmittingUnknownColumns(
        (payload) => db.from("shared_links").update(payload).eq("id", id).eq("owner_id", ownerId),
        { ...row, project_id: "" },
      ));
    }
    if (error) {
      if (isServerless() || (!isMissingSchemaError(error) && !/site_options|project_id/i.test(error.message ?? ""))) {
        throw new Error(error.message);
      }
    }
  }
  return toPublicRecord(link);
}

export async function incrementSharedLinkRunCount(id: SharedLinkId): Promise<void> {
  const link = loadLocalLink(id);
  if (link) {
    link.runCount += 1;
    saveLocalLink(link);
  }
  const admin = await createAdminClient();
  if (admin) {
    const { data } = await admin.from("shared_links").select("run_count").eq("id", id).maybeSingle();
    if (data) {
      await admin.from("shared_links").update({ run_count: (data.run_count ?? 0) + 1 }).eq("id", id);
    }
  }
}

export { PUBLIC_RUN_SPEND_RESERVE_CENTS as SHARED_LINK_RUN_RESERVE_CENTS };

function reserveLocalSharedLinkSpend(id: SharedLinkId, cents: number): boolean {
  const link = loadLocalLink(id);
  if (!link || link.revoked) return false;
  const next = toExactSpendCents((link.totalSpendCents ?? 0) + cents);
  if (link.spendLimitCents != null && next > link.spendLimitCents) return false;
  link.totalSpendCents = next;
  saveLocalLink(link);
  return true;
}

function adjustLocalSharedLinkSpend(id: SharedLinkId, deltaCents: number): boolean {
  const link = loadLocalLink(id);
  if (!link || link.revoked) return false;
  const next = toExactSpendCents(Math.max(0, (link.totalSpendCents ?? 0) + deltaCents));
  if (link.spendLimitCents != null && next > link.spendLimitCents) return false;
  link.totalSpendCents = next;
  saveLocalLink(link);
  return true;
}

export async function reserveSharedLinkSpend(id: SharedLinkId, cents: number): Promise<boolean> {
  const reserved = toExactSpendCents(cents);
  if (reserved <= 0) return true;
  if (reserveLocalSharedLinkSpend(id, reserved)) return true;
  const admin = await createAdminClient();
  if (!admin) return false;
  const { data, error } = await admin.rpc("try_reserve_shared_link_spend", {
    p_link_id: id,
    p_cents: reserved,
  });
  if (error) {
    linkLog.warn(`try_reserve_shared_link_spend failed`, { id, error: error.message });
    return false;
  }
  return Boolean(data);
}

export async function adjustSharedLinkSpend(id: SharedLinkId, deltaCents: number): Promise<boolean> {
  const delta = toExactSpendCents(deltaCents);
  if (delta === 0) return true;
  if (adjustLocalSharedLinkSpend(id, delta)) return true;
  const admin = await createAdminClient();
  if (!admin) return false;
  const { data, error } = await admin.rpc("adjust_shared_link_spend", {
    p_link_id: id,
    p_delta_cents: delta,
  });
  if (error) {
    linkLog.warn(`adjust_shared_link_spend failed`, { id, error: error.message });
    return false;
  }
  return Boolean(data);
}

export async function recordSharedLinkSpend(id: SharedLinkId, cents: number): Promise<void> {
  const billed = toExactSpendCents(cents);
  if (billed <= 0) return;

  const link = loadLocalLink(id);
  if (link) {
    link.totalSpendCents = toExactSpendCents((link.totalSpendCents ?? 0) + billed);
    saveLocalLink(link);
  }

  const admin = await createAdminClient();
  if (!admin) return;
  const { data } = await admin
    .from("shared_links")
    .select("total_spend_cents")
    .eq("id", id)
    .maybeSingle();
  if (!data) return;
  await admin
    .from("shared_links")
    .update({ total_spend_cents: toExactSpendCents(Number(data.total_spend_cents ?? 0) + billed) })
    .eq("id", id);
}

export async function openStoreForUser(userId: user_id_string): Promise<Store> {
  if (userId === LOCAL_DEV_USER_ID && isLocalDevMode()) {
    const { openStore, ensureSeeded } = await import("./store");
    const store = await openStore();
    await ensureSeeded(store);
    return store;
  }
  const admin = await createAdminClient();
  if (!admin) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY required for cross-user store access");
  }
  const { SupabaseStore } = await import("./supabase_store");
  const scoped = new SupabaseStore(admin, userId);
  await scoped.init();
  return scoped;
}

// AI : strip prompts and custom code — public viewers only need input/output metadata.
function sanitizeModuleForPublic(m: PipelineModule): PipelineModule {
  const { prompt: _p, code: _c, fallbackList: _f, ...safe } = m;
  return safe;
}

export function publicLinkView(link: StoredSharedLink) {
  return {
    id: link.id,
    name: link.name,
    description: link.description,
    viewerMarkdown: normalizeViewerMarkdown(link.viewerMarkdown),
    defaultModel: link.defaultModel,
    fundingMode: link.fundingMode,
    viewerNameRequired: link.viewerNameRequired,
    billingMultiple: link.billingMultiple,
    flatFeeCents: link.flatFeeCents,
    defaultDocs: link.defaultDocs.map((d) => ({ moduleId: d.moduleId, filename: d.filename })),
    modules: link.snapshot.modules.map(sanitizeModuleForPublic),
    models: link.snapshot.models,
    spendLimitReached: sharedLinkSpendLimitReached(link),
    disabled: link.enabled === false,
    // AI : SECURITY — omit allowlist from public GET so attackers cannot copy origins for Referer spoof mint.
    allowedOrigins: [],
    embedOptions: normalizeEmbedOptions(link.embedOptions),
    siteOptions: normalizeHostedSiteOptions(link.siteOptions),
  };
}

export async function snapshotForWebsiteAlias(
  link: StoredSharedLink,
  alias: string | undefined,
  sharerStore?: Store,
  functionId?: string,
): Promise<Project> {
  const bindings = resolveWebsitePipelineBindings(
    link.projectId,
    normalizeHostedSiteOptions(link.siteOptions).pipelineBindings,
  )
  const want = (alias ?? "").trim()
  const bound = want
    ? bindings.find((b) => b.alias === want)
    : bindings.find((b) => b.alias === DEFAULT_WEBSITE_PIPELINE_ALIAS) ?? bindings[0]
  let project = link.snapshot
  if (bound && bound.projectId && bound.projectId !== link.projectId) {
    const store = sharerStore ?? (await openStoreForUser(link.ownerId))
    const loaded = store.project(bound.projectId)
    if (loaded) project = migrateProjectModules(loaded)
  }
  const fnId = functionId ?? bound?.functionId
  return projectForFunction(project, fnId) ?? project
}

export async function publicLinkViewForAlias(link: StoredSharedLink, alias?: string, functionId?: string) {
  const snapshot = await snapshotForWebsiteAlias(link, alias, undefined, functionId)
  const view = publicLinkView(link)
  if (snapshot === link.snapshot && !functionId && !alias) return view
  return {
    ...view,
    name: snapshot.name,
    modules: snapshot.modules.map(sanitizeModuleForPublic),
    models: snapshot.models,
    defaultDocs: snapshot === link.snapshot ? view.defaultDocs : ([] as typeof view.defaultDocs),
  }
}

export function sessionTokenHash(sessionId: string, linkId: SharedLinkId): string {
  return createHash("sha256").update(`${linkId}:${sessionId}`).digest("hex").slice(0, 32);
}
