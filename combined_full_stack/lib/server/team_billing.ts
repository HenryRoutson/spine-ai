import { billingKeyForUser, type BillingUserKey } from "./billing_account";
import { getTeamBillingOwnerId } from "./teams";
import type { Project } from "./types";
import type { user_id_string } from "./require_auth";

// AI : team projects bill the team owner's credit pool — not the runner's personal balance.
export async function billingKeyForProject(
  runnerId: user_id_string,
  project: Pick<Project, "teamId">,
): Promise<BillingUserKey> {
  if (!project.teamId) return billingKeyForUser(runnerId);
  const ownerId = await getTeamBillingOwnerId(project.teamId);
  if (!ownerId) return billingKeyForUser(runnerId);
  return billingKeyForUser(ownerId);
}
