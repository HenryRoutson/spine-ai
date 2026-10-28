// AI : kill switch for rrweb session replay — default off; set SESSION_REPLAY_ENABLED=true to record.
// AI : bridged to NEXT_PUBLIC_SESSION_REPLAY_ENABLED in next.config.mjs for client bundles.

export function parseSessionReplayEnabled(raw: string | undefined): boolean {
  if (raw == null || raw.trim() === "") return false;
  const v = raw.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

export const SESSION_REPLAY_ENABLED = parseSessionReplayEnabled(
  process.env.SESSION_REPLAY_ENABLED ?? process.env.NEXT_PUBLIC_SESSION_REPLAY_ENABLED,
);
