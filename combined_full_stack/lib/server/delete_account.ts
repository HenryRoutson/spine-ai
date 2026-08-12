import { LOCAL_DEV_USER_ID, type user_id_string } from "@/lib/server/require_auth"
import { createAdminClient } from "@/lib/server/supabase_admin"

export class DeleteAccountError extends Error {
  constructor(
    message: string,
    readonly code: "confirm_mismatch" | "team_owner" | "unavailable" | "forbidden",
  ) {
    super(message)
    this.name = "DeleteAccountError"
  }
}

type owner_id_string = user_id_string

// AI : tables with owner_id / user_id but no auth.users FK cascade — wipe before deleteUser.
const OWNER_SCOPED_TABLES = [
  "shared_links",
  "hosted_apis",
  "marketplace_listings",
] as const

const USER_SCOPED_TABLES = [
  "assistant_chats",
  "user_feedback",
  "doc_parser_cache",
] as const

function emailsMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

async function deleteRowsByColumn(
  admin: NonNullable<Awaited<ReturnType<typeof createAdminClient>>>,
  table: string,
  column: "owner_id" | "user_id",
  userId: owner_id_string,
): Promise<void> {
  const { error } = await admin.from(table).delete().eq(column, userId)
  if (error) throw new Error(`Failed to clear ${table}: ${error.message}`)
}

async function dissolveSoloOwnedTeams(
  admin: NonNullable<Awaited<ReturnType<typeof createAdminClient>>>,
  userId: user_id_string,
): Promise<void> {
  const { data: owned, error } = await admin
    .from("teams")
    .select("id, name")
    .or(`created_by.eq.${userId},billing_owner_id.eq.${userId}`)
  if (error) {
    // AI : teams migration may be absent in older local DBs — skip restrict cleanup.
    if (error.message.includes("teams") || error.message.includes("schema cache")) return
    throw error
  }
  for (const team of owned ?? []) {
    const { data: members, error: memErr } = await admin
      .from("team_members")
      .select("user_id")
      .eq("team_id", team.id)
    if (memErr) throw memErr
    const others = (members ?? []).filter((m) => m.user_id !== userId)
    if (others.length > 0) {
      throw new DeleteAccountError(
        `You still own team "${team.name}" with other members. Remove or transfer them in Settings → Team before deleting your account.`,
        "team_owner",
      )
    }
    const { error: delErr } = await admin.from("teams").delete().eq("id", team.id)
    if (delErr) throw delErr
  }
}

export async function deleteUserAccount(
  userId: user_id_string,
  accountEmail: string | undefined,
  confirmedEmail: string,
): Promise<void> {
  if (userId === LOCAL_DEV_USER_ID) {
    throw new DeleteAccountError(
      "Local-dev shared identity cannot be deleted. Sign in with a real account.",
      "forbidden",
    )
  }
  const admin = await createAdminClient()
  if (!admin) {
    throw new DeleteAccountError(
      "Account deletion unavailable — server missing SUPABASE_SERVICE_ROLE_KEY.",
      "unavailable",
    )
  }

  let expectedEmail = accountEmail
  if (!expectedEmail) {
    const { data, error: userErr } = await admin.auth.admin.getUserById(userId)
    if (userErr) throw new Error(userErr.message)
    expectedEmail = data.user?.email
  }
  if (!expectedEmail || !emailsMatch(expectedEmail, confirmedEmail)) {
    throw new DeleteAccountError(
      "Type your account email exactly to confirm deletion.",
      "confirm_mismatch",
    )
  }

  await dissolveSoloOwnedTeams(admin, userId)

  for (const table of OWNER_SCOPED_TABLES) {
    await deleteRowsByColumn(admin, table, "owner_id", userId)
  }
  for (const table of USER_SCOPED_TABLES) {
    await deleteRowsByColumn(admin, table, "user_id", userId)
  }

  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) throw new Error(error.message)
}
