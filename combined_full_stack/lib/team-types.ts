// AI : client-safe team types — mirror server TeamRecord for settings UI.

export type team_id_string = string & { __brand: "team_id" };
export type team_invite_token_string = string & { __brand: "team_invite_token" };

export enum TeamRole {
  Owner = "owner",
  Admin = "admin",
  Member = "member",
}

export type TeamMemberView = {
  userId: string;
  email: string | null;
  role: TeamRole;
  joinedAt: string;
};

export type TeamInviteView = {
  token: team_invite_token_string;
  email: string;
  role: Exclude<TeamRole, TeamRole.Owner>;
  createdAt: string;
  expiresAt: string;
};

export type TeamView = {
  id: team_id_string;
  name: string;
  slug: string;
  billingOwnerId: string;
  createdAt: string;
  role: TeamRole;
  members: TeamMemberView[];
  pendingInvites: TeamInviteView[];
};

export type TeamsListResponse = {
  teams: TeamView[];
};
