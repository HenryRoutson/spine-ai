import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { uid } from "@/lib/id";
import { TeamRole, type TeamInviteView, type TeamMemberView, type TeamView, type team_id_string, type team_invite_token_string } from "@/lib/team-types";
import type { ProjectId } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "./supabase_admin";
import { dataDir } from "./config";
import { LOCAL_DEV_USER_ID, type user_id_string } from "./require_auth";

export type { TeamRole, TeamView, TeamMemberView, TeamInviteView };

const TEAM_PREFIX = "team_";
const INVITE_PREFIX = "tinv_";
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type StoredTeam = {
  id: team_id_string;
  name: string;
  slug: string;
  createdBy: user_id_string;
  billingOwnerId: user_id_string;
  createdAt: string;
  members: Array<{ userId: user_id_string; role: TeamRole; joinedAt: string }>;
  invites: Array<{
    token: team_invite_token_string;
    email: string;
    role: Exclude<TeamRole, TeamRole.Owner>;
    invitedBy: user_id_string;
    createdAt: string;
    expiresAt: string;
    acceptedAt?: string;
  }>;
};

type TeamsFile = { teams: StoredTeam[] };

function teamsFile(): string {
  return join(dataDir(), "teams.json");
}

function loadJsonTeams(): StoredTeam[] {
  const path = teamsFile();
  if (!existsSync(path)) return [];
  return (JSON.parse(readFileSync(path, "utf8")) as TeamsFile).teams ?? [];
}

function saveJsonTeams(teams: StoredTeam[]): void {
  const path = teamsFile();
  mkdirSync(dataDir(), { recursive: true });
  writeFileSync(path, JSON.stringify({ teams } satisfies TeamsFile, null, 2));
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const safe = base.length >= 2 ? base : "team";
  return `${safe}-${randomBytes(2).toString("hex")}`;
}

function isMissingTeamsTable(error: { message?: string }): boolean {
  const msg = error.message ?? "";
  return msg.includes("teams") || msg.includes("team_members") || msg.includes("schema cache");
}

function memberRoleForUser(team: StoredTeam, userId: user_id_string): TeamRole | null {
  return team.members.find((m) => m.userId === userId)?.role ?? null;
}

function assertTeamAdmin(team: StoredTeam, userId: user_id_string): void {
  const role = memberRoleForUser(team, userId);
  if (!role || (role !== "owner" && role !== "admin")) {
    throw new Error("Only team owners and admins can perform this action.");
  }
}

function toTeamView(team: StoredTeam, userId: user_id_string, emails: Map<string, string | null>): TeamView {
  const role = memberRoleForUser(team, userId);
  if (!role) throw new Error("Not a team member.");
  const isAdmin = role === "owner" || role === "admin";
  return {
    id: team.id,
    name: team.name,
    slug: team.slug,
    billingOwnerId: team.billingOwnerId,
    createdAt: team.createdAt,
    role,
    members: team.members.map((m) => ({
      userId: m.userId,
      email: emails.get(m.userId) ?? (m.userId === LOCAL_DEV_USER_ID ? "dev@local" : null),
      role: m.role,
      joinedAt: m.joinedAt,
    })),
    pendingInvites: isAdmin
      ? team.invites
          .filter((i) => !i.acceptedAt && Date.parse(i.expiresAt) > Date.now())
          .map((i) => ({
            token: i.token,
            email: i.email,
            role: i.role,
            createdAt: i.createdAt,
            expiresAt: i.expiresAt,
          }))
      : [],
  };
}

async function emailsForUserIds(ids: user_id_string[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (!ids.length) return map;
  const admin = await createAdminClient();
  if (!admin) {
    for (const id of ids) map.set(id, id === LOCAL_DEV_USER_ID ? "dev@local" : null);
    return map;
  }
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const wanted = new Set(ids);
  for (const u of data.users) {
    if (wanted.has(u.id as user_id_string)) map.set(u.id, u.email ?? null);
  }
  return map;
}

async function listJsonTeamsForUser(userId: user_id_string): Promise<TeamView[]> {
  const teams = loadJsonTeams().filter((t) => t.members.some((m) => m.userId === userId));
  const memberIds = [...new Set(teams.flatMap((t) => t.members.map((m) => m.userId)))];
  const emails = await emailsForUserIds(memberIds);
  return teams.map((t) => toTeamView(t, userId, emails));
}

async function listSupabaseTeamsForUser(userId: user_id_string): Promise<TeamView[]> {
  const db = await createClient();
  const { data: memberships, error: memErr } = await db
    .from("team_members")
    .select("team_id, role, joined_at")
    .eq("user_id", userId);
  if (memErr) throw memErr;
  if (!memberships?.length) return [];

  const teamIds = memberships.map((m) => m.team_id as team_id_string);
  const roleByTeam = new Map(memberships.map((m) => [m.team_id, m.role as TeamRole]));

  const { data: teams, error: teamErr } = await db.from("teams").select("*").in("id", teamIds);
  if (teamErr) throw teamErr;

  const { data: members, error: membersErr } = await db
    .from("team_members")
    .select("team_id, user_id, role, joined_at")
    .in("team_id", teamIds);
  if (membersErr) throw membersErr;

  const adminIds = [...new Set((members ?? []).map((m) => m.user_id as user_id_string))];
  const emails = await emailsForUserIds(adminIds);

  const membersByTeam = new Map<string, TeamMemberView[]>();
  for (const row of members ?? []) {
    const list = membersByTeam.get(row.team_id) ?? [];
    list.push({
      userId: row.user_id,
      email: emails.get(row.user_id) ?? null,
      role: row.role as TeamRole,
      joinedAt: row.joined_at,
    });
    membersByTeam.set(row.team_id, list);
  }

  const views: TeamView[] = [];
  for (const row of teams ?? []) {
    const role = roleByTeam.get(row.id);
    if (!role) continue;
    const isAdmin = role === "owner" || role === "admin";
    let pendingInvites: TeamInviteView[] = [];
    if (isAdmin) {
      const { data: invites, error: invErr } = await db
        .from("team_invites")
        .select("token, email, role, created_at, expires_at")
        .eq("team_id", row.id)
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString());
      if (invErr) throw invErr;
      pendingInvites = (invites ?? []).map((i) => ({
        token: i.token as team_invite_token_string,
        email: i.email,
        role: i.role as Exclude<TeamRole, TeamRole.Owner>,
        createdAt: i.created_at,
        expiresAt: i.expires_at,
      }));
    }
    views.push({
      id: row.id as team_id_string,
      name: row.name,
      slug: row.slug,
      billingOwnerId: row.billing_owner_id,
      createdAt: row.created_at,
      role,
      members: membersByTeam.get(row.id) ?? [],
      pendingInvites,
    });
  }
  return views;
}

export async function listTeamsForUser(userId: user_id_string): Promise<TeamView[]> {
  if (userId === LOCAL_DEV_USER_ID) return listJsonTeamsForUser(userId);
  try {
    return await listSupabaseTeamsForUser(userId);
  } catch (err) {
    if (!isMissingTeamsTable(err as { message?: string })) throw err;
    return listJsonTeamsForUser(userId);
  }
}

export async function createTeam(userId: user_id_string, name: string): Promise<TeamView> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Team name is required.");

  if (userId === LOCAL_DEV_USER_ID) {
    const teams = loadJsonTeams();
    const team: StoredTeam = {
      id: uid<team_id_string>(TEAM_PREFIX),
      name: trimmed,
      slug: slugify(trimmed),
      createdBy: userId,
      billingOwnerId: userId,
      createdAt: new Date().toISOString(),
      members: [{ userId, role: TeamRole.Owner, joinedAt: new Date().toISOString() }],
      invites: [],
    };
    teams.push(team);
    saveJsonTeams(teams);
    return toTeamView(team, userId, new Map([[userId, "dev@local"]]));
  }

  const db = await createClient();
  const id = uid<team_id_string>(TEAM_PREFIX);
  const slug = slugify(trimmed);
  const { error: teamErr } = await db.from("teams").insert({
    id,
    name: trimmed,
    slug,
    created_by: userId,
    billing_owner_id: userId,
  });
  if (teamErr) throw teamErr;

  const { error: memErr } = await db.from("team_members").insert({
    team_id: id,
    user_id: userId,
    role: "owner",
  });
  if (memErr) throw memErr;

  const teams = await listTeamsForUser(userId);
  const created = teams.find((t) => t.id === id);
  if (!created) throw new Error("Team created but could not be loaded.");
  return created;
}

export async function inviteTeamMember(
  userId: user_id_string,
  teamId: team_id_string,
  email: string,
  role: Exclude<TeamRole, TeamRole.Owner>,
): Promise<TeamInviteView> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) throw new Error("Valid email is required.");

  if (userId === LOCAL_DEV_USER_ID) {
    const teams = loadJsonTeams();
    const team = teams.find((t) => t.id === teamId);
    if (!team) throw new Error("Team not found.");
    assertTeamAdmin(team, userId);
    const invite = {
      token: uid<team_invite_token_string>(INVITE_PREFIX),
      email: normalized,
      role,
      invitedBy: userId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
    };
    team.invites.push(invite);
    saveJsonTeams(teams);
    return {
      token: invite.token,
      email: invite.email,
      role: invite.role,
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt,
    };
  }

  const db = await createClient();
  const roleCheck = await db.from("team_members").select("role").eq("team_id", teamId).eq("user_id", userId).maybeSingle();
  if (roleCheck.error) throw roleCheck.error;
  if (!roleCheck.data || !["owner", "admin"].includes(roleCheck.data.role)) {
    throw new Error("Only team owners and admins can invite members.");
  }

  const token = uid<team_invite_token_string>(INVITE_PREFIX);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
  const { error } = await db.from("team_invites").insert({
    token,
    team_id: teamId,
    email: normalized,
    role,
    invited_by: userId,
    expires_at: expiresAt,
  });
  if (error) throw error;

  return {
    token,
    email: normalized,
    role,
    createdAt: new Date().toISOString(),
    expiresAt,
  };
}

export async function acceptTeamInvite(
  userId: user_id_string,
  userEmail: string | undefined,
  token: team_invite_token_string,
): Promise<TeamView> {
  if (!userEmail) throw new Error("Sign in with the invited email address to accept.");

  if (userId === LOCAL_DEV_USER_ID) {
    const teams = loadJsonTeams();
    const team = teams.find((t) => t.invites.some((i) => i.token === token && !i.acceptedAt));
    if (!team) throw new Error("Invite not found or expired.");
    const invite = team.invites.find((i) => i.token === token)!;
    if (invite.email !== userEmail.trim().toLowerCase()) throw new Error("This invite was sent to a different email.");
    if (Date.parse(invite.expiresAt) <= Date.now()) throw new Error("Invite expired.");
    invite.acceptedAt = new Date().toISOString();
    if (!team.members.some((m) => m.userId === userId)) {
      team.members.push({ userId, role: invite.role, joinedAt: new Date().toISOString() });
    }
    saveJsonTeams(teams);
    return toTeamView(team, userId, new Map([[userId, userEmail]]));
  }

  const admin = await createAdminClient();
  if (!admin) throw new Error("Invite acceptance requires Supabase admin.");

  const { data: invite, error: invErr } = await admin
    .from("team_invites")
    .select("*")
    .eq("token", token)
    .is("accepted_at", null)
    .maybeSingle();
  if (invErr) throw invErr;
  if (!invite) throw new Error("Invite not found or expired.");
  if (invite.email !== userEmail.trim().toLowerCase()) throw new Error("This invite was sent to a different email.");
  if (Date.parse(invite.expires_at) <= Date.now()) throw new Error("Invite expired.");

  const { error: memErr } = await admin.from("team_members").upsert(
    { team_id: invite.team_id, user_id: userId, role: invite.role },
    { onConflict: "team_id,user_id" },
  );
  if (memErr) throw memErr;

  const { error: acceptErr } = await admin
    .from("team_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("token", token);
  if (acceptErr) throw acceptErr;

  const teams = await listTeamsForUser(userId);
  const joined = teams.find((t) => t.id === (invite.team_id as team_id_string));
  if (!joined) throw new Error("Joined team but could not be loaded.");
  return joined;
}

export async function removeTeamMember(
  actorId: user_id_string,
  teamId: team_id_string,
  memberId: user_id_string,
): Promise<void> {
  if (actorId === LOCAL_DEV_USER_ID) {
    const teams = loadJsonTeams();
    const team = teams.find((t) => t.id === teamId);
    if (!team) throw new Error("Team not found.");
    const target = team.members.find((m) => m.userId === memberId);
    if (!target) throw new Error("Member not found.");
    if (target.role === "owner") throw new Error("Cannot remove the team owner.");
    if (actorId !== memberId) assertTeamAdmin(team, actorId);
    team.members = team.members.filter((m) => m.userId !== memberId);
    saveJsonTeams(teams);
    return;
  }

  const db = await createClient();
  const { data: target, error: targetErr } = await db
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", memberId)
    .maybeSingle();
  if (targetErr) throw targetErr;
  if (!target) throw new Error("Member not found.");
  if (target.role === "owner") throw new Error("Cannot remove the team owner.");

  if (actorId !== memberId) {
    const { data: actor, error: actorErr } = await db
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", actorId)
      .maybeSingle();
    if (actorErr) throw actorErr;
    if (!actor || !["owner", "admin"].includes(actor.role)) {
      throw new Error("Only team owners and admins can remove members.");
    }
  }

  const { error } = await db.from("team_members").delete().eq("team_id", teamId).eq("user_id", memberId);
  if (error) throw error;
}

export function teamProjectWriteError(project: { teamReadOnly?: boolean }): string | null {
  return project.teamReadOnly ? "This team project is read-only for your role." : null;
}

export async function shareProjectWithTeam(
  userId: user_id_string,
  projectId: ProjectId,
  teamId: team_id_string | null,
): Promise<void> {
  // AI : LOCAL_DEV still persists teamId via SupabaseStore.saveProject — skip direct DB write only.
  if (userId === LOCAL_DEV_USER_ID) return;

  const db = await createClient();
  const { data: project, error: projErr } = await db
    .from("projects")
    .select("user_id, team_id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (projErr) throw projErr;
  if (!project) throw new Error("Project not found.");

  if (teamId) {
    const { data: membership, error: memErr } = await db
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .maybeSingle();
    if (memErr) throw memErr;
    if (!membership || !["owner", "admin", "member"].includes(membership.role)) {
      throw new Error("You are not a member of that team.");
    }
  }

  const { error } = await db.from("projects").update({ team_id: teamId }).eq("id", projectId).eq("user_id", userId);
  if (error) throw error;
}

export async function getTeamBillingOwnerId(teamId: team_id_string): Promise<user_id_string | null> {
  if (!teamId) return null;

  if (teamId.startsWith(TEAM_PREFIX)) {
    const team = loadJsonTeams().find((t) => t.id === teamId);
    return team?.billingOwnerId ?? null;
  }

  const db = await createClient();
  const { data, error } = await db.from("teams").select("billing_owner_id").eq("id", teamId).maybeSingle();
  if (error) {
    if (isMissingTeamsTable(error)) {
      const team = loadJsonTeams().find((t) => t.id === teamId);
      return team?.billingOwnerId ?? null;
    }
    throw error;
  }
  return (data?.billing_owner_id as user_id_string) ?? null;
}

export async function listTeamIdsForUser(userId: user_id_string): Promise<team_id_string[]> {
  const teams = await listTeamsForUser(userId);
  return teams.map((t) => t.id);
}

