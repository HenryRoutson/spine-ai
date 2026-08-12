// AI : kill switch for rrweb session replay — default on; set SESSION_REPLAY_ENABLED=false to disable.
// AI : bridged to NEXT_PUBLIC_SESSION_REPLAY_ENABLED in next.config.mjs for client bundles.
// AI : TODO privacy (prod) — default off in hosted deploys; require explicit SESSION_REPLAY_ENABLED=true.

function parseSessionReplayEnabled(raw: string | undefined): boolean {
  if (raw == null || raw.trim() === "") return true;
  const v = raw.trim().toLowerCase();
  return v !== "false" && v !== "0" && v !== "no" && v !== "off";
}

export const SESSION_REPLAY_ENABLED = parseSessionReplayEnabled(
  process.env.SESSION_REPLAY_ENABLED ?? process.env.NEXT_PUBLIC_SESSION_REPLAY_ENABLED,
);
