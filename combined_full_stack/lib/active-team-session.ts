// AI : persist active team selection in the browser — scopes project sharing UI.

import type { team_id_string } from "@/lib/team-types";

const KEY = "spine_active_team_id";

export function readActiveTeamId(): team_id_string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  return raw ? (raw as team_id_string) : null;
}

export function writeActiveTeamId(id: team_id_string | null): void {
  if (typeof window === "undefined") return;
  if (!id) localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, id);
}
