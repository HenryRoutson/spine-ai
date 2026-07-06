// AI : Hosted API CRUD — programmatic pipeline runs via bearer key.
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PUBLIC_RUN_SPEND_RESERVE_CENTS } from "@/lib/billing_config";
import { uid } from "@/lib/id";
import type { HostedApiRecord } from "@/lib/hosted-api-types";
import { getSupabasePublicEnv } from "@/utils/supabase/env";
import { createClient } from "@/utils/supabase/server";
import { dataDir } from "./config";
import { createAdminClient } from "./supabase_admin";
import { hashContent, type Store } from "./store";
import { migrateProjectModules } from "./validity";
import { isMissingSchemaError } from "./supabase_store";
import { isLocalDevMode, LOCAL_DEV_USER_ID, type user_id_string } from "./require_auth";
import {
  assertValidBillablePricing,
  billingMultipleFromLegacyMarkupBps,
  normalizeBillingMultiple,
  normalizeFlatFeeCents,
} from "@/lib/server/billable_pricing";
import { callerFundsHostedApi } from "@/lib/server/hosted_api_billing";
import {
  DocLabel,
  InputType,
  type DocId,
  type DocRef,
  type HostedApiId,
  type ModelId,
  type ModuleId,
  type PipelineModule,
  type Project,
  type ProjectId,
  HostedApiFundingMode,
} from "./types";
import { logger } from "./server_logger";
import type { SharedLinkDefaultDoc } from "@/lib/shared-link-types";
import type { InputDocsAssignment } from "@/lib/inference-input";
import { docsForInputModule } from "@/lib/inference-input";

export type { HostedApiRecord };

export class HostedApiSpendLimitError extends Error {
  constructor() {
    super("This API has reached its spending limit.");
  }
}

export class HostedApiAuthError extends Error {
  constructor() {
    super("Invalid API key.");
  }
}

export function hostedApiSpendLimitReached(
  api: Pick<HostedApiRecord, "spendLimitCents" | "totalSpendCents">,
): boolean {
  if (api.spendLimitCents == null) return false;
  return api.totalSpendCents >= api.spendLimitCents;
}

export function assertHostedApiCanAcceptRun(
  api: Pick<HostedApiRecord, "spendLimitCents" | "totalSpendCents">,
): void {
  if (hostedApiSpendLimitReached(api)) throw new HostedApiSpendLimitError();
}

function toExactSpendCents(cents: number): number {
  return +Math.max(0, cents).toFixed(4);
}

const apiLog = logger("hosted-apis");
const HOSTED_API_PREFIX = "api_";

function isServerless(): boolean {
  return !!process.env.VERCEL;
}

async function supabaseForHostedApis(): Promise<SupabaseClient | null> {
  const admin = await createAdminClient();
  if (admin) return admin;
  if (!getSupabasePublicEnv()) return null;
  return createClient();
}

type StoredHostedApi = HostedApiRecord & {
  ownerId: user_id_string;
  snapshot: Project;
  apiKeyHash: string;
};

function apisDir(): string {
  return join(dataDir(), "hosted_apis");
}

function apiFile(id: HostedApiId): string {
  return join(apisDir(), `${id}.json`);
}

function defaultDocsDir(apiId: HostedApiId): string {
  return join(apisDir(), "docs", apiId, "defaults");
}

function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateHostedApiKey(): { key: string; prefix: string; hash: string } {
  const raw = randomBytes(24).toString("base64url");
  const key = `spine_sk_${raw}`;
  return { key, prefix: key.slice(0, 16), hash: hashApiKey(key) };
}

export function newHostedApiId(): HostedApiId {
  return uid<HostedApiId>(HOSTED_API_PREFIX);
}

function loadLocalApi(id: HostedApiId): StoredHostedApi | null {
  const path = apiFile(id);
  if (!existsSync(path)) return null;
  const row = JSON.parse(readFileSync(path, "utf8")) as StoredHostedApi;
  return {
    ...row,
    totalSpendCents: row.totalSpendCents ?? 0,
    requestCount: row.requestCount ?? 0,
    fundingMode: (row.fundingMode as HostedApiFundingMode) ?? HostedApiFundingMode.OwnerPays,
    billingMultiple: normalizeBillingMultiple(
      row.billingMultiple ??
        billingMultipleFromLegacyMarkupBps(
          (row as { markupBps?: number }).markupBps,
        ),
    ),
    flatFeeCents: normalizeFlatFeeCents(
      row.flatFeeCents ?? (row as { markupFixedCents?: number }).markupFixedCents ?? 0,
    ),
  };
}

function saveLocalApi(row: StoredHostedApi): void {
  mkdirSync(apisDir(), { recursive: true });
  writeFileSync(apiFile(row.id), JSON.stringify(row, null, 2));
}

async function loadSupabaseApi(id: HostedApiId): Promise<StoredHostedApi | null> {
  const db = await createAdminClient();
  if (!db) {
    if (isServerless()) return null;
    return loadLocalApi(id);
  }
  const { data, error } = await db
    .from("hosted_apis")
    .select("*")
    .eq("id", id)
    .eq("revoked", false)
    .maybeSingle();
  if (error || !data) return null;
  return rowFromDb(data);
}

function rowFromDb(data: Record<string, unknown>): StoredHostedApi {
  return {
    id: data.id as HostedApiId,
    ownerId: data.owner_id as user_id_string,
    projectId: data.project_id as ProjectId,
    name: (data.snapshot as Project).name,
    snapshot: migrateProjectModules(data.snapshot as Project),
    defaultModel: (data.default_model as ModelId | null) ?? undefined,
    defaultDocs: (data.default_docs ?? []) as SharedLinkDefaultDoc[],
    apiKeyHash: data.api_key_hash as string,
    apiKeyPrefix: data.api_key_prefix as string,
    fundingMode: (data.funding_mode as HostedApiFundingMode) ?? HostedApiFundingMode.OwnerPays,
    billingMultiple: normalizeBillingMultiple(
      data.billing_multiple != null
        ? Number(data.billing_multiple)
        : billingMultipleFromLegacyMarkupBps(Number(data.markup_bps ?? 0)),
    ),
    flatFeeCents: normalizeFlatFeeCents(Number(data.markup_fixed_cents ?? 0)),
    spendLimitCents: data.spend_limit_cents != null ? Number(data.spend_limit_cents) : undefined,
    totalSpendCents: Number(data.total_spend_cents ?? 0),
    requestCount: Number(data.request_count ?? 0),
    createdAt: Number(data.created_at),
    revoked: Boolean(data.revoked),
  };
}

export async function getHostedApi(id: HostedApiId): Promise<StoredHostedApi | null> {
  if (isServerless()) return loadSupabaseApi(id);
  const local = loadLocalApi(id);
  if (local && !local.revoked) return local;
  return loadSupabaseApi(id);
}

export async function verifyHostedApiKey(id: HostedApiId, key: string): Promise<StoredHostedApi> {
  const api = await getHostedApi(id);
  if (!api) throw new HostedApiAuthError();
  if (hashApiKey(key) !== api.apiKeyHash) throw new HostedApiAuthError();
  return api;
}

function listLocalApisForOwner(ownerId: user_id_string): HostedApiRecord[] {
  if (!existsSync(apisDir())) return [];
  return readdirSync(apisDir())
    .filter((f) => f.endsWith(".json"))
    .map((f) => loadLocalApi(f.replace(".json", "") as HostedApiId))
    .filter((r): r is StoredHostedApi => r != null && r.ownerId === ownerId)
    .map(toPublicRecord);
}

export async function listHostedApisForOwner(ownerId: user_id_string): Promise<HostedApiRecord[]> {
  const db = await supabaseForHostedApis();
  if (!db) return listLocalApisForOwner(ownerId);
  const { data, error } = await db.from("hosted_apis").select("*").eq("owner_id", ownerId);
  if (error) {
    if (isMissingSchemaError(error)) return listLocalApisForOwner(ownerId);
    throw error;
  }
  return (data ?? []).map((row) => toPublicRecord(rowFromDb(row)));
}

function toPublicRecord(row: StoredHostedApi): HostedApiRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    defaultModel: row.defaultModel,
    defaultDocs: row.defaultDocs,
    apiKeyPrefix: row.apiKeyPrefix,
    fundingMode: row.fundingMode,
    billingMultiple: row.billingMultiple,
    flatFeeCents: row.flatFeeCents,
    spendLimitCents: row.spendLimitCents,
    totalSpendCents: row.totalSpendCents,
    requestCount: row.requestCount,
    createdAt: row.createdAt,
    revoked: row.revoked,
  };
}

export type PublishHostedApiInput = {
  ownerId: user_id_string;
  project: Project;
  defaultModel?: ModelId;
  fundingMode?: HostedApiFundingMode;
  billingMultiple?: number;
  flatFeeCents?: number;
  spendLimitCents?: number;
  defaultDocsByModule: Partial<Record<ModuleId, DocId[]>>;
  store: Store;
};

export type PublishHostedApiResult = HostedApiRecord & { apiKey: string };

export async function publishHostedApi(input: PublishHostedApiInput): Promise<PublishHostedApiResult> {
  const id = newHostedApiId();
  const fundingMode = input.fundingMode ?? HostedApiFundingMode.OwnerPays;
  const billingMultiple = normalizeBillingMultiple(input.billingMultiple);
  const flatFeeCents = normalizeFlatFeeCents(input.flatFeeCents);
  assertValidBillablePricing(callerFundsHostedApi(fundingMode), billingMultiple, flatFeeCents, "API pricing");

  const { key, prefix, hash } = generateHostedApiKey();
  const snapshot = migrateProjectModules(structuredClone(input.project));
  const defaultDocs: SharedLinkDefaultDoc[] = [];
  mkdirSync(defaultDocsDir(id), { recursive: true });

  for (const [moduleId, docIds] of Object.entries(input.defaultDocsByModule)) {
    for (const docId of docIds ?? []) {
      const doc = input.store.docs().find((d) => d.id === docId);
      const content = input.store.docContent(docId);
      if (!doc || content === undefined) continue;
      const storageKey = `${moduleId}_${doc.name}`;
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
      defaultDocs.push({
        moduleId: moduleId as ModuleId,
        filename: doc.name,
        docId,
        content,
        type: doc.type,
      });
    }
  }

  const row: StoredHostedApi = {
    id,
    ownerId: input.ownerId,
    projectId: input.project.id,
    name: snapshot.name,
    snapshot,
    defaultModel: input.defaultModel,
    defaultDocs,
    apiKeyHash: hash,
    apiKeyPrefix: prefix,
    fundingMode,
    billingMultiple,
    flatFeeCents,
    spendLimitCents:
      input.spendLimitCents != null ? toExactSpendCents(input.spendLimitCents) : undefined,
    totalSpendCents: 0,
    requestCount: 0,
    createdAt: Date.now(),
    revoked: false,
  };

  if (!isServerless()) saveLocalApi(row);
  const db = await supabaseForHostedApis();
  if (!db) {
    if (isServerless()) throw new Error("Supabase env required to publish hosted APIs in production");
    saveLocalApi(row);
    return { ...toPublicRecord(row), apiKey: key };
  }
  const { error } = await db.from("hosted_apis").upsert({
    id: row.id,
    owner_id: row.ownerId,
    project_id: row.projectId,
    snapshot: row.snapshot,
    default_docs: row.defaultDocs,
    default_model: row.defaultModel ?? null,
    api_key_hash: row.apiKeyHash,
    api_key_prefix: row.apiKeyPrefix,
    funding_mode: row.fundingMode,
    billing_multiple: row.billingMultiple,
    markup_fixed_cents: row.flatFeeCents,
    markup_bps: 0,
    spend_limit_cents: row.spendLimitCents ?? null,
    total_spend_cents: row.totalSpendCents,
    request_count: 0,
    revoked: false,
    created_at: row.createdAt,
  });
  if (error) {
    if (isServerless() || !isMissingSchemaError(error)) {
      throw new Error(`hosted API persistence failed: ${error.message}`);
    }
    apiLog.warn(`supabase upsert failed — saved locally`, { error: error.message });
    saveLocalApi(row);
  }
  return { ...toPublicRecord(row), apiKey: key };
}

export async function revokeHostedApi(ownerId: user_id_string, id: HostedApiId): Promise<boolean> {
  const api = await getHostedApi(id);
  if (!api || api.ownerId !== ownerId) return false;
  api.revoked = true;
  saveLocalApi(api);
  const db = await supabaseForHostedApis();
  if (db) {
    await db.from("hosted_apis").update({ revoked: true }).eq("id", id).eq("owner_id", ownerId);
  }
  return true;
}

export async function incrementHostedApiRequestCount(id: HostedApiId): Promise<void> {
  const api = loadLocalApi(id);
  if (api) {
    api.requestCount += 1;
    saveLocalApi(api);
  }
  const admin = await createAdminClient();
  if (!admin) return;
  const { data } = await admin.from("hosted_apis").select("request_count").eq("id", id).maybeSingle();
  if (!data) return;
  await admin
    .from("hosted_apis")
    .update({ request_count: (data.request_count ?? 0) + 1 })
    .eq("id", id);
}

export { PUBLIC_RUN_SPEND_RESERVE_CENTS as HOSTED_API_RUN_RESERVE_CENTS };

function reserveLocalHostedApiSpend(id: HostedApiId, cents: number): boolean {
  const api = loadLocalApi(id);
  if (!api || api.revoked) return false;
  const next = toExactSpendCents((api.totalSpendCents ?? 0) + cents);
  if (api.spendLimitCents != null && next > api.spendLimitCents) return false;
  api.totalSpendCents = next;
  saveLocalApi(api);
  return true;
}

function adjustLocalHostedApiSpend(id: HostedApiId, deltaCents: number): boolean {
  const api = loadLocalApi(id);
  if (!api || api.revoked) return false;
  const next = toExactSpendCents(Math.max(0, (api.totalSpendCents ?? 0) + deltaCents));
  if (api.spendLimitCents != null && next > api.spendLimitCents) return false;
  api.totalSpendCents = next;
  saveLocalApi(api);
  return true;
}

export async function reserveHostedApiSpend(id: HostedApiId, cents: number): Promise<boolean> {
  const reserved = toExactSpendCents(cents);
  if (reserved <= 0) return true;
  if (reserveLocalHostedApiSpend(id, reserved)) return true;
  const admin = await createAdminClient();
  if (!admin) return false;
  const { data, error } = await admin.rpc("try_reserve_hosted_api_spend", {
    p_api_id: id,
    p_cents: reserved,
  });
  if (error) {
    apiLog.warn(`try_reserve_hosted_api_spend failed`, { id, error: error.message });
    return false;
  }
  return Boolean(data);
}

export async function adjustHostedApiSpend(id: HostedApiId, deltaCents: number): Promise<boolean> {
  const delta = toExactSpendCents(deltaCents);
  if (delta === 0) return true;
  if (adjustLocalHostedApiSpend(id, delta)) return true;
  const admin = await createAdminClient();
  if (!admin) return false;
  const { data, error } = await admin.rpc("adjust_hosted_api_spend", {
    p_api_id: id,
    p_delta_cents: delta,
  });
  if (error) {
    apiLog.warn(`adjust_hosted_api_spend failed`, { id, error: error.message });
    return false;
  }
  return Boolean(data);
}

export async function recordHostedApiSpend(id: HostedApiId, cents: number): Promise<void> {
  const billed = toExactSpendCents(cents);
  if (billed <= 0) return;

  const api = loadLocalApi(id);
  if (api) {
    api.totalSpendCents = toExactSpendCents((api.totalSpendCents ?? 0) + billed);
    saveLocalApi(api);
  }

  const admin = await createAdminClient();
  if (!admin) return;
  const { data } = await admin.from("hosted_apis").select("total_spend_cents").eq("id", id).maybeSingle();
  if (!data) return;
  await admin
    .from("hosted_apis")
    .update({ total_spend_cents: toExactSpendCents(Number(data.total_spend_cents ?? 0) + billed) })
    .eq("id", id);
}

function defaultDocId(apiId: HostedApiId, moduleId: ModuleId, filename: string): DocId {
  return hashContent(`hosted_default:${apiId}:${moduleId}:${filename}`);
}

function loadHostedDefaultDocContent(
  apiId: HostedApiId,
  moduleId: ModuleId,
  filename: string,
  inlineDocs?: SharedLinkDefaultDoc[],
): { content: string; type: InputType; name: string } | null {
  const fromInline = inlineDocs?.find((d) => d.moduleId === moduleId && d.filename === filename);
  if (fromInline?.content != null) {
    return {
      content: fromInline.content,
      type: fromInline.type ?? InputType.Text,
      name: filename,
    };
  }
  const storageKey = `${moduleId}_${filename}`;
  const path = join(defaultDocsDir(apiId), storageKey);
  if (!existsSync(path)) return null;
  const metaPath = `${path}.meta.json`;
  const type = existsSync(metaPath)
    ? ((JSON.parse(readFileSync(metaPath, "utf8")) as { type?: InputType }).type ?? InputType.Text)
    : InputType.Text;
  return { content: readFileSync(path, "utf8"), type, name: filename };
}

export type HostedApiInlineInput = {
  filename: string;
  content: string;
  type?: InputType;
};

export function resolveHostedApiAssignment(
  apiId: HostedApiId,
  api: StoredHostedApi,
  inputModules: PipelineModule[],
  inlineByModule?: Partial<Record<ModuleId, HostedApiInlineInput[]>>,
): { assignment: InputDocsAssignment; contentByDocId: Record<string, string> } {
  const assignment: InputDocsAssignment = {};
  const contentByDocId: Record<string, string> = {};

  for (const m of inputModules) {
    const inline = inlineByModule?.[m.id] ?? [];
    const docs: DocRef[] = [];

    if (inline.length) {
      for (const file of inline) {
        const id = hashContent(`hosted_inline:${apiId}:${m.id}:${file.filename}:${file.content.length}`);
        const type = file.type ?? InputType.Text;
        docs.push({
          id,
          name: file.filename,
          type,
          label: DocLabel.Inference,
          sizeKb: Math.max(1, Math.round(file.content.length / 1024)),
          uploadedAt: Date.now(),
          preview: file.content.slice(0, 180),
        });
        contentByDocId[id] = file.content;
      }
    } else {
      const def = api.defaultDocs.find((d) => d.moduleId === m.id);
      if (def) {
        const loaded = loadHostedDefaultDocContent(apiId, m.id, def.filename, api.defaultDocs);
        if (loaded) {
          const id = defaultDocId(apiId, m.id, def.filename);
          docs.push({
            id,
            name: loaded.name,
            type: loaded.type,
            label: DocLabel.Inference,
            sizeKb: Math.max(1, Math.round(loaded.content.length / 1024)),
            uploadedAt: Date.now(),
            preview: loaded.content.slice(0, 180),
          });
          contentByDocId[id] = loaded.content;
        }
      }
    }
    if (docs.length) assignment[m.id] = docs;
  }
  return { assignment, contentByDocId };
}

// AI : in-memory doc overlay for hosted API runs — no session cookies.
export function overlayStoreForHostedRun(
  base: Store,
  assignment: InputDocsAssignment,
  contentByDocId: Record<string, string>,
): Store {
  const extraDocs = new Map<DocId, DocRef>();
  const extraContent = new Map<DocId, string>();

  for (const moduleId of Object.keys(assignment) as ModuleId[]) {
    for (const doc of docsForInputModule(assignment, moduleId)) {
      const content = contentByDocId[doc.id];
      if (content === undefined) continue;
      extraDocs.set(doc.id, doc);
      extraContent.set(doc.id, content);
    }
  }

  return {
    projects: () => base.projects(),
    project: (id) => base.project(id),
    saveProject: (p) => base.saveProject(p),
    deleteProject: (id) => base.deleteProject(id),
    docs: () => [...extraDocs.values(), ...base.docs()],
    docContent: (id) => extraContent.get(id) ?? base.docContent(id),
    parserCacheGetByFileHash: (h, p) => base.parserCacheGetByFileHash(h, p),
    parserCacheGetByDoc: (id) => base.parserCacheGetByDoc(id),
    parserCacheSet: (row) => base.parserCacheSet(row),
    visionCacheGet: (key) => base.visionCacheGet(key),
    visionCacheSet: (row) => base.visionCacheSet(row),
    visionCachesForDoc: (id) => base.visionCachesForDoc(id),
    addDoc: (name, type, content, label) => {
      const id = hashContent(content);
      const doc: DocRef = {
        id,
        name,
        type,
        label,
        sizeKb: Math.max(1, Math.round(content.length / 1024)),
        uploadedAt: Date.now(),
        preview: content.slice(0, 180),
      };
      extraDocs.set(id, doc);
      extraContent.set(id, content);
      return doc;
    },
    repointDocName: (id, name) => {
      const extra = extraDocs.get(id);
      if (extra) {
        extraDocs.set(id, { ...extra, name });
        return true;
      }
      return base.repointDocName(id, name);
    },
    removeDoc: (id) => extraDocs.delete(id) || base.removeDoc(id),
    runs: (pid) => base.runs(pid),
    findRunByFingerprint: (pid, fp) => base.findRunByFingerprint(pid, fp),
    addRun: (pid, run) => base.addRun(pid, run),
    updateRunNotes: (rid, notes) => base.updateRunNotes(rid, notes),
    updateRunTest: (rid, test) => base.updateRunTest(rid, test),
    flush: () => base.flush(),
  };
}

export async function openStoreForUser(userId: user_id_string): Promise<Store> {
  if (userId === LOCAL_DEV_USER_ID && isLocalDevMode()) {
    const { openStore, ensureSeeded } = await import("./store");
    const store = await openStore();
    await ensureSeeded(store);
    return store;
  }
  const admin = await createAdminClient();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY required for cross-user store access");
  const { SupabaseStore } = await import("./supabase_store");
  const scoped = new SupabaseStore(admin, userId);
  await scoped.init();
  return scoped;
}

export function hostedApiInvokePath(id: HostedApiId): string {
  return `/api/hosted-apis/${id}/invoke`;
}

export function hostedApiProgressPath(id: HostedApiId): string {
  return `/api/hosted-apis/${id}/progress`;
}
