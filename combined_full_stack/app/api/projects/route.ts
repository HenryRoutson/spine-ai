import { NextResponse, type NextRequest } from "next/server";
import { uid } from "@/lib/id";
import { apiError, requireAuthStore, storeAuthError } from "@/lib/server/api_context";
import { createProjectBodySchema, parseRequestJson } from "@/lib/server/api_schemas";
import { HTTP, unknownProject } from "@/lib/server/api-errors";
import { allProjectSeeds, blankProject, cloneProject, type ProjectSeed } from "@/lib/server/seed";
import { ensureBundledSeedDocsForProject, ensureSeedDocs, type Store } from "@/lib/server/store";
import { publishSharedLink } from "@/lib/server/shared_links";
import { migrateProjectModules } from "@/lib/server/validity";
import { logger } from "@/lib/server/server_logger";
import type { AuthSession } from "@/lib/server/require_auth";
import { ModuleKind, type DocId, type ModuleId, type Project, type ProjectId } from "@/lib/server/types";

const apiLog = logger("api:projects");

function defaultDocsForHostedSite(
  project: Project,
  store: Store,
  seed: ProjectSeed,
): Partial<Record<ModuleId, DocId[]>> {
  const seedNames = new Set(seed.docSpecs.map((d) => d.name));
  const out: Partial<Record<ModuleId, DocId[]>> = {};
  for (const m of project.modules) {
    if (m.kind !== ModuleKind.Input) continue;
    const hint = m.inputNameContains?.trim();
    const docs = store.docs().filter((d) => (hint ? d.name.includes(hint) : seedNames.has(d.name)));
    if (docs.length) out[m.id] = docs.map((d) => d.id);
  }
  return out;
}

async function maybePublishHostedSite(opts: {
  auth: AuthSession;
  store: Store;
  project: Project;
  templateId: string;
}): Promise<void> {
  const seed = allProjectSeeds().find((s) => s.project.id === (opts.templateId as ProjectId));
  if (!seed?.hostedSite) return;
  await publishSharedLink({
    ownerId: opts.auth.userId,
    project: opts.project,
    defaultDocsByModule: defaultDocsForHostedSite(opts.project, opts.store, seed),
    store: opts.store,
    kind: "site",
    siteOptions: seed.hostedSite,
  });
}

// AI : blank project, numbered clone of a template, or numbered clone of an existing project.
export async function POST(req: NextRequest) {
  const ctx = await requireAuthStore("write");
  if (ctx instanceof NextResponse) return ctx;
  const { store, auth } = ctx;

  const body = await parseRequestJson(req, createProjectBodySchema, {});
  if ("validationError" in body) return apiError(body.validationError, HTTP.BAD_REQUEST);
  const existing = store.projects();

  let project;
  if (body.templateId) {
    const seed = allProjectSeeds().find((s) => s.project.id === (body.templateId as ProjectId));
    if (!seed) return apiError(`unknown template ${body.templateId}`, 404);
    project = migrateProjectModules(cloneProject(seed.project, existing));
    apiLog.info(`POST /api/projects — clone template`, { templateId: body.templateId, projectId: project.id });
  } else if (body.cloneFrom) {
    const source = store.project(body.cloneFrom as ProjectId);
    if (!source) return apiError(unknownProject(body.cloneFrom), HTTP.NOT_FOUND);
    project = migrateProjectModules(cloneProject(source, existing));
    apiLog.info(`POST /api/projects — clone project`, { cloneFrom: body.cloneFrom, projectId: project.id });
  } else {
    project = migrateProjectModules(blankProject(uid<ProjectId>("p_")));
    apiLog.info(`POST /api/projects — blank project`, { projectId: project.id });
  }

  try {
    if (body.templateId) {
      await ensureSeedDocs(store);
      await ensureBundledSeedDocsForProject(store, project);
    }
    store.saveProject(project);
    await store.flush();
  } catch (err) {
    return storeAuthError(err);
  }
  // AI : hosted SQL demos mint a public site_ link so the cloned app is immediately shareable.
  if (body.templateId) {
    try {
      await maybePublishHostedSite({ auth, store, project, templateId: body.templateId });
    } catch (err) {
      apiLog.warn("hosted site auto-publish failed", { projectId: project.id, err: String(err) });
    }
  }
  return NextResponse.json(migrateProjectModules(project));
}
