import { NextResponse, type NextRequest } from "next/server"
import { apiError, requireAuthStore } from "@/lib/server/api_context"
import { HTTP } from "@/lib/server/api-errors"
import {
  parseRequestJson,
  secretNameSchema,
  upsertSecretBodySchema,
  importSecretsBodySchema,
} from "@/lib/server/api_schemas"
import { secretRequirementStatusesFor } from "@/lib/server/secret_preflight"
import {
  deleteUserSecret,
  listUserSecrets,
  upsertUserSecret,
} from "@/lib/server/user_secrets"
import {
  deleteTeamSecret,
  listTeamSecretsPublic,
  upsertTeamSecret,
} from "@/lib/server/team_secrets"
import {
  logicalNameFromProjectScoped,
  projectScopedSecretName,
  projectSecretPrefix,
} from "@/lib/secret-scope"
import { logger } from "@/lib/server/server_logger"
import type { ProjectId } from "@/lib/server/types"
import type { team_id_string } from "@/lib/team-types"

const apiLog = logger("api:secrets")

export async function GET(req: NextRequest) {
  const ctx = await requireAuthStore("read")
  if (ctx instanceof NextResponse) return ctx
  const secrets = await listUserSecrets(ctx.auth.userId)
  const projectId = req.nextUrl.searchParams.get("projectId") as ProjectId | null
  const project = projectId ? ctx.store.project(projectId) : null
  const prefix = project ? projectSecretPrefix(project.name) : null
  const projectSecrets = prefix
    ? secrets.flatMap((s) => {
        const logical = logicalNameFromProjectScoped(prefix, s.name)
        return logical ? [{ ...s, name: logical, storedName: s.name, scope: "project" as const }] : []
      })
    : []
  const personalSecrets = prefix
    ? secrets
        .filter((s) => logicalNameFromProjectScoped(prefix, s.name) == null)
        .map((s) => ({ ...s, scope: "personal" as const }))
    : secrets.map((s) => ({ ...s, scope: "personal" as const }))
  const linkedSecretNames = project?.seedSecretNames ?? []
  let teamBundle: Awaited<ReturnType<typeof listTeamSecretsPublic>> | null = null
  if (project?.teamId) {
    teamBundle = await listTeamSecretsPublic(project.teamId, ctx.auth.userId)
  }
  const required = project
    ? await secretRequirementStatusesFor(project.modules, ctx.auth.userId, {
        teamId: project.teamId,
        projectName: project.name,
        projectOwnerId: project.teamProjectOwnerId,
      })
    : []
  return NextResponse.json({
    secrets: personalSecrets,
    projectSecrets,
    linkedSecretNames,
    projectPrefix: prefix,
    teamId: project?.teamId ?? null,
    teamSecrets: teamBundle?.presence ?? [],
    teamSecretRows: teamBundle?.rows ?? [],
    canEditTeamSecrets: teamBundle?.canEdit ?? false,
    required,
  })
}

export async function PUT(req: NextRequest) {
  const ctx = await requireAuthStore("write")
  if (ctx instanceof NextResponse) return ctx
  const parsed = await parseRequestJson(req, upsertSecretBodySchema)
  if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST)
  try {
    const scope = parsed.scope ?? "personal"
    if (scope === "team") {
      const teamId = (parsed.teamId ?? null) as team_id_string | null
      if (!teamId) return apiError("teamId required for team secrets", HTTP.BAD_REQUEST)
      const secret = await upsertTeamSecret(teamId, ctx.auth.userId, parsed.name, parsed.value)
      apiLog.info(`upsert team secret`, { userId: ctx.auth.userId, teamId, name: secret.name })
      return NextResponse.json({ secret, scope: "team" })
    }

    let storeName = parsed.name
    const projectId = parsed.projectId as ProjectId | undefined
    if (scope === "project") {
      if (!projectId) return apiError("projectId required for project secrets", HTTP.BAD_REQUEST)
      const project = ctx.store.project(projectId)
      if (!project) return apiError("project not found", 404)
      storeName = projectScopedSecretName(projectSecretPrefix(project.name), parsed.name)
    }

    const secret = await upsertUserSecret(ctx.auth.userId, storeName, parsed.value)

    if (scope === "personal" && parsed.linkToProject && projectId) {
      const project = ctx.store.project(projectId)
      if (project) {
        const linked = new Set(project.seedSecretNames ?? [])
        linked.add(parsed.name)
        ctx.store.saveProject({ ...project, seedSecretNames: [...linked].sort() })
      }
    }

    apiLog.info(`upsert secret`, { userId: ctx.auth.userId, name: secret.name, scope })
    return NextResponse.json({
      secret: scope === "project" ? { ...secret, name: parsed.name, storedName: secret.name } : secret,
      scope,
    })
  } catch (err) {
    return apiError((err as Error).message, HTTP.BAD_REQUEST)
  }
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireAuthStore("write")
  if (ctx instanceof NextResponse) return ctx
  const nameParsed = secretNameSchema.safeParse(req.nextUrl.searchParams.get("name") ?? "")
  if (!nameParsed.success) return apiError("name required", HTTP.BAD_REQUEST)
  const scope = req.nextUrl.searchParams.get("scope") ?? "personal"
  const projectId = req.nextUrl.searchParams.get("projectId") as ProjectId | null
  const teamId = req.nextUrl.searchParams.get("teamId") as team_id_string | null

  try {
    if (scope === "team") {
      if (!teamId) return apiError("teamId required", HTTP.BAD_REQUEST)
      const ok = await deleteTeamSecret(teamId, ctx.auth.userId, nameParsed.data)
      if (!ok) return apiError("secret not found", 404)
      return NextResponse.json({ ok: true })
    }

    let storeName = nameParsed.data
    if (scope === "project") {
      if (!projectId) return apiError("projectId required", HTTP.BAD_REQUEST)
      const project = ctx.store.project(projectId)
      if (!project) return apiError("project not found", 404)
      storeName = projectScopedSecretName(projectSecretPrefix(project.name), nameParsed.data)
    }

    const ok = await deleteUserSecret(ctx.auth.userId, storeName)
    if (!ok) return apiError("secret not found", 404)

    if (scope === "personal" && projectId) {
      const project = ctx.store.project(projectId)
      if (project?.seedSecretNames?.includes(nameParsed.data)) {
        ctx.store.saveProject({
          ...project,
          seedSecretNames: project.seedSecretNames.filter((n) => n !== nameParsed.data),
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiError((err as Error).message, HTTP.BAD_REQUEST)
  }
}

export async function POST(req: NextRequest) {
  const ctx = await requireAuthStore("write")
  if (ctx instanceof NextResponse) return ctx
  const parsed = await parseRequestJson(req, importSecretsBodySchema)
  if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST)
  const scope = parsed.scope ?? "personal"
  const projectId = parsed.projectId as ProjectId | undefined
  const teamId = (parsed.teamId ?? null) as team_id_string | null
  const imported: { name: string; scope: string }[] = []

  try {
    if (scope === "team") {
      if (!teamId) return apiError("teamId required for team secrets", HTTP.BAD_REQUEST)
      for (const entry of parsed.entries) {
        const secret = await upsertTeamSecret(teamId, ctx.auth.userId, entry.name, entry.value)
        imported.push({ name: secret.name, scope: "team" })
      }
      apiLog.info(`import team secrets`, { userId: ctx.auth.userId, teamId, count: imported.length })
      return NextResponse.json({ imported, count: imported.length })
    }

    let project = projectId ? ctx.store.project(projectId) : null
    if (scope === "project") {
      if (!projectId || !project) return apiError("projectId required for project secrets", HTTP.BAD_REQUEST)
    }

    const prefix = project ? projectSecretPrefix(project.name) : null
    const linked = new Set(project?.seedSecretNames ?? [])

    for (const entry of parsed.entries) {
      const storeName =
        scope === "project" && prefix
          ? projectScopedSecretName(prefix, entry.name)
          : entry.name
      const secret = await upsertUserSecret(ctx.auth.userId, storeName, entry.value)
      imported.push({
        name: scope === "project" ? entry.name : secret.name,
        scope,
      })
      if (scope === "personal" && parsed.linkToProject) linked.add(entry.name)
    }

    if (scope === "personal" && parsed.linkToProject && project) {
      ctx.store.saveProject({ ...project, seedSecretNames: [...linked].sort() })
    }

    apiLog.info(`import secrets`, { userId: ctx.auth.userId, scope, count: imported.length })
    return NextResponse.json({ imported, count: imported.length })
  } catch (err) {
    return apiError((err as Error).message, HTTP.BAD_REQUEST)
  }
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireAuthStore("write")
  if (ctx instanceof NextResponse) return ctx
  const body = (await req.json().catch(() => null)) as {
    projectId?: string
    linkedSecretNames?: string[]
  } | null
  if (!body?.projectId || !Array.isArray(body.linkedSecretNames)) {
    return apiError("projectId and linkedSecretNames required", HTTP.BAD_REQUEST)
  }
  const project = ctx.store.project(body.projectId as ProjectId)
  if (!project) return apiError("project not found", 404)
  const cleaned: string[] = []
  for (const raw of body.linkedSecretNames) {
    const parsed = secretNameSchema.safeParse(raw)
    if (parsed.success) cleaned.push(parsed.data)
  }
  const linkedSecretNames = [...new Set(cleaned)].sort()
  ctx.store.saveProject({ ...project, seedSecretNames: linkedSecretNames })
  return NextResponse.json({ linkedSecretNames })
}
